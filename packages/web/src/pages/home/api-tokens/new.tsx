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
      message: `Token created successfully. Token: ${result.data.token}`,
    });
  };

  return (
    <PermissionGuardComponent resource="api-tokens" action="write">
      <HomePageComponent title="New API Token">
        <div className="max-w-[800px]">
          <div className="border rounded shadow-md p-4 pb-5 m-2 bg-white">
            <h2 className="text-xl font-semibold mb-2">New API Token</h2>

            <form>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Period{" "}
                </label>
                <select
                  defaultValue={payloadTtl}
                  onChange={(e) => setPayloadTtl(Number(e.target.value))}
                  className="w-full p-2 border rounded bg-white text-gray-800"
                >
                  {TTL_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      selected={option.value === payloadTtl}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-4">
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Description{" "}
                </label>
                <input
                  required
                  type="text"
                  onChange={(e) => setPayloadDescription(e.target.value)}
                  className="w-full p-2 border rounded bg-white text-gray-800"
                />
              </div>
              <div className="mt-4">
                <label className="mb-2 text-sm font-medium text-gray-700">
                  Permissions
                  <span className="text-xs text-gray-500 ml-1">
                    (
                    <Link
                      to="https://github.com/eithan1231/jobber/blob/main/docs/permissions.md"
                      className="text-sm text-blue-500 hover:underline mb-2"
                    >
                      docs
                    </Link>
                    )
                  </span>
                </label>
                <textarea
                  rows={20}
                  defaultValue={payloadPermissions}
                  onChange={(e) => setPayloadPermissions(e.target.value)}
                  className="w-full p-2 border rounded bg-white text-gray-800"
                />
              </div>

              <div className="mt-4">
                {result && result.success && (
                  <div className="text-gray-600 mb-2">{result.message}</div>
                )}
                {result && !result.success && (
                  <div className="text-red-600 mb-2">{result.message}</div>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  onClick={(e) => handleCreateToken(e)}
                >
                  Create Token
                </button>
              </div>
            </form>
          </div>
        </div>
      </HomePageComponent>
    </PermissionGuardComponent>
  );
};

export default Component;
