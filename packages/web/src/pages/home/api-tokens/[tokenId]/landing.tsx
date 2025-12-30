import { Link, useParams } from "react-router-dom";
import { HomePageComponent } from "../../../../components/home-page-component";
import { TimeSinceComponent } from "../../../../components/time-since-component";
import { PermissionsListComponent } from "../../../../components/permissions-list-component";
import { useApiToken } from "../../../../hooks/use-api-token";
import { PermissionGuardComponent } from "../../../../components/permission-guard";

const Component = () => {
  const tokenId = useParams().tokenId || "";

  const { apiToken, apiTokenError } = useApiToken(tokenId);

  if (!apiToken && !apiTokenError) {
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

  if (apiTokenError || !apiToken) {
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
            <p className="font-medium text-red-900">Error loading API token</p>
            <p className="text-sm text-red-700 mt-1">{apiTokenError}</p>
          </div>
        </div>
      </HomePageComponent>
    );
  }

  return (
    <PermissionGuardComponent resource={`api-tokens/${tokenId}`} action="read">
      <HomePageComponent title={`API Token ${apiToken.description}`}>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/home/api-tokens"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Tokens
            </Link>
            <PermissionGuardComponent
              resource={`api-tokens/${tokenId}`}
              action="write"
            >
              <Link
                to={`/home/api-tokens/${tokenId}/edit`}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Edit Token
              </Link>
            </PermissionGuardComponent>
          </div>

          {/* Single Token Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {/* Token Header */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">API Token</h1>
                  <div className="text-sm text-gray-600 mt-1 font-mono">
                    {apiToken.id}
                  </div>
                </div>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded ${
                    apiToken.status === "enabled"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {apiToken.status}
                </span>
              </div>
            </div>

            {/* Token Details */}
            <div className="px-6 py-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Details
              </h2>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Created</dt>
                  <dd className="text-sm text-gray-900">
                    <TimeSinceComponent
                      timestamp={Math.floor(
                        new Date(apiToken.created).getTime() / 1000
                      )}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Expires</dt>
                  <dd className="text-sm text-gray-900">
                    <TimeSinceComponent
                      timestamp={Math.floor(
                        new Date(apiToken.expires).getTime() / 1000
                      )}
                    />
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-sm text-gray-500 mb-1">Description</dt>
                  <dd className="text-sm text-gray-900">
                    {apiToken.description || (
                      <span className="italic text-gray-400">
                        No description provided
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Permissions */}
            <div className="px-6 py-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Permissions
              </h2>
              {apiToken.permissions.length > 0 ? (
                <PermissionsListComponent permissions={apiToken.permissions} />
              ) : (
                <div className="text-sm text-gray-500 italic">
                  No permissions assigned
                </div>
              )}
            </div>
          </div>
        </div>
      </HomePageComponent>
    </PermissionGuardComponent>
  );
};

export default Component;
