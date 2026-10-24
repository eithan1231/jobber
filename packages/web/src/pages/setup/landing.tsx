import { useCallback, useContext, useEffect, useState } from "react";
import { RouteObject, useNavigate } from "react-router-dom";
import { AuthContext } from "../../contexts/auth-context";
import { useConfig } from "../../hooks/use-config";
import { createSetupRegister } from "../../api/setup";

const STEPS = [
  { key: "registration", label: "Admin account" },
  { key: "setup", label: "System Setup" },
] as const;

const Component = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const { config } = useConfig();

  const step: (typeof STEPS)[number]["key"] = "registration";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (config && config.jobberSetup) {
      // navigate("/auth/login");
    }
  }, [config]);

  const handleSubmitRegistration = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const result = await createSetupRegister(username, password);
      if (!result.success) {
        setMessage(result.message || "Failed to create admin account.");
        return;
      }

      const loginResult = await login(username, password);
      if (!loginResult.success) {
        setMessage(loginResult.message || "Failed to sign in.");
        return;
      }

      await navigate("/home/");
    },
    [username, password],
  );

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Jobber</h1>
          <p className="text-gray-600">Let's get your instance set up</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((s, index) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= stepIndex
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-10 h-0.5 ${
                    index < stepIndex ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Setup Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {step === "registration" && (
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  Create your admin account
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  This account will have full access to manage this instance.
                </p>
              </div>

              {/* Form */}
              <form
                className="px-6 py-6 space-y-6"
                onSubmit={handleSubmitRegistration}
              >
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    htmlFor="username"
                  >
                    Username
                  </label>
                  <input
                    autoFocus
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    type="text"
                    id="username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 mb-2"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <input
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a password"
                    type="password"
                    id="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                </div>

                {message && (
                  <div className="rounded-lg p-4 bg-red-50 border border-red-200">
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-sm text-red-800">{message}</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
                >
                  Continue
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default {
  path: "/setup",
  Component,
} as RouteObject;
