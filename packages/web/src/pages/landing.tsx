import { RouteObject } from "react-router-dom";

export const pagesLandingComponent = () => {
  return <div>Welcome! you should not be seeing me...</div>;
};

export const pagesLandingRoute: RouteObject = {
  path: "/",
  Component: pagesLandingComponent,
};
