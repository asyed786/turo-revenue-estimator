export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Hero Section */}
      <header className="max-w-3xl text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
          Turo Revenue Estimator
        </h1>
        <p className="text-lg text-gray-600">
          Estimate your potential monthly earnings based on your car type, daily rate, and occupancy.
        </p>
      </header>

      {/* Estimator Card */}
      <div className="bg-white shadow-lg rounded-xl p-8 w-full max-w-lg">
        <form className="space-y-6">
          {/* Car Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Car Type</label>
            <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
              <option>Sedan</option>
              <option>SUV</option>
              <option>Luxury</option>
              <option>Sports Car</option>
              <option>Other</option>
            </select>
          </div>

          {/* Daily Rate */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Daily Rate ($)</label>
            <input
              type="number"
              placeholder="Enter daily rate"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          {/* Occupancy */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Occupancy Rate (%)</label>
            <input
              type="number"
              placeholder="Enter occupancy"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-700 transition"
          >
            Calculate Earnings
          </button>
        </form>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Turo Revenue Estimator. All rights reserved.
      </footer>
    </div>
  );
}
