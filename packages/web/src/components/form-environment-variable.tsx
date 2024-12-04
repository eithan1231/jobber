import { useEffect, useState } from "react";

export const FormEnvironmentVariableComponent = ({
  name,
  type,
  value,
  onSubmit,
}: {
  name: string;
  type: "text" | "secret";
  value: string;
  onSubmit: (payload: {
    name: string;
    value: string;
    type: "text" | "secret";
  }) => void;
}) => {
  const [nameInternal, setNameInternal] = useState<string>("");
  const [valueInternal, setValueInternal] = useState<string>("");
  const [typeInternal, setTypeInternal] = useState<"text" | "secret">("text");

  useEffect(() => {
    setNameInternal(name);
    setValueInternal(value);
    setTypeInternal(type);
  }, [name, type, value]);

  return (
    <div className="w-full bg-white border rounded shadow p-6 mb-6">
      <h2 className="text-lg font-medium text-gray-700 mb-4">
        Upsert Environment Variable
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();

          onSubmit({
            name: nameInternal,
            type: typeInternal,
            value: valueInternal,
          });

          if (typeInternal === "secret") {
            setValueInternal("");
          }
        }}
      >
        {/* Name Field */}
        <div className="mb-4">
          <label
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="name"
          >
            Variable Name
          </label>
          <input
            onChange={(e) => setNameInternal(e.target.value)}
            value={nameInternal}
            type="text"
            id="name"
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="e.g., API_KEY"
          />
        </div>

        {/* Type Field */}
        <div className="mb-4">
          <label
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="type"
          >
            Variable Type
          </label>
          <select
            onChange={(e) => {
              const value = e.target.value;

              if (value === "text" || value === "secret") {
                setTypeInternal(value);
              }
            }}
            value={typeInternal}
            id="type"
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="text">Text</option>
            <option value="secret">Secret</option>
          </select>
        </div>

        {/* Value Field */}
        <div className="mb-4">
          <label
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="value"
          >
            Variable Value
          </label>
          <input
            onChange={(e) => setValueInternal(e.target.value)}
            value={valueInternal}
            type="text"
            id="value"
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="e.g., MyApp"
          />
        </div>

        {/* Submit Button */}
        <div className="mt-6">
          <button
            type="submit"
            className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            Upsert Variable
          </button>
        </div>
      </form>
    </div>
  );
};
