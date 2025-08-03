import {
  Link,
  Outlet,
  RouteObject,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useJobs } from "../../hooks/use-jobs";

import JobIdEnvironmentComponent from "./[jobId]/environment";
import JobIdLandingComponent from "./[jobId]/landing";
import JobIdLogsComponent from "./[jobId]/logs";
import JobIdMetricsComponent from "./[jobId]/metrics";
import JobIdStoreComponent from "./[jobId]/store";
import JobIdVersionsComponent from "./[jobId]/versions";
import LandingComponent from "./landing";

const Component = () => {
  const location = useLocation().pathname;

  const { jobs, jobsError, reloadJobs } = useJobs();

  return (
    <>
      <div className="flex h-screen">
        <aside className="flex-col w-96 h-screen bg-gray-800 text-white">
          {/* A small sidebar containing all of the jobs, and other navigations */}

          {/*  */}
          <div className="p-4">
            <h2 className="text-lg font-bold mb-2">Jobber</h2>
            <ul className="space-y-1">
              <li>
                <Link
                  to="/home/"
                  className={`block px-4 py-2 rounded hover:bg-gray-700 ${
                    location === "/home/" ? "bg-gray-700" : ""
                  }`}
                >
                  Home
                </Link>
              </li>

              <li>
                <Link
                  to="/home/users"
                  className={`block px-4 py-2 rounded hover:bg-gray-700 ${
                    location === "/home/users" ? "bg-gray-700" : ""
                  }`}
                >
                  User Management
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
                            location.startsWith(`/home/job/${job.id}/`)
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
