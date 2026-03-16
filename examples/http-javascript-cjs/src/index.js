// ew 20015 called and asked for its javascript back

const path = require("path");

exports.handlerHttp = async (context) => {
  const host = context.request.header("host");

  return context.response.text(
    `path.join example from commonjs: ${path.join("foo", "bar")}`,
  );
};
