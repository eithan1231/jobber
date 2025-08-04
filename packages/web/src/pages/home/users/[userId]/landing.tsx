import { Link, useParams } from "react-router-dom";
import { HomePageComponent } from "../../../../components/home-page-component";
import { TimeSinceComponent } from "../../../../components/time-since-component";
import { useUser } from "../../../../hooks/use-user";

const Component = () => {
  const { userId } = useParams();
  if (!userId) {
    return "User ID is required";
  }

  const { user, userError } = useUser(userId);

  if (!user && !userError) {
    return "Loading user data...";
  }

  if (userError || !user) {
    return <div className="text-red-500">Error: {userError}</div>;
  }

  return (
    <HomePageComponent title={`User ${user.username}`}>
      <div className="max-w-[800px]">
        <div className="border rounded shadow-md p-4 pb-5 m-2 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold mb-2">User Details</h2>

            <Link
              to={`/home/users/${userId}/edit`}
              className="text-blue-500 hover:underline mt-0 p-0 top-0 block text-right"
            >
              Edit User
            </Link>
          </div>
          <table className="text-sm mt-4 w-full">
            <tbody className="divide-y divide-gray-200">
              <tr className="">
                <td className="text-gray-700 py-2 font-medium">Username</td>
                <td></td>
                <td className="text-gray-700 py-2 text-right">
                  {user.username}
                </td>
              </tr>
              <tr className="">
                <td className="text-gray-700 py-2 font-medium">Created</td>
                <td></td>
                <td className="text-gray-700 py-2 text-right">
                  <TimeSinceComponent
                    timestamp={Math.floor(
                      new Date(user.created).getTime() / 1000
                    )}
                  />
                </td>
              </tr>

              {user.permissions.length >= 1 && (
                <>
                  <tr className="">
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
                  {user.permissions.map((permission, index) => (
                    <tr key={index} className="">
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
