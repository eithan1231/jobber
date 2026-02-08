import { Link, useParams } from "react-router-dom";
import { HomePageComponent } from "../../../../../components/home-page-component";
import { TimeSinceComponent } from "../../../../../components/time-since-component";
import { useServiceClient } from "../../../../../hooks/use-service-client";
import { PermissionGuardComponent } from "../../../../../components/permission-guard";

const Component = () => {
  const serviceClientId = useParams().serviceClientId || "";

  const { serviceClient, serviceClientError } =
    useServiceClient(serviceClientId);

  if (!serviceClient && !serviceClientError) {
    return (
      <HomePageComponent title="Loading...">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-12">
            <svg
              className="h-12 w-12 text-gray-400 animate-spin"
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
          </div>
        </div>
      </HomePageComponent>
    );
  }

  if (serviceClientError || !serviceClient) {
    return (
      <HomePageComponent title="Error">
        <div className="container mx-auto px-4 py-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
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
            <p className="font-medium text-red-900">
              Error loading service client
            </p>
            <p className="text-sm text-red-700 mt-1">{serviceClientError}</p>
          </div>
        </div>
      </HomePageComponent>
    );
  }

  return (
    <PermissionGuardComponent
      resource={`oauth/service-client/${serviceClientId}`}
      action="read"
    >
      <HomePageComponent title={`Service Client: ${serviceClient.name}`}>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/home/oauth/service-clients/"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Service Clients
            </Link>
          </div>

          {/* Single Client Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {/* Client Header */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 px-6 py-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {serviceClient.name}
                  </h1>
                  <div className="text-sm text-gray-600 mt-1">
                    {serviceClient.description || (
                      <span className="italic text-gray-400">
                        No description
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex px-3 py-1 text-sm font-semibold rounded ${
                      serviceClient.enabled
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {serviceClient.enabled ? "enabled" : "disabled"}
                  </span>
                  {serviceClient.isSystemManaged && (
                    <span className="inline-flex px-3 py-1 text-sm font-semibold rounded bg-blue-100 text-blue-800">
                      system managed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Client Details */}
            <div className="px-6 py-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Details
              </h2>
              <dl className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <dt className="text-sm text-gray-500 mb-1">Client ID</dt>
                  <dd className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border">
                    {serviceClient.clientId}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Created</dt>
                  <dd className="text-sm text-gray-900">
                    <TimeSinceComponent
                      timestamp={Math.floor(
                        new Date(serviceClient.createdAt).getTime() / 1000,
                      )}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Expires</dt>
                  <dd className="text-sm text-gray-900">
                    {serviceClient.expiresAt ? (
                      <TimeSinceComponent
                        timestamp={Math.floor(
                          new Date(serviceClient.expiresAt).getTime() / 1000,
                        )}
                      />
                    ) : (
                      <span className="text-gray-400 italic">Never</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Allowed Audiences */}
            <div className="px-6 py-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Allowed Audiences
              </h2>
              {serviceClient.allowedAudiences.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {serviceClient.allowedAudiences.map((aud, i) => (
                    <span
                      key={i}
                      className="inline-flex px-3 py-1.5 text-sm font-mono bg-gray-100 text-gray-700 rounded-lg"
                    >
                      {aud}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No audiences configured
                </p>
              )}
            </div>

            {/* Allowed Scopes */}
            <div className="px-6 py-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Allowed Scopes
              </h2>
              {serviceClient.allowedScopes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {serviceClient.allowedScopes.map((scope, i) => (
                    <span
                      key={i}
                      className="inline-flex px-3 py-1.5 text-sm font-mono bg-purple-100 text-purple-700 rounded-lg"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No scopes configured
                </p>
              )}
            </div>

            {/* Permissions */}
            <div className="px-6 py-6">
              <div className="flex items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Permissions
                </h2>
                <a
                  href="https://github.com/eithan1231/jobber/blob/main/docs/permissions.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  View documentation →
                </a>
              </div>
              {serviceClient.permissions &&
              serviceClient.permissions.length > 0 ? (
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm font-mono text-gray-800 overflow-x-auto">
                  {JSON.stringify(serviceClient.permissions, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No permissions configured
                </p>
              )}
            </div>
          </div>
        </div>
      </HomePageComponent>
    </PermissionGuardComponent>
  );
};

export default Component;
