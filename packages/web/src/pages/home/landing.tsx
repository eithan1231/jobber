import { HomePageComponent } from "../../components/home-page-component";
import { useAuth } from "../../hooks/use-auth";

const Component = () => {
  const { auth } = useAuth();

  return (
    <HomePageComponent title="Homepage">
      <>
        <p className="text-lg text-gray-700">Welcome to Jobber!</p>
        {auth?.user?.username ?? "Guest"}
      </>
    </HomePageComponent>
  );
};

export default Component;
