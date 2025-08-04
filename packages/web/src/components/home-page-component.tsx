export const HomePageComponent = (props: {
  children: React.ReactElement | React.ReactElement[];
  title: string;
  subtitle?: string;
}) => {
  return (
    <div className="flex flex-col h-screen">
      <div className="bg-gray-800 text-white p-4 pb-2">
        <h1 className="text-2xl font-bold text-gray-200">{props.title}</h1>

        {props.subtitle && (
          <p className="text-gray-400 mt-1 text-sm">{props.subtitle}</p>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-scroll">{props.children}</div>

      <div className="bg-gray-800 text-white p-4 text-center">
        <p>&copy; 2025 Jobber. All rights reserved.</p>
      </div>
    </div>
  );
};
