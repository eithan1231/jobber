const Component = () => {
  return (
    <div className="flex flex-col h-screen">
      <div className="bg-gray-800 text-white p-4">
        <h1 className="text-2xl font-bold">Homepage</h1>
      </div>
      <div className="flex-1 p-4 text-center">
        <p className="text-lg text-gray-700">Welcome to Jobber!</p>
      </div>
      <div className="bg-gray-800 text-white p-4 text-center">
        <p>&copy; 2025 Jobber. All rights reserved.</p>
      </div>
    </div>
  );
};

export default Component;
