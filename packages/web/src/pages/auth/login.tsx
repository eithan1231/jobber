import { useCallback, useState } from "react";
import { Link, RouteObject, useNavigate } from "react-router-dom";
import { createAuthLogin } from "../../api/auth";

const Component = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const result = await createAuthLogin(username, password);
      if (!result.success) {
        setMessage(result.message || "Registration failed");
        return;
      }

      await navigate("/home/");
    },
    [username, password]
  );

  return (
    <>
      <div className="h-screen w-screen bg-gray-900 justify-center items-center flex">
        <form
          className="flex-col w-96 bg-gray-800 rounded-lg text-white p-8"
          onSubmit={handleSubmit}
        >
          <h2 className="text-lg font-bold mb-2">Login</h2>

          <div className="mb-4">
            <label className="block text-sm mb-1" htmlFor="username">
              Username
            </label>
            <input
              autoFocus
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              type="text"
              id="username"
              className="w-full p-2 rounded bg-gray-700 text-white"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-1" htmlFor="password">
              Password
            </label>
            <input
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              type="password"
              id="password"
              className="w-full p-2 rounded bg-gray-700 text-white"
            />
          </div>
          {message && <div className="mb-4 text-red-500">{message}</div>}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Login
          </button>

          <div>
            <p className="mt-4 text-sm text-gray-400">
              Don't have an account?{" "}
              <Link
                to="/auth/register"
                className="text-blue-500 hover:underline"
              >
                Register here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </>
  );
};

export default {
  path: "/auth/login",
  Component,
} as RouteObject;
