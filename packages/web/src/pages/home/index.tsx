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
        <aside className="flex-col w-96 h-screen bg-gray-800 text-white">
          {/* A small sidebar containing all of the jobs, and other navigations */}

          {/*  */}
          <div className="p-4 h-screen overflow-y-auto">
            <h2 className="text-lg font-bold mb-2">
              {config?.jobberName ?? "Jobber"}
            </h2>

            {sessionExpiryUnixTimestamp && isExpirySoon && (
              <div className="mb-4 p-3 bg-yellow-600 border border-yellow-500 rounded">
                <div className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium">Session Expiring</span>
                </div>
                <p className="text-xs mt-1">
                  <TimeSinceComponent timestamp={sessionExpiryUnixTimestamp} />{" "}
                  your session expires.
                </p>
              </div>
            )}

            <ul className="space-y-1">
              <li>
                <Link
                  to="/home/"
                  className={`block px-4 py-2 rounded hover:bg-gray-700 ${
                    pathname === "/home/" ? "bg-gray-700" : ""
                  }`}
                >
                  Home
                </Link>
              </li>

              <PermissionGuardComponent resource={`users`} action="read">
                <li>
                  <Link
                    to="/home/users"
                    className={`block px-4 py-2 rounded hover:bg-gray-700 ${
                      pathname === "/home/users" ? "bg-gray-700" : ""
                    }`}
                  >
                    User Management
                  </Link>
                </li>
              </PermissionGuardComponent>

              <PermissionGuardComponent resource={`api-tokens`} action="read">
                <li>
                  <Link
                    to="/home/api-tokens/"
                    className={`block px-4 py-2 rounded hover:bg-gray-700 ${
                      pathname === "/home/api-tokens/" ? "bg-gray-700" : ""
                    }`}
                  >
                    API Tokens Management
                  </Link>
                </li>
              </PermissionGuardComponent>
            </ul>

            {jobs && (
              <>
                <h2 className="text-lg font-bold mt-6 mb-2">Jobs</h2>
                <ul className="space-y-2">
                  {jobs &&
                    jobs.map((job) => (
                      <li key={job.id}>
                        <Link
                          to={`/home/job/${job.id}/`}
                          className={`block px-4 py-2 rounded hover:bg-gray-700 ${
                            pathname.startsWith(`/home/job/${job.id}/`)
                              ? "bg-gray-700"
                              : ""
                          }`}
                        >
                          <div title={job.jobName}>
                            {job.jobName}
                            {/*  */}
                            {job.status === "disabled" && (
                              <span className="mx-2 bg-red-300 text-red-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">
                                Disabled
                              </span>
                            )}
                          </div>

                          <div
                            className="text-sm text-gray-400 truncate"
                            title={job.description}
                          >
                            {job.description}
                          </div>
                        </Link>
                      </li>
                    ))}
                </ul>
              </>
            )}
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
