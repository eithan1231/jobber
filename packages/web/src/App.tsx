import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { CategoryScale } from "chart.js";
import Chart from "chart.js/auto";

import pageHome from "./pages/home/index";
import pageAuthRegister from "./pages/auth/register";
import pageAuthLogin from "./pages/auth/login";
import pageSetupLanding from "./pages/setup/landing";
import pageSpecial404 from "./pages/special/404";
import { AuthProvider } from "./contexts/auth-context";

Chart.register(CategoryScale);

const router = createBrowserRouter([
  pageHome,
  pageAuthRegister,
  pageAuthLogin,
  pageSetupLanding,
  pageSpecial404,
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
