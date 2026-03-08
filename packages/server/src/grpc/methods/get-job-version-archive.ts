import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { open } from "node:fs/promises";
import { actionsModel } from "~/db/actions.js";
import { jobVersionsModel } from "~/db/job-versions.js";
import { getJobActionArchiveFile } from "~/paths.js";
import { getBouncer } from "../util.js";

export const getJobVersionArchive: ServiceImplementation<GeneralAPIDefinition>["getJobVersionArchive"] =
  async function* (request, context) {
    const bouncer = await getBouncer(context);

    const [jobVersion, jobAction] = await Promise.all([
      jobVersionsModel.byId(request.jobVersionId),
      actionsModel.byVersionId(request.jobVersionId),
    ]);

    if (!jobVersion || !jobAction) {
      throw new ServerError(Status.NOT_FOUND, "Job version not found");
    }

    if (!bouncer.canReadJobVersionArchive(jobVersion)) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    const archiveFileName = getJobActionArchiveFile(jobVersion, jobAction);

    const handle = await open(archiveFileName, "r");
    const chunkSize = 1024 * 10;

    try {
      for (let seq = 0; ; seq++) {
        const position = seq * chunkSize;

        const buffer = Buffer.alloc(chunkSize);

        const { bytesRead } = await handle.read({
          buffer,
          length: chunkSize,
          position,
        });

        if (bytesRead === 0) {
          break;
        }

        yield {
          seq,
          data: buffer.subarray(0, bytesRead),
          end: bytesRead < chunkSize,
        };

        if (bytesRead < chunkSize) {
          break;
        }
      }
    } finally {
      await handle.close();
    }
  };
