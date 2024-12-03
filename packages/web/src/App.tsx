import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { pagesLandingRoute } from "./pages/landing";
import { pagesJobberLandingRoute } from "./pages/jobber/landing";
import { pagesJobberJobRoute } from "./pages/jobber/[jobName]/landing";
import { pagesJobberJobLogsRoute } from "./pages/jobber/[jobName]/logs";
import { pagesJobberJobEnvironmentRoute } from "./pages/jobber/[jobName]/environment";

const router = createBrowserRouter([
  pagesLandingRoute,
  pagesJobberLandingRoute,
  pagesJobberJobRoute,
  pagesJobberJobLogsRoute,
  pagesJobberJobEnvironmentRoute,
]);

function App() {
  return <RouterProvider router={router} fallbackElement={<p>Loading...</p>} />;
}

export default App;
