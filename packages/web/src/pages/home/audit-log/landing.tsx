import { useState } from "react";
import { HomePageComponent } from "../../../components/home-page-component";
import { PermissionGuardComponent } from "../../../components/permission-guard";
import { TimeSinceComponent } from "../../../components/time-since-component";
import { useAuditLogs } from "../../../hooks/use-audit-logs";
import {
  JobberAuditLogEntry,
  JobberAuditLogSubject,
} from "../../../api/audit-log";

const formatSubject = (subject: JobberAuditLogSubject): string => {
  switch (subject.type) {
    case "user":
      return `User ${subject.userId.slice(0, 8)}…`;
    case "service-client":
      return `Service Client ${subject.serviceClientId.slice(0, 8)}…`;
    case "system":
      return "System";
  }
};

const formatEntry = (entry: JobberAuditLogEntry["entry"]): string => {
  if (entry.type === "generic") {
    return entry.message;
  }

  return `${entry.type} (client: ${entry.clientId})`;
};

const Component = () => {
  const [cursor, setCursor] = useState<string>("");
  const { auditLogs, auditLogError } = useAuditLogs(cursor);

  return (
    <PermissionGuardComponent resource="audit-log" action="read">
      <HomePageComponent title="Audit Log">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
              <p className="text-sm text-gray-600 mt-1">
                View system activity and changes
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditLogs ? (
                    auditLogs.data.length > 0 ? (
                      auditLogs.data.map((log: JobberAuditLogEntry) => (
                        <tr
                          key={log.id}
                          className="hover:bg-gray-50 transition"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatSubject(log.subject)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 break-words whitespace-pre-wrap">
                            {formatEntry(log.entry)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <TimeSinceComponent
                              timestamp={Math.floor(
                                new Date(log.created).getTime() / 1000,
                              )}
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-6 py-12 text-center text-gray-500"
                        >
                          No audit log entries found.
                        </td>
                      </tr>
                    )
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center">
                        {auditLogError ? (
                          <div className="text-red-600">
                            <svg
                              className="mx-auto h-12 w-12 text-red-400 mb-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                            <p className="font-medium">
                              Error loading audit logs
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {auditLogError}
                            </p>
                          </div>
                        ) : (
                          <div className="text-gray-500">
                            <svg
                              className="mx-auto h-12 w-12 text-gray-400 mb-3 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            <p className="font-medium">Loading audit logs...</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {auditLogs && (
              <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-200">
                <button
                  disabled={!auditLogs.prevCursor}
                  onClick={() => setCursor(auditLogs.prevCursor ?? "")}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className="mr-1 w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Previous
                </button>
                <button
                  disabled={!auditLogs.nextCursor}
                  onClick={() => setCursor(auditLogs.nextCursor ?? "")}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <svg
                    className="ml-1 w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </HomePageComponent>
    </PermissionGuardComponent>
  );
};

export default Component;
