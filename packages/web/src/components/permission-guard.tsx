import { useContext } from "react";
import { AuthContext } from "../contexts/auth-context";
import { JobberPermissionAction } from "@jobber/common/permissions.js";

export const PermissionGuardComponent = ({
  children,
  resource,
  action,
}: {
  children: React.ReactNode;
  resource: string;
  action: JobberPermissionAction;
}) => {
  const { auth, canPerformAction } = useContext(AuthContext);

  if (!auth) {
    return null;
  }

  if (!canPerformAction(resource, action)) {
    return null;
  }

  return <>{children}</>;
};
