import { randomUUID } from "crypto";
import EventEmitter from "events";
import { Server, Socket } from "net";

type ClientRegistered = {
  type: "registered";
};

type ClientConnected = {
  type: "connected";
  socket: Socket;
};

type Client = (ClientRegistered | ClientConnected) & {
  id: string;
};

export class JobController {
  private server: Server;

  private clients: Map<string, Client>;

  private handleResponseEvents: Map<string, (payload: any) => void> = new Map();

  constructor() {
    this.server = new Server();
    this.clients = new Map();
  }

  public async listen() {
    return new Promise((resolve) => {
      if (this.server.listening) {
        resolve(true);
      }

      this.server.listen(10211, "127.0.0.1");

      this.server.once("listening", () => {
        console.log(
          "[JobController/listen] Listening for incoming connections"
        );

        resolve(true);
      });

      this.server.on("error", (error) => {
        console.error(error);
      });

      this.server.on("connection", (socket: Socket) => {
        this.onConnection(socket);
      });
    });
  }

  public registerExpectedClient(id: string) {
    this.clients.set(id, {
      id: id,
      type: "registered",
    });
  }

  public sendHandle = (runnerIdentifier: string, payload: any) => {
    return new Promise(async (resolve, reject) => {
      // TODO: Make this event driven, because yuck
      let client = this.clients.get(runnerIdentifier);

      if (!client) {
        throw new Error(`client not found ${runnerIdentifier}`);
      }

      if (client.type === "registered") {
        for (let i = 0; i < 10 && client.type === "registered"; i++) {
          await new Promise((resolve) => setTimeout(resolve, i * 10));
        }

        client = this.clients.get(runnerIdentifier);

        if (!client || client.type !== "connected") {
          throw new Error(`client not found ${runnerIdentifier}`);
        }
      }

      const traceId = randomUUID();

      // TODO: Handle timeout
      this.handleResponseEvents.set(traceId, (data) => {
        resolve(data);
      });

      client.socket.write(
        JSON.stringify({
          type: "handle",
          traceId: traceId,
          payload: payload,
        })
      );
    });
  };

  private async handleSockDataInit(
    socket: Socket,
    data: { type: "init"; id: string }
  ) {
    const client = this.clients.get(data.id);

    if (!client || client.type !== "registered") {
      console.log(
        `[JobController/handleSockDataInit] Unable to register client, may have invalid identifier, or already in use`
      );

      socket.destroy();
    }

    this.clients.set(data.id, {
      type: "connected",
      id: data.id,
      socket: socket,
    });
  }

  private async handleSockDataHandleResponse(
    socket: Socket,
    data: { type: "handle-response"; traceId: string; payload: any }
  ) {
    const callable = this.handleResponseEvents.get(data.traceId);

    if (!callable) {
      console.log(
        `[JobController/handleSockDataHandleResponse] received detatched trace idd, traceId ${data.traceId}`
      );

      return;
    }

    callable(data.payload);
  }

  private async handleSockData(socket: Socket, data: any) {
    switch (data.type) {
      case "init": {
        return this.handleSockDataInit(socket, data);
      }

      case "handle-response": {
        return this.handleSockDataHandleResponse(socket, data);
      }

      default: {
        console.log(
          `[JobController/handleSockData] Received unknown data type ${data.type}`
        );

        break;
      }
    }
  }

  private async onConnection(socket: Socket) {
    socket.on("data", (data) => {
      const parsed = JSON.parse(data.toString());

      this.handleSockData(socket, parsed);
    });

    socket.on("error", (error) => {
      //
    });
  }
}
