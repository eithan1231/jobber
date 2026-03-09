import { GeneralAPIDefinition } from "@jobber/grpc/general.js";
import { ServerError, ServiceImplementation, Status } from "nice-grpc";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { authorizedCall } from "../util.js";

export const getTemplates: ServiceImplementation<GeneralAPIDefinition>["getTemplates"] =
  authorizedCall(async (request, _context, bouncer) => {
    if (!bouncer.canReadTemplatesGenerally()) {
      throw new ServerError(Status.PERMISSION_DENIED, "Permission denied");
    }

    const badGatewayTemplate = await readFile(
      path.join(process.cwd(), "src/static-templates/bad-gateway.html"),
      "utf8",
    );

    return {
      templateBadGateway: badGatewayTemplate,
    };
  });
