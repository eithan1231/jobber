import { Link } from "react-router-dom";
import { HomePageComponent } from "../../../../components/home-page-component";
import { PermissionGuardComponent } from "../../../../components/permission-guard";
import { TimeSinceComponent } from "../../../../components/time-since-component";
import { useSigningKeys } from "../../../../hooks/use-signing-keys";

const Component = () => {
  const { signingKeys, signingKeysError } = useSigningKeys();

  return (
    <PermissionGuardComponent resource="oauth/signing-key" action="read">
      <HomePageComponent title="OAuth Signing Keys">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                OAuth Signing Keys
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage JWT signing keys for OAuth authentication
              </p>
            </div>
          </div>

          {/* JWKS Endpoint Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-blue-900">
                  Public JWKS Endpoint
                </h3>
                <p className="text-sm text-blue-800 mt-1">
                  Active public keys are available at:{" "}
                  <a
                    href="/.well-known/jwks.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono underline hover:text-blue-600"
                  >
                    /.well-known/jwks.json
                  </a>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Use this endpoint to verify JWT tokens issued by this server.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Algorithm
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Use
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
                  {signingKeys ? (
                    signingKeys.map((key) => (
                      <tr key={key.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                              <svg
                                className="w-5 h-5 text-indigo-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                                    key.status === "active"
                                      ? "bg-green-100 text-green-800"
                                      : key.status === "inactive"
                                        ? "bg-gray-100 text-gray-800"
                                        : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {key.status}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                ID: {key.id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-mono font-medium bg-gray-100 text-gray-700 rounded">
                            {key.alg}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {key.use === "sig" ? "Signature" : "Encryption"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {key.expiresAt ? (
                            <TimeSinceComponent
                              timestamp={Math.floor(
                                new Date(key.expiresAt).getTime() / 1000,
                              )}
                            />
                          ) : (
                            <span className="text-gray-400 italic">Never</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <TimeSinceComponent
                            timestamp={Math.floor(
                              new Date(key.createdAt).getTime() / 1000,
                            )}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <Link
                            to={`/home/oauth/signing-keys/${key.id}/`}
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
                        {signingKeysError ? (
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
                              Error loading signing keys
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {signingKeysError}
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
                              Loading signing keys...
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
