import { MouseEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { updateApiToken } from "../../../../api/api-tokens";
import { JobberPermissions } from "../../../../api/common";
import { HomePageComponent } from "../../../../components/home-page-component";
import { TimeSinceComponent } from "../../../../components/time-since-component";
import { useApiToken } from "../../../../hooks/use-api-token";

const STATUS_OPTIONS = [
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
];

const Component = () => {
  const { tokenId } = useParams();
  if (!tokenId) {
    return "Token ID is required";
  }

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
      payload.status = payloadStatus as "enabled" | "disabled";
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
    <HomePageComponent title="Update API Token">
      <div className="max-w-[800px]">
        <div className="border rounded shadow-md p-4 pb-5 m-2 bg-white">
          <h2 className="text-xl font-semibold mb-2">Update API Token</h2>

          <table className="text-sm mt-4 w-full border-b">
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="text-gray-700 py-2 font-medium">ID</td>
                <td></td>
                <td className="text-gray-700 py-2 text-right">{apiToken.id}</td>
              </tr>
              <tr>
                <td className="text-gray-700 py-2 font-medium">Expires</td>
                <td></td>
                <td className="text-gray-700 py-2 text-right">
                  <TimeSinceComponent
                    timestamp={Math.floor(
                      new Date(apiToken.expires).getTime() / 1000
                    )}
                  />
                </td>
              </tr>
              <tr>
                <td className="text-gray-700 py-2 font-medium">Created</td>
                <td></td>
                <td className="text-gray-700 py-2 text-right">
                  <TimeSinceComponent
                    timestamp={Math.floor(
                      new Date(apiToken.created).getTime() / 1000
                    )}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <form className="mt-12">
            <div className="mt-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                onChange={(e) =>
                  setPayloadStatus(e.target.value as "enabled" | "disabled")
                }
                className="w-full p-2 border rounded bg-white text-gray-800"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    selected={option.value === payloadStatus}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Description
              </label>
              <input
                type="text"
                defaultValue={payloadDescription}
                onChange={(e) => setPayloadDescription(e.target.value)}
                className="w-full p-2 border rounded bg-white text-gray-800"
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 text-sm font-medium text-gray-700">
                Permissions{" "}
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
                onClick={(e) => handleEditToken(e)}
              >
                Update Token
              </button>
            </div>
          </form>
        </div>
      </div>
    </HomePageComponent>
  );
};

export default Component;
