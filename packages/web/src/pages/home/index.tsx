import { useEffect } from "react";
import {
  Link,
  Outlet,
  RouteObject,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../hooks/use-auth";
import { useConfig } from "../../hooks/use-config";
import { useJobs } from "../../hooks/use-jobs";

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

const Component = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const { auth, authError, reloadAuth } = useAuth();
  const { jobs, reloadJobs } = useJobs();
  const { config } = useConfig();

  useEffect(() => {
    if (!auth && authError) {
      navigate("/auth/login");
      return;
    }
  }, [auth, authError, pathname]);

  useEffect(() => {
    const reload = () => {
      reloadAuth();
      reloadJobs();
    };

    const interval = setInterval(() => {
      reload();
    }, 3 * 1000);

    return () => clearInterval(interval);
  }, [reloadAuth, reloadJobs]);

  return (
    <>
      <div className="flex h-screen">
        <aside className="flex-col w-96 h-screen bg-gray-800 text-white">
          {/* A small sidebar containing all of the jobs, and other navigations */}

          {/*  */}
          <div className="p-4">
            <h2 className="text-lg font-bold mb-2">
              {config?.jobberName ?? "Jobber"}
            </h2>
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
            </ul>

            {jobs && (
              <>
                <h2 className="text-lg font-bold mt-6 mb-2">Jobs</h2>
                <ul className="space-y-1">
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
                          {job.jobName}
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
