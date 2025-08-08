import { Link, useParams } from "react-router-dom";
import { HomePageComponent } from "../../../../components/home-page-component";
import { TimeSinceComponent } from "../../../../components/time-since-component";
import { useApiToken } from "../../../../hooks/use-api-token";

const Component = () => {
  const { tokenId } = useParams();
  if (!tokenId) {
    return "Token ID is required";
  }

  const { apiToken, apiTokenError } = useApiToken(tokenId);

  if (!apiToken && !apiTokenError) {
    return "Loading token data data...";
  }

  if (apiTokenError || !apiToken) {
    return <div className="text-red-500">Error: {apiTokenError}</div>;
  }

  return (
    <HomePageComponent title="API Token Details">
      <div className="max-w-[800px]">
        <div className="border rounded shadow-md p-4 pb-5 m-2 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold mb-2">Token Details</h2>

            <Link
              to={`/home/api-tokens/${tokenId}/edit`}
              className="text-blue-500 hover:underline mt-0 p-0 top-0 block text-right"
            >
              Edit API Token
            </Link>
          </div>
          <table className="text-sm mt-4 w-full">
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
              <tr>
                <td className="text-gray-700 py-2 font-medium">Description</td>
                <td></td>
                <td className="text-gray-700 py-2 text-right">
                  {apiToken.description || "No description"}
                </td>
              </tr>

              {apiToken.permissions.length >= 1 && (
                <>
                  <tr>
                    <td className="pt-8 pb-1 font-bold text-gray-700 text-md ">
                      Permissions
                    </td>
                    <td className="pt-8 pb-1 font-bold text-gray-700 text-md ">
                      Actions
                    </td>
                    <td className="pt-8 pb-1 font-bold text-gray-700 text-md  text-right">
                      Resource
                    </td>
                  </tr>
                  {apiToken.permissions.map((permission, index) => (
                    <tr key={index}>
                      <td className="text-gray-700 py-2 font-medium">
                        {permission.effect === "allow" ? "Allow" : "Deny"}
                      </td>
                      <td className="text-gray-600 py-2 font-medium">
                        {permission.actions.join(", ")}
                      </td>

                      <td className="text-gray-700 py-2 font-medium text-right">
                        {permission.resource}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </HomePageComponent>
  );
};

export default Component;
