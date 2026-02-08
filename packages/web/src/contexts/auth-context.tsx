import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createAuthLogin, getAuth, JobberAuth } from "../api/auth";
import { JobberGenericResponse } from "../api/common";
import { getConfig, JobberConfig } from "../api/config";
import {
  canPerformAction as canPerformActionOriginal,
  JobberPermissionAction,
} from "@jobber/common/permissions.js";

export type AuthContextType = {
  initialised: boolean;
  config: JobberConfig | null;
  auth: JobberAuth | null;
  canPerformAction: (
    resource: string,
    action: "read" | "write" | "delete",
  ) => boolean;
  login: (username: string, password: string) => Promise<JobberGenericResponse>;
  register: (
    username: string,
    password: string,
  ) => Promise<JobberGenericResponse>;
};

export const AuthContext = createContext<AuthContextType>({
  initialised: false,
  config: null,
  auth: null,
  canPerformAction: () => {
    throw new Error("Auth context not initialized");
  },
  login: () => {
    throw new Error("Auth context not initialized");
  },
  register: () => {
    throw new Error("Auth context not initialized");
  },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [context, setContext] = useState<{
    initialised: boolean;
    config: JobberConfig | null;
    auth: JobberAuth | null;
  }>({
    initialised: false,
    config: null,
    auth: null,
  });

  useEffect(() => {
    const reload = async () => {
      const [auth, config] = await Promise.all([getAuth(), getConfig()]);

      setContext((prev) => ({
        ...prev,
        config: config.success ? config.data : null,
        auth: auth.success ? auth.data : null,
        initialised: true,
      }));
    };

    reload();

    const interval = setInterval(() => reload(), 10_000);

    return () => clearInterval(interval);
  }, []);

  const canPerformAction = useCallback(
    (resource: string, action: JobberPermissionAction) => {
      if (context.auth === null) {
        return false;
      }

      return canPerformActionOriginal(
        context.auth.permissions,
        resource,
        action,
      );
    },
    [context],
  );

  const login = useCallback(async (username: string, password: string) => {
    const result = await createAuthLogin(username, password);

    if (!result.success) {
      return result;
    }

    const auth = await getAuth();

    if (!auth.success) {
      return result;
    }

    setContext((prev) => ({
      ...prev,
      auth: auth.data,
    }));

    return result;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const result = await createAuthLogin(username, password);

    if (!result.success) {
      return result;
    }

    const auth = await getAuth();

    if (!auth.success) {
      return result;
    }

    setContext((prev) => ({
      ...prev,
      auth: auth.data,
    }));

    return result;
  }, []);

  const contextValue = useMemo<AuthContextType>(() => {
    return {
      initialised: context.initialised,
      config: context.config,
      auth: context.auth,
      canPerformAction,
      login,
      register,
    };
  }, [context]);

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const resourceMatches = (resource: string, pattern: string) => {
  const resourceParts = resource.split("/");
  const patternParts = pattern.split("/");

  for (const [patternPartIndex, patternPart] of patternParts.entries()) {
    const resourcePart = resourceParts[patternPartIndex];

    if (patternPart === "*") {
      continue;
    }

    if (resourcePart === undefined) {
      return false;
    }

    if (resourcePart !== patternPart) {
      return false;
    }
  }

  return true;
};
