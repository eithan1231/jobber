import { Socket } from "net";
import { EventEmitter } from "events";

const FRAME_HEADER_SIZE_LENGTH = 6;
const FRAME_HEADER_MAGIC = "\xB0\x00\xB8\x88";
const FRAME_HEADER_LENGTH =
  FRAME_HEADER_MAGIC.length + FRAME_HEADER_SIZE_LENGTH;

export class TcpFrameSocket extends EventEmitter<{
  frame: [buffer: Buffer];
  close: [];
}> {
  private socket: Socket;

  private isFlushing = false;

  private frameQueue: Array<{
    frame: Buffer;
    callback: () => void;
  }> = [];

  private dataBuffer = Buffer.alloc(0);

  constructor(socket?: Socket) {
    super();

    if (socket) {
      this.socket = socket;
    } else {
      this.socket = new Socket();
    }

    this.socket.setNoDelay(true);

    this.socket.on("data", (buffer: Buffer) => {
      return this.onData(buffer);
    });

    this.socket.on("close", () => this.emit("close"));
  }

  public connect(options: { host: string; port: number }) {
    return new Promise((resolve, reject) => {
      this.socket.connect({
        host: options.host,
        port: options.port,
      });

      this.socket.once("connect", () => {
        resolve(null);
      });

      this.socket.once("connectionAttemptFailed", () => {
        reject(new Error("Connection attempt failed"));
      });
    });
  }

  end(callback: () => void) {
    this.socket.end(callback);
  }

  public writeFrame(buffer: Buffer) {
    return new Promise((resolve, reject) => {
      this.frameQueue.push({
        frame: buffer,
        callback: () => resolve(null),
      });

      this.writeFrameFlusher();
    });
  }

  private writeFrameFlusher() {
    if (this.isFlushing) {
      return;
    }

    this.isFlushing = true;

    try {
      while (true) {
        const queuedItems = this.frameQueue.splice(0);

        if (queuedItems.length === 0) {
          // Reached end of queue

          break;
        }

        for (const queuedItem of queuedItems) {
          const frame = queuedItem.frame;

          const header = Buffer.alloc(FRAME_HEADER_LENGTH);
          header.write(FRAME_HEADER_MAGIC, "ascii");
          header.writeIntLE(
            frame.length,
            FRAME_HEADER_MAGIC.length,
            FRAME_HEADER_SIZE_LENGTH
          );

          this.socket.write(header);

          const chunkSize = 1024;
          for (let i = 0; i < frame.length; i += chunkSize) {
            const start = i;
            const end = i + chunkSize;

            const data = frame.subarray(start, end);

            this.socket.write(data);
          }

          queuedItem.callback();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.isFlushing = false;
    }
  }

  private onData(buffer: Buffer) {
    this.dataBuffer = Buffer.concat([this.dataBuffer, buffer]);

    while (true) {
      const frameIndex = this.dataBuffer.indexOf(
        FRAME_HEADER_MAGIC,
        0,
        "ascii"
      );

      if (frameIndex < 0) {
        break;
      }

      if (this.dataBuffer.length - frameIndex < FRAME_HEADER_LENGTH) {
        break;
      }

      const length = this.dataBuffer.readIntLE(
        frameIndex + FRAME_HEADER_MAGIC.length,
        FRAME_HEADER_SIZE_LENGTH
      );

      const fullFrameSize = FRAME_HEADER_LENGTH + length;

      if (this.dataBuffer.length - frameIndex < fullFrameSize) {
        break;
      }

      const frame = Buffer.from(
        this.dataBuffer.subarray(
          frameIndex + FRAME_HEADER_LENGTH,
          frameIndex + fullFrameSize
        )
      );

      this.emit("frame", frame);

      this.dataBuffer = Buffer.from(
        this.dataBuffer.subarray(frameIndex + fullFrameSize)
      );
    }
  }
}
