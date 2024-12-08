import { getJobs, JobberJob } from "../../api/jobber.js";
import { useEffect, useState } from "react";
import { Link, RouteObject, useLocation } from "react-router-dom";

const Component = () => {
  const [jobs, setJobs] = useState<JobberJob[]>([]);

  const location = useLocation();

  useEffect(() => {
    getJobs().then((result) => {
      if (result.success) {
        setJobs(result.data);
      }
    });
  }, [location]);

  return (
    <div className="container mx-auto my-8 p-4">
      <h1 className="text-2xl font-bold mb-4">Jobber Jobs</h1>
      <table className="table-auto border-collapse border border-gray-300 w-full">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
            <th className="border border-gray-300 px-4 py-2 text-left">
              Description
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left">
              Version
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((item, index) => (
            <tr key={index} className="odd:bg-white even:bg-gray-100">
              <td className="border border-gray-300 px-4 py-2">{item.name}</td>
              <td className="border border-gray-300 px-4 py-2">
                {item.description}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {item.version}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                <Link
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-4 rounded"
                  to={`${item.name}/`}
                >
                  View Page
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const pagesJobberLandingRoute: RouteObject = {
  path: "/jobber/",
  Component: Component,
};
