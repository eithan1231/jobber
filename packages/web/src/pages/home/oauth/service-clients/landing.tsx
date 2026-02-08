import { Link } from "react-router-dom";
import { HomePageComponent } from "../../../../components/home-page-component";
import { PermissionGuardComponent } from "../../../../components/permission-guard";
import { TimeSinceComponent } from "../../../../components/time-since-component";
import { useServiceClients } from "../../../../hooks/use-service-clients";

const Component = () => {
  const { serviceClients, serviceClientsError } = useServiceClients();

  return (
    <PermissionGuardComponent resource="oauth/service-client" action="read">
      <HomePageComponent title="OAuth Service Clients">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                OAuth Service Clients
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage OAuth service clients for machine-to-machine
                authentication
              </p>
            </div>
            <PermissionGuardComponent
              resource="oauth/service-client"
              action="write"
            >
              <Link
                to="/home/oauth/service-clients/new"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create New Client
              </Link>
            </PermissionGuardComponent>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Audiences
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Permissions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {serviceClients ? (
                    serviceClients.map((client) => (
                      <tr
                        key={client.id}
                        className="hover:bg-gray-50 transition"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-teal-100 rounded-full flex items-center justify-center">
                              <svg
                                className="w-5 h-5 text-teal-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                                />
                              </svg>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {client.name}
                                </span>
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                                    client.enabled
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {client.enabled ? "enabled" : "disabled"}
                                </span>
                                {client.isSystemManaged && (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                                    system
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {client.description || (
                                  <span className="italic text-gray-400">
                                    No description
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5 font-mono">
                                {client.clientId.slice(0, 16)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {client.allowedAudiences.length > 0 ? (
                              client.allowedAudiences
                                .slice(0, 2)
                                .map((aud, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex px-2 py-1 text-xs font-mono bg-gray-100 text-gray-700 rounded"
                                  >
                                    {aud.length > 20
                                      ? `${aud.slice(0, 20)}...`
                                      : aud}
                                  </span>
                                ))
                            ) : (
                              <span className="text-xs text-gray-400 italic">
                                None
                              </span>
                            )}
                            {client.allowedAudiences.length > 2 && (
                              <span className="text-xs text-gray-500">
                                +{client.allowedAudiences.length - 2} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {client.permissions &&
                            client.permissions.length > 0 ? (
                              client.permissions.slice(0, 2).map((perm, i) => (
                                <span
                                  key={i}
                                  className={`inline-flex px-2 py-1 text-xs font-mono rounded ${
                                    perm.effect === "allow"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {perm.effect}: {perm.resource}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400 italic">
                                None
                              </span>
                            )}
                            {client.permissions &&
                              client.permissions.length > 2 && (
                                <span className="text-xs text-gray-500">
                                  +{client.permissions.length - 2} more
                                </span>
                              )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {client.expiresAt ? (
                            <TimeSinceComponent
                              timestamp={Math.floor(
                                new Date(client.expiresAt).getTime() / 1000,
                              )}
                            />
                          ) : (
                            <span className="text-gray-400 italic">Never</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <TimeSinceComponent
                            timestamp={Math.floor(
                              new Date(client.createdAt).getTime() / 1000,
                            )}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <Link
                            to={`/home/oauth/service-clients/${client.id}/`}
                            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View Details
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
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        {serviceClientsError ? (
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
                              Error loading service clients
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {serviceClientsError}
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
                            <p className="font-medium">
                              Loading service clients...
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </HomePageComponent>
    </PermissionGuardComponent>
  );
};

export default Component;
