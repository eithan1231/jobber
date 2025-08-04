import { useNavigate, useParams } from "react-router-dom";
import { HomePageComponent } from "../../../../components/home-page-component";
import { useUser } from "../../../../hooks/use-user";
import { MouseEvent, useEffect, useState } from "react";
import { updateUser } from "../../../../api/users";
import { JobberPermissions } from "../../../../api/common";

const Component = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  if (!userId) {
    return "User ID is required";
  }

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
      setModifiedPermissions("");
    }
  }, [user]);

  const handleUpdateUser = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    setError(null);

    if (!user) {
      setError("User not found");
      return;
    }

    setLoading(true);

    // Handle user update logic here
    console.log("User updated:", {
      username: modifiedUsername,
      password: modifiedPassword,
      permissions: JSON.parse(modifiedPermissions),
    });

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
        setError("Invalid permissions format");
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
    return "Loading user data...";
  }

  if (userError || !user) {
    return <div className="text-red-500">Error: {userError}</div>;
  }

  return (
    <HomePageComponent title={`User ${user.username}`}>
      <div className="max-w-[800px]">
        <div className="border rounded shadow-md p-4 pb-5 m-2 bg-white">
          <h2 className="text-xl font-semibold mb-2">User Details</h2>

          <form>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Username{" "}
                <span
                  hidden={modifiedUsername === user.username}
                  className="text-xs font-small text-red-400"
                >
                  (updated)
                </span>
              </label>
              <input
                type="text"
                defaultValue={user.username}
                onChange={(e) => setModifiedUsername(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Update username"
              />
            </div>

            <div className="mt-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Password{" "}
                <span
                  hidden={!modifiedPassword}
                  className="text-xs font-small text-red-400"
                >
                  (updated)
                </span>
              </label>
              <input
                type="password"
                value={modifiedPassword}
                onChange={(e) => setModifiedPassword(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Update password"
              />
            </div>

            <div className="mt-4">
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Permissions{" "}
                <span
                  hidden={!modifiedPassword}
                  className="text-xs font-small text-red-400"
                >
                  (updated)
                </span>
              </label>
              <textarea
                rows={20}
                defaultValue={JSON.stringify(user.permissions, null, 2)}
                onChange={(e) => setModifiedPermissions(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>

            <div className="mt-4">
              {error && <div className="text-red-600 mb-2">{error}</div>}

              <button
                type="submit"
                className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                onClick={(e) => handleUpdateUser(e)}
              >
                Update User
              </button>
            </div>
          </form>
        </div>
      </div>
    </HomePageComponent>
  );
};

export default Component;
