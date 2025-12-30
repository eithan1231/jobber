import { useContext, useEffect, useMemo } from "react";
import {
  Link,
  Outlet,
  RouteObject,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useConfig } from "../../hooks/use-config";
import { useJobs } from "../../hooks/use-jobs";

import { PermissionGuardComponent } from "../../components/permission-guard";

import TokensTokenIdEditComponent from "./api-tokens/[tokenId]/edit";
import TokensTokenIdLandingComponent from "./api-tokens/[tokenId]/landing";
import TokensComponent from "./api-tokens/landing";
import TokensNewComponent from "./api-tokens/new";
import JobIdEnvironmentComponent from "./jobs/[jobId]/environment";
import JobIdLandingComponent from "./jobs/[jobId]/landing";
import JobIdLogsComponent from "./jobs/[jobId]/logs";
import JobIdMetricsComponent from "./jobs/[jobId]/metrics";
import JobIdStoreComponent from "./jobs/[jobId]/store";
import JobIdVersionsComponent from "./jobs/[jobId]/versions";
import LandingComponent from "./landing";
import UsersUserIdEditComponent from "./users/[userId]/edit";
import UsersUserIdLandingComponent from "./users/[userId]/landing";
import UsersComponent from "./users/landing";
import { AuthContext } from "../../contexts/auth-context";
import { TimeSinceComponent } from "../../components/time-since-component";

const Component = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const { auth, initialised } = useContext(AuthContext);
  const { jobs, reloadJobs } = useJobs();
  const { config } = useConfig();

  // Sort jobs: enabled first, then disabled
  const sortedJobs = useMemo(() => {
    if (!jobs) return [];
    return [...jobs].sort((a, b) => {
      if (a.status === "enabled" && b.status === "disabled") return -1;
      if (a.status === "disabled" && b.status === "enabled") return 1;
      return a.jobName.localeCompare(b.jobName);
    });
  }, [jobs]);

  const sessionExpiryUnixTimestamp = useMemo(() => {
    if (auth?.session?.expires) {
      const expires = new Date(auth.session.expires).getTime();

      return Math.floor(expires / 1000);
    }

    if (auth?.token?.expires) {
      const expires = new Date(auth.token.expires).getTime();

      return Math.floor(expires / 1000);
    }

    return null;
  }, [auth]);

  const isExpirySoon = sessionExpiryUnixTimestamp
    ? Math.floor(sessionExpiryUnixTimestamp - Math.floor(Date.now() / 1000)) <
      60 * 60
    : false;

  useEffect(() => {
    if (initialised && !auth) {
      navigate("/auth/login");
      return;
    }
  }, [initialised, auth, pathname]);

  useEffect(() => {
    const reload = () => {
      reloadJobs();
    };

    const interval = setInterval(() => {
      reload();
    }, 3 * 1000);

    return () => clearInterval(interval);
  }, [reloadJobs]);

  return (
    <>
      <div className="flex h-screen">
        <aside className="flex-col w-80 h-screen bg-gray-900 text-white border-r border-gray-700">
          {/* A small sidebar containing all of the jobs, and other navigations */}

          {/*  */}
          <div className="flex flex-col h-screen">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">
                {config?.jobberName ?? "Jobber"}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {sessionExpiryUnixTimestamp && isExpirySoon && (
                <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-medium text-yellow-300">
                      Session Expiring
                    </span>
                  </div>
                  <p className="text-xs mt-1 text-yellow-200/90">
                    <TimeSinceComponent
                      timestamp={sessionExpiryUnixTimestamp}
                    />{" "}
                    your session expires.
                  </p>
                </div>
              )}

              <nav className="space-y-1">
                <Link
                  to="/home/"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === "/home/"
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  Home
                </Link>

                <PermissionGuardComponent resource={`user`} action="read">
                  <Link
                    to="/home/users"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname === "/home/users"
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    Users
                  </Link>
                </PermissionGuardComponent>

                <PermissionGuardComponent resource={`api-tokens`} action="read">
                  <Link
                    to="/home/api-tokens/"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname === "/home/api-tokens/"
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                      />
                    </svg>
                    API Tokens
                  </Link>
                </PermissionGuardComponent>
              </nav>

              {sortedJobs && sortedJobs.length > 0 && (
                <>
                  <div className="mt-6 mb-3 px-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Jobs ({sortedJobs.length})
                    </h3>
                  </div>
                  <nav className="space-y-1">
                    {sortedJobs.map((job) => (
                      <Link
                        key={job.id}
                        to={`/home/job/${job.id}/`}
                        className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                          pathname.startsWith(`/home/job/${job.id}/`)
                            ? "bg-gray-800 text-white"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className="font-medium truncate"
                            title={job.jobName}
                          >
                            {job.jobName}
                          </span>
                          {job.status === "disabled" && (
                            <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-400 rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                        {job.description && (
                          <div
                            className="text-xs text-gray-500 truncate"
                            title={job.description}
                          >
                            {job.description}
                          </div>
                        )}
                      </Link>
                    ))}
                  </nav>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-col bg-gray-100 w-full h-screen">
          <Outlet />
        </main>
      </div>
    </>
  );
};

export default {
  path: "/home/",
  Component,
  children: [
    {
      index: true,
      Component: LandingComponent,
    },

    // USERS
    {
      path: "users/",
      Component: UsersComponent,
    },
    {
      path: "users/:userId/edit",
      Component: UsersUserIdEditComponent,
    },
    {
      path: "users/:userId/",
      Component: UsersUserIdLandingComponent,
    },

    // API TOKENS
    {
      path: "api-tokens/",
      Component: TokensComponent,
    },
    {
      path: "api-tokens/new",
      Component: TokensNewComponent,
    },
    {
      path: "api-tokens/:tokenId/edit",
      Component: TokensTokenIdEditComponent,
    },
    {
      path: "api-tokens/:tokenId/",
      Component: TokensTokenIdLandingComponent,
    },

    // JOBS
    {
      path: "job/:jobId/",
      Component: JobIdLandingComponent,
    },
    {
      path: "job/:jobId/environment",
      Component: JobIdEnvironmentComponent,
    },
    {
      path: "job/:jobId/logs",
      Component: JobIdLogsComponent,
    },
    {
      path: "job/:jobId/metrics",
      Component: JobIdMetricsComponent,
    },
    {
      path: "job/:jobId/store",
      Component: JobIdStoreComponent,
    },
    {
      path: "job/:jobId/versions",
      Component: JobIdVersionsComponent,
    },

    // {
    //   path: "settings/",
    //   Component: SettingsComponent,
    // },
    // {
    //   path: "decryption/",
    //   Component: DecryptionComponent,
    // },
    // {
    //   path: "debug/",
    //   Component: DebugComponent,
    // },
    // {
    //   path: ":noteId/",
    //   Component: NoteEditComponent,
    // },
  ],
} as RouteObject;
