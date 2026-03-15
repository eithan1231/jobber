import { useEffect, useState } from "react";
import { getAuditLogs, JobberAuditLogData } from "../api/audit-log";

export const useAuditLogs = (cursor: string) => {
  const [auditLogs, setAuditLogs] = useState<JobberAuditLogData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const handleUpdate = () => {
    getAuditLogs(cursor).then((res) => {
      if (!res.success) {
        setError("Failed to fetch audit logs");

        console.error("Failed to fetch audit logs", res.message);

        return;
      }

      setAuditLogs(res.data);
    });
  };

  const reload = () => {
    setReloadFlag((prev) => prev + 1);
  };

  useEffect(() => {
    handleUpdate();
  }, [cursor, reloadFlag]);

  return { auditLogs, auditLogError: error, reloadAuditLogs: reload };
};
