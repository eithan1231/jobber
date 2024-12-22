import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { pagesLandingRoute } from "./pages/landing";
import { pagesJobberLandingRoute } from "./pages/jobber/landing";
import { pagesJobberJobRoute } from "./pages/jobber/[jobId]/landing";
import { pagesJobberJobLogsRoute } from "./pages/jobber/[jobId]/logs";
import { pagesJobberJobEnvironmentRoute } from "./pages/jobber/[jobId]/environment";
import { pagesJobberJobActionsRoute } from "./pages/jobber/[jobId]/actions";
import { pagesJobberJobTriggersRoute } from "./pages/jobber/[jobId]/triggers";

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
