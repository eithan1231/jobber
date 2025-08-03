import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { CategoryScale } from "chart.js";
import Chart from "chart.js/auto";

import pageHome from "./pages/home/index";
import pageAuthRegister from "./pages/auth/register";
import pageAuthLogin from "./pages/auth/login";

Chart.register(CategoryScale);

const router = createBrowserRouter([pageHome, pageAuthRegister, pageAuthLogin]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
