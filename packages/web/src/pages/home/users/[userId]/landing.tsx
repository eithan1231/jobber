import { Link, useParams } from "react-router-dom";
import { HomePageComponent } from "../../../../components/home-page-component";
import { TimeSinceComponent } from "../../../../components/time-since-component";
import { useUser } from "../../../../hooks/use-user";
import { PermissionGuardComponent } from "../../../../components/permission-guard";
import { PermissionsListComponent } from "../../../../components/permissions-list-component";

const Component = () => {
  const userId = useParams().userId ?? "";

  const { user, userError } = useUser(userId);

  if (!user && !userError) {
    return (
      <HomePageComponent title="User">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 text-lg">Loading user...</div>
        </div>
      </HomePageComponent>
    );
  }

  if (userError || !user) {
    return (
      <HomePageComponent title="User">
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-600 font-medium">Error loading user</div>
          <div className="text-red-500 text-sm mt-1">{userError}</div>
        </div>
      </HomePageComponent>
    );
  }

  return (
    <PermissionGuardComponent resource={`user/${user.id}`} action="read">
      <HomePageComponent title={`User: ${user.username}`}>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Header with Back and Edit buttons */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/home/users"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Users
            </Link>
            <PermissionGuardComponent
              resource={`user/${user.id}`}
              action="write"
            >
              <Link
                to={`/home/users/${userId}/edit`}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Edit User
              </Link>
            </PermissionGuardComponent>
          </div>

          {/* User Info Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {/* Header with Avatar */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-8 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {user.username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {user.username}
                  </h1>
                  <div className="text-sm text-gray-600 mt-1">
                    User ID: <span className="font-mono">{user.id}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* User Details */}
            <div className="px-6 py-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Details
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Username</div>
                  <div className="text-gray-900 font-medium">
                    {user.username}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Created</div>
                  <div className="text-gray-900">
                    <TimeSinceComponent
                      timestamp={Math.floor(
                        new Date(user.created).getTime() / 1000
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Permissions Section */}
            {user.permissions.length > 0 && (
              <div className="px-6 py-6 border-t border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Permissions
                </h2>
                <PermissionsListComponent permissions={user.permissions} />
              </div>
            )}

            {user.permissions.length === 0 && (
              <div className="px-6 py-6 border-t border-gray-200">
                <div className="text-sm text-gray-500 italic">
                  No permissions assigned
                </div>
              </div>
            )}
          </div>
        </div>
      </HomePageComponent>
    </PermissionGuardComponent>
  );
};

export default Component;
