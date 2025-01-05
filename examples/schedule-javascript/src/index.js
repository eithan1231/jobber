export const handler = async (request, response, context) => {
  if (request.type() !== "schedule") {
    throw new Error("This is a schedule job!");
  }

  // Logs can be seen in the admin panel
  console.log("I am a sample log!");

  // These can be configured in the admin panel!
  console.log("Env Var: ", process.env.EXAMPLE);

  return response;
};
