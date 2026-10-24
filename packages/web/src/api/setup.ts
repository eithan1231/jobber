import { JobberGenericResponse } from "./common";

export const createSetupRegister = async (
  username: string,
  password: string,
): Promise<JobberGenericResponse> => {
  const result = await fetch("/api/setup/register", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  return await result.json();
};
