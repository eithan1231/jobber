import { useEffect } from "react";
import { Link, RouteObject, useLocation, useNavigate } from "react-router-dom";

const Component = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (pathname.startsWith("/jobber/")) {
      const matchResult = pathname.match(/^\/jobber\/([a-z0-9-]{0,64})/);
      const jobberId = matchResult ? matchResult[1] : null;

      if (!jobberId) {
        navigate("/home");
        return;
      }

      if (pathname.endsWith("/metrics")) {
        navigate(`/home/job/${jobberId}/metrics`);
        return;
      }

      if (pathname.endsWith("/logs")) {
        navigate(`/home/job/${jobberId}/logs`);
        return;
      }

      if (pathname.endsWith("/environment")) {
        navigate(`/home/job/${jobberId}/environment`);
        return;
      }

      if (pathname.endsWith("/store")) {
        navigate(`/home/job/${jobberId}/store`);
        return;
      }

      navigate(`/home/job/${jobberId}`);
      return;
    }
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-gray-600 mb-6">
          The page you are looking for does not exist.
        </p>
        <Link
          to={"/home/"}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
};

export default {
  path: "*",
  Component: Component,
} as RouteObject;
