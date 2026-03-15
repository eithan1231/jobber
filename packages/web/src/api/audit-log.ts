import { JobberGenericResponse } from "./common";

export type JobberAuditLogSubject =
  | {
      type: "user";
      userId: string;
    }
  | {
      type: "service-client";
      serviceClientId: string;
    }
  | {
      type: "system";
    };

export type JobberAuditLogEntry = {
  id: string;

  subject: JobberAuditLogSubject;
  entry:
    | {
        type: "generic";
        message: string;
      }
    | {
        // there is more
        type: `oauth-${string}`;
        clientId: string;
      };

  created: string;
};

export type JobberAuditLogData = {
  data: [];
  nextCursor: string | null;
  prevCursor: string | null;
};

export const getAuditLogs = async (
  cursor?: string,
): Promise<JobberGenericResponse<JobberAuditLogData>> => {
  const result = await fetch(`/api/audit-log/?cursor=${cursor}`);

  return await result.json();
};
