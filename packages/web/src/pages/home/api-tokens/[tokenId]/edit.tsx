import { MouseEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { updateApiToken } from "../../../../api/api-tokens";
import { JobberPermissions } from "../../../../api/common";
import { HomePageComponent } from "../../../../components/home-page-component";
import { PermissionGuardComponent } from "../../../../components/permission-guard";
import { TimeSinceComponent } from "../../../../components/time-since-component";
import { useApiToken } from "../../../../hooks/use-api-token";

const STATUS_OPTIONS = [
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
];

const Component = () => {
  const tokenId = useParams().tokenId || "";

  const [payloadStatus, setPayloadStatus] = useState<
    "enabled" | "disabled" | null
  >(null);
  const [payloadPermissions, setPayloadPermissions] = useState<string | null>(
    null
  );
  const [payloadDescription, setPayloadDescription] = useState<string | null>(
    null
  );

  const { apiToken } = useApiToken(tokenId);

  const [_loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (apiToken) {
      setPayloadStatus(apiToken.status);
      setPayloadPermissions(JSON.stringify(apiToken.permissions, null, 2));
      setPayloadDescription(apiToken.description ?? "");
    }
  }, [apiToken]);

  const handleEditToken = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    setResult(null);
    setLoading(true);

    const payload: {
      permissions?: JobberPermissions;
      status?: "enabled" | "disabled";
      description?: string;
    } = {};

    if (payloadStatus) {
      payload.status = payloadStatus;
    }

    if (payloadPermissions) {
      try {
        payload.permissions = JSON.parse(payloadPermissions);
      } catch (error) {
        setResult({
          success: false,
          message: "Invalid permissions format. Please use valid JSON.",
        });
        setLoading(false);
        return;
      }
    }

    if (payloadDescription) {
      payload.description = payloadDescription;
    }

    const result = await updateApiToken(tokenId, payload);

    if (!result.success) {
      setResult({
        success: false,
        message: `Failed to update token: ${result.message}`,
      });
      setLoading(false);
      return;
    }

    setResult({
      success: true,
      message: "Token updated successfully",
    });
  };

  if (
    !apiToken ||
    payloadDescription === null ||
    payloadPermissions === null ||
    payloadStatus === null
  ) {
    return "Loading token...";
  }

  return (
    <PermissionGuardComponent resource={`api-tokens/${tokenId}`} action="write">
      <HomePageComponent title={`Edit Token ${apiToken.description}`}>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              to={`/home/api-tokens/${tokenId}`}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Token
            </Link>
          </div>

          {/* Single Token Edit Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {/* Token Header - matching view page */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Edit API Token
                  </h1>
                  <div className="text-sm text-gray-600 mt-1 font-mono">
                    {apiToken.id}
                  </div>
                </div>
              </div>
            </div>

            {/* Read-only Info */}
            <div className="px-6 py-4 border-b border-gray-200">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500 mb-1">Created</dt>
                  <dd className="text-gray-900">
                    <TimeSinceComponent
                      timestamp={Math.floor(
                        new Date(apiToken.created).getTime() / 1000
                      )}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 mb-1">Expires</dt>
                  <dd className="text-gray-900">
                    <TimeSinceComponent
                      timestamp={Math.floor(
                        new Date(apiToken.expires).getTime() / 1000
                      )}
                    />
                  </dd>
                </div>
              </dl>
            </div>

            {/* Edit Form Section */}
            <div className="px-6 py-6">
              <form className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={payloadStatus || ""}
                    onChange={(e) =>
                      setPayloadStatus(e.target.value as "enabled" | "disabled")
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={payloadDescription || ""}
                    onChange={(e) => setPayloadDescription(e.target.value)}
                    placeholder="Enter a description for this token"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Permissions (JSON)
                    <a
                      href="https://github.com/eithan1231/jobber/blob/main/docs/permissions.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                    >
                      View documentation →
                    </a>
                  </label>
                  <textarea
                    rows={20}
                    value={payloadPermissions || ""}
                    onChange={(e) => setPayloadPermissions(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 font-mono text-sm"
                    placeholder='[\n  {\n    "effect": "allow",\n    "actions": ["read"],\n    "resource": "*"\n  }\n]'
                  />
                </div>

                {result && (
                  <div
                    className={`rounded-lg p-4 ${
                      result.success
                        ? "bg-green-50 border border-green-200"
                        : "bg-red-50 border border-red-200"
                    }`}
                  >
                    <div className="flex items-start">
                      <svg
                        className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${
                          result.success ? "text-green-600" : "text-red-600"
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        {result.success ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        )}
                      </svg>
                      <p
                        className={`text-sm ${
                          result.success ? "text-green-800" : "text-red-800"
                        }`}
                      >
                        {result.message}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    onClick={(e) => handleEditToken(e)}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
                  >
                    Update Token
                  </button>
                  <Link
                    to={`/home/api-tokens/${tokenId}`}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </HomePageComponent>
    </PermissionGuardComponent>
  );
};

export default Component;
