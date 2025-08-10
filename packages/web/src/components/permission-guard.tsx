import { useContext } from "react";
import { AuthContext } from "../contexts/auth-context";

export const PermissionGuardComponent = ({
  children,
  resource,
  action,
}: {
  children: React.ReactNode;
  resource: string;
  action: "read" | "write" | "delete";
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
