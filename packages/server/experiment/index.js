export const handler = async (req, res) => {
  if (req.type() === "http") {
    return res.json({ hello: req.type() });
  }

  return {
    hello: req.type(),
  };
};
