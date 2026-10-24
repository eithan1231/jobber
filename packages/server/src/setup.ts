import { userModel } from "./db/user.js";

export async function hasSystemSetup(): Promise<Boolean> {
  const userCount = await userModel.count();

  return userCount > 0;
}
