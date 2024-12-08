import { RouteObject } from "react-router-dom";

export const Component = () => {
  return <div>Welcome! you should not be seeing me...</div>;
};

export const pagesLandingRoute: RouteObject = {
  path: "/",
  Component: Component,
};
