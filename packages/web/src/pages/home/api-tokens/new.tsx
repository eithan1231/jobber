import { MouseEvent, useState } from "react";
import { Link } from "react-router-dom";
import { createApiToken } from "../../../api/api-tokens";
import { JobberPermissions } from "../../../api/common";
import { HomePageComponent } from "../../../components/home-page-component";
import { PermissionGuardComponent } from "../../../components/permission-guard";

const TTL_OPTIONS = [
  { value: 300, label: "5 minutes" },
  { value: 3600, label: "1 hour" },
  { value: 86400, label: "1 day" },
  { value: 604800, label: "1 week" },
  { value: 2592000, label: "30 days" },
  { value: 7776000, label: "90 days" },
  { value: 31536000, label: "1 year" },
  { value: 157680000, label: "5 years" },
];

const DEFAULT_PERMISSIONS: JobberPermissions = [
  {
    resource: "*",
    effect: "allow",
    actions: ["read", "write", "delete"],
  },
];

const Component = () => {
  const [payloadTtl, setPayloadTtl] = useState(TTL_OPTIONS[5].value);
  const [payloadPermissions, setPayloadPermissions] = useState(
    JSON.stringify(DEFAULT_PERMISSIONS, null, 2)
  );
  const [payloadDescription, setPayloadDescription] = useState("");

  const [_loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    token?: string;
  } | null>(null);

  const handleCreateToken = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    setResult(null);
    setLoading(true);

    if (isNaN(payloadTtl) || payloadTtl <= 0) {
      setResult({
        success: false,
        message: "Invalid TTL value",
      });
      setLoading(false);
      return;
    }

    let parsedPermissions: JobberPermissions;
    try {
      parsedPermissions = JSON.parse(payloadPermissions);
    } catch (error) {
      setResult({
        success: false,
        message:
          "Invalid permissions format. Please provide a valid JSON array.",
      });
      setLoading(false);
      return;
    }

    const result = await createApiToken(
      parsedPermissions,
      payloadDescription,
      payloadTtl
    );

    if (!result.success) {
      setResult({
        success: false,
        message: `Failed to create token: ${result.message}`,
      });
      setLoading(false);
      return;
    }

    setResult({
      success: true,
      message: "Token created successfully",
      token: result.data.token,
    });
  };

  return (
    <PermissionGuardComponent resource="api-tokens" action="write">
      <HomePageComponent title="New API Token">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/home/api-tokens"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Tokens
            </Link>
          </div>

          {/* Single Token Create Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {/* Token Header */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-6 border-b border-gray-200">
              <h1 className="text-xl font-bold text-gray-900">
                Create API Token
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Generate a new API token with custom permissions
              </p>
            </div>

            {/* Success Message */}
            {result && result.success && (
              <div className="mx-6 mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-green-900 font-semibold text-sm mb-2">
                      Token Created Successfully!
                    </h3>
                    <p className="text-green-800 text-sm mb-3">
                      Make sure to copy it now as you won't be able to see it
                      again.
                    </p>
                    <div className="bg-white border border-green-300 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-green-700 uppercase">
                          Your Token
                        </span>
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(result.token || "")
                          }
                          className="text-xs text-green-700 hover:text-green-900 font-medium flex items-center gap-1"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          Copy
                        </button>
                      </div>
                      <code className="block text-sm font-mono text-gray-900 break-all bg-gray-50 px-3 py-2 rounded border border-gray-200">
                        {result.token}
                      </code>
                    </div>
                    <div className="mt-3">
                      <Link
                        to="/home/api-tokens"
                        className="inline-flex items-center text-green-700 hover:text-green-900 font-medium text-sm"
                      >
                        View all tokens
                        <svg
                          className="w-4 h-4 ml-1"
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
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form Section */}
            <div className="px-6 py-6">
              <form className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={payloadDescription}
                    onChange={(e) => setPayloadDescription(e.target.value)}
                    placeholder="e.g., Production API access for CI/CD"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiration Period
                  </label>
                  <select
                    value={payloadTtl}
                    onChange={(e) => setPayloadTtl(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  >
                    {TTL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
                    value={payloadPermissions}
                    onChange={(e) => setPayloadPermissions(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 font-mono text-sm"
                    placeholder='[\n  {\n    "effect": "allow",\n    "actions": ["read"],\n    "resource": "*"\n  }\n]'
                  />
                </div>

                {result && !result.success && (
                  <div className="rounded-lg p-4 bg-red-50 border border-red-200">
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 mt-0.5 mr-3 flex-shrink-0 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-sm text-red-800">{result.message}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    onClick={(e) => handleCreateToken(e)}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
                  >
                    Create Token
                  </button>
                  <Link
                    to="/home/api-tokens"
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
