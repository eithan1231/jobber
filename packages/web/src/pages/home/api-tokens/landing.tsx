import { Link } from "react-router-dom";
import { HomePageComponent } from "../../../components/home-page-component";
import { TimeSinceComponent } from "../../../components/time-since-component";
import { useApiTokens } from "../../../hooks/use-api-tokens";

const Component = () => {
  const { apiTokens, apiTokensError } = useApiTokens();

  return (
    <HomePageComponent title="API Tokens">
      <div>
        <table>
          <thead>
            <tr>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Permissions</th>
              <th className="px-4 py-2">Expires</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {apiTokens ? (
              apiTokens.map((token) => (
                <tr key={token.id}>
                  <td className="border-t px-4 py-2">
                    {token.status === "enabled" ? "Enabled" : "Disabled"}
                  </td>
                  <td className="border-t px-4 py-2">
                    {token.permissions.map((perm) => (
                      <div key={perm.resource}>
                        {perm.effect} {perm.resource} ({perm.actions.join(", ")}
                        )
                      </div>
                    ))}
                  </td>
                  <td className="border-t px-4 py-2">
                    <TimeSinceComponent
                      timestamp={Math.floor(
                        new Date(token.expires).getTime() / 1000
                      )}
                    />
                  </td>
                  <td className="border-t px-4 py-2">
                    <TimeSinceComponent
                      timestamp={Math.floor(
                        new Date(token.created).getTime() / 1000
                      )}
                    />
                  </td>
                  <td className="border-t px-4 py-2">
                    <Link
                      to={`/home/api-tokens/${token.id}/`}
                      className="text-blue-500 hover:underline"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center">
                  {apiTokensError || "Loading..."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </HomePageComponent>
  );
};

export default Component;
