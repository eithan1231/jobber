export const HomePageComponent = (props: {
  children: React.ReactElement | React.ReactElement[];
  title: string;
  subtitle?: string;
}) => {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">{props.title}</h1>

        {props.subtitle && (
          <p className="text-gray-600 mt-1 text-sm">{props.subtitle}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">{props.children}</div>

      <div className="bg-white border-t border-gray-200 px-6 py-3 text-center">
        <p className="text-sm text-gray-500">
          &copy; 2025 Jobber. All rights reserved.
        </p>
      </div>
    </div>
  );
};
