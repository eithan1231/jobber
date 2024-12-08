import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { pagesLandingRoute } from "./pages/landing";
import { pagesJobberLandingRoute } from "./pages/jobber/landing";
import { pagesJobberJobRoute } from "./pages/jobber/[jobName]/landing";
import { pagesJobberJobLogsRoute } from "./pages/jobber/[jobName]/logs";
import { pagesJobberJobEnvironmentRoute } from "./pages/jobber/[jobName]/environment";
import { pagesJobberJobActionsRoute } from "./pages/jobber/[jobName]/actions";
import { pagesJobberJobTriggersRoute } from "./pages/jobber/[jobName]/triggers";

const router = createBrowserRouter([
  pagesLandingRoute,
  pagesJobberLandingRoute,
  pagesJobberJobRoute,
  pagesJobberJobLogsRoute,
  pagesJobberJobEnvironmentRoute,
  pagesJobberJobActionsRoute,
  pagesJobberJobTriggersRoute,
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
