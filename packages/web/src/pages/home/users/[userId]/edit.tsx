import { MouseEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { JobberPermissions } from "../../../../api/common";
import { updateUser } from "../../../../api/users";
import { HomePageComponent } from "../../../../components/home-page-component";
import { PermissionGuardComponent } from "../../../../components/permission-guard";
import { useUser } from "../../../../hooks/use-user";

const Component = () => {
  const userId = useParams().userId ?? "";
  const navigate = useNavigate();

  const [modifiedUsername, setModifiedUsername] = useState("");
  const [modifiedPassword, setModifiedPassword] = useState("");
  const [modifiedPermissions, setModifiedPermissions] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, userError } = useUser(userId);

  useEffect(() => {
    setModifiedUsername(user?.username || "");
    setModifiedPassword("");

    if (user?.permissions) {
      setModifiedPermissions(JSON.stringify(user.permissions, null, 2));
    } else {
      setModifiedPermissions("[]");
    }
  }, [user]);

  const handleUpdateUser = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    setError(null);

    if (!user) {
      setError("User not found");
      return;
    }

    if (!modifiedUsername.trim()) {
      setError("Username is required");
      return;
    }

    setLoading(true);

    const payload: {
      username?: string;
      password?: string;
      permissions?: JobberPermissions;
    } = {};

    if (modifiedUsername !== user.username) {
      payload.username = modifiedUsername;
    }

    if (modifiedPassword) {
      payload.password = modifiedPassword;
    }

    if (modifiedPermissions) {
      try {
        payload.permissions = JSON.parse(modifiedPermissions);
      } catch (e) {
        setError("Invalid permissions JSON format");
        setLoading(false);
        return;
      }
    }

    const result = await updateUser(userId, payload);

    if (!result.success) {
      setError(`Failed to update user: ${result.message}`);
      setLoading(false);
      return;
    }

    await navigate(`/home/users/${userId}/`);
  };

  if (!user && !userError) {
    return (
      <HomePageComponent title="Edit User">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 text-lg">Loading user...</div>
        </div>
      </HomePageComponent>
    );
  }

  if (userError || !user) {
    return (
      <HomePageComponent title="Edit User">
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-600 font-medium">Error loading user</div>
          <div className="text-red-500 text-sm mt-1">{userError}</div>
        </div>
      </HomePageComponent>
    );
  }

  return (
    <PermissionGuardComponent resource={`user/${userId}`} action="write">
      <HomePageComponent title={`Edit User: ${user.username}`}>
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Header with Back button */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              to={`/home/users/${userId}`}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to User
            </Link>
          </div>

          {/* User Info Card with Avatar - matching view page */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
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

            {/* Edit Form - seamlessly merged */}
            <form className="px-6 py-6 space-y-6">
              {/* Username Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username <span className="text-red-500">*</span>
                  {modifiedUsername !== user.username && (
                    <span className="ml-2 text-xs text-orange-600 font-normal">
                      (modified)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={modifiedUsername}
                  onChange={(e) => setModifiedUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter username"
                  required
                />
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                  {modifiedPassword && (
                    <span className="ml-2 text-xs text-orange-600 font-normal">
                      (will be updated)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={modifiedPassword}
                  onChange={(e) => setModifiedPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave blank to keep current password"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Only enter a password if you want to change it
                </p>
              </div>

              {/* Permissions Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permissions (JSON)
                  <a
                    href="https://github.com/eithan1231/jobber/blob/main/docs/permissions.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs text-blue-600 hover:text-blue-700"
                  >
                    View docs ↗
                  </a>
                  {modifiedPermissions !==
                    JSON.stringify(user.permissions, null, 2) && (
                    <span className="ml-2 text-xs text-orange-600 font-normal">
                      (modified)
                    </span>
                  )}
                </label>
                <textarea
                  rows={20}
                  value={modifiedPermissions}
                  onChange={(e) => setModifiedPermissions(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder='[{"effect": "allow", "resource": "*", "actions": ["*"]}]'
                />
                <p className="mt-1 text-xs text-gray-500">
                  Must be valid JSON array of permission objects
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-red-600 text-sm font-medium">
                    {error}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={(e) => handleUpdateUser(e)}
                  disabled={loading}
                >
                  {loading ? "Updating..." : "Update User"}
                </button>
                <Link
                  to={`/home/users/${userId}`}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </HomePageComponent>
    </PermissionGuardComponent>
  );
};

export default Component;
