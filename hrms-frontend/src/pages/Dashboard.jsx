import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import EmployeeDashboard from "./EmployeeDashboard";
import ManagerDashboard from "./ManagerDashboard";
import AdminDashboard from "./AdminDashboard";
import useAuthStore from "../stores/authstore";

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const isManager = user?.managedDepartments?.length > 0;
  const location = useLocation();

  const getViewFromURL = () => {
    const params = new URLSearchParams(location.search);
    return params.get("view") === "manager" ? "MANAGER" : "EMPLOYEE";
  };

  const [view, setView] = useState(getViewFromURL());

  useEffect(() => {
    setView(getViewFromURL());
  }, [location.search]);

  // 🔥 ADMIN
  if (user.role === "ADMIN") {
    return <AdminDashboard />;
  }

  return (
    <div className="space-y-4">
      {isManager && (
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-xl w-fit">
          <button
            onClick={() => setView("EMPLOYEE")}
            className={`px-4 py-2 rounded-lg text-sm ${
              view === "EMPLOYEE"
                ? "bg-indigo-600 text-white"
                : "bg-transparent"
            }`}
          >
            My Dashboard
          </button>

          <button
            onClick={() => setView("MANAGER")}
            className={`px-4 py-2 rounded-lg text-sm ${
              view === "MANAGER"
                ? "bg-indigo-600 text-white"
                : "bg-transparent"
            }`}
          >
            Manage Department
          </button>
        </div>
      )}

      {view === "MANAGER" && isManager ? (
        <ManagerDashboard />
      ) : (
        <EmployeeDashboard />
      )}
    </div>
  );
}
