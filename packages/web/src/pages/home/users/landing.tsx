import { Link } from "react-router-dom";
import { HomePageComponent } from "../../../components/home-page-component";
import { TimeSinceComponent } from "../../../components/time-since-component";
import { useUsers } from "../../../hooks/use-users";

const Component = () => {
  const { users, usersError, reloadUsers } = useUsers();

  return (
    <HomePageComponent title="Users">
      <div>
        <table>
          <thead>
            <tr>
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Permissions</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users ? (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="border-t px-4 py-2">{user.username}</td>
                  <td className="border-t px-4 py-2">
                    {user.permissions.map((perm) => (
                      <div key={perm.resource}>
                        {perm.effect} {perm.resource} ({perm.actions.join(", ")}
                        )
                      </div>
                    ))}
                  </td>
                  <td className="border-t px-4 py-2">
                    <TimeSinceComponent
                      timestamp={Math.floor(
                        new Date(user.created).getTime() / 1000
                      )}
                    />
                  </td>
                  <td className="border-t px-4 py-2">
                    <Link
                      to={`/home/users/${user.id}/`}
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
                  {usersError || "Loading..."}
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
