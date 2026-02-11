import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import DeviceGuard from "./components/DeviceGuard";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Departments from "./pages/Departments";
import Leaves from "./pages/Leaves";
import Attendance from "./pages/Attendance";
import Payroll from "./pages/Payroll";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import Unauthorized from "./pages/Unauthorized";

import EmployeeView from "./pages/EmployeeView";
import Reimbursement from "./pages/Reimbursement.jsx";
import Resignation from "./pages/Resignation.jsx";
import WeeklyOff from "./pages/WeeklyOff";     
import HolidayPage from "./pages/HolidayPage";   

import useAuthStore from "./stores/authstore";

import ProtectedRoute from "./components/ProtectedRoute";
import LayoutPremium from "./components/LayoutPremium";
import FreelanceFacultyDashboard from "./pages/FreelanceFacultyDashboard.jsx";
import FreelanceFacultyManagerView from "./pages/FreelanceFacultyManagerView.jsx";
import FreelanceManagerDashboard from "./pages/FreelanceManagerDashboard.jsx";
import FreelanceFacultyManagerRoute from "./components/FreelanceFacultyManagerRoute.jsx";
import FreelanceFacultyPage from "./pages/FreelanceFacultyPage.jsx";


export default function App() {
  const loading = useAuthStore((s) => s.loading);

  // ✅ MAIN FIX - Use loadUserFromToken instead of manual API call
  useEffect(() => {
    useAuthStore.getState().loadUserFromToken();
  }, []);

  // ✅ Show loading screen while fetching user
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <DeviceGuard>
      <Routes>

        {/* PUBLIC ROUTES */}
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* DASHBOARD */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]}>
              <LayoutPremium>
                <Dashboard />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        {/* ADMIN ONLY ROUTES */}
        <Route
          path="/employees"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <LayoutPremium>
                <Employees />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />
        {/* ADMIN ONLY ROUTES */}
        <Route
          path="/freelanceManagers"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <LayoutPremium>
                <FreelanceFacultyDashboard/>
              </LayoutPremium>
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelanceManagers/:managerId"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <LayoutPremium>
                <FreelanceFacultyManagerView />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />
        {/* ===============Freelance Managers Routes============= */}
        <Route
          path="/freelance"
          element={
            <ProtectedRoute allowedRoles={["LYF_EMPLOYEE"]}>
              <LayoutPremium>
                <FreelanceFacultyManagerRoute>
                  <FreelanceManagerDashboard/>
                </FreelanceFacultyManagerRoute>
              </LayoutPremium>
            </ProtectedRoute>
          }
        />
        <Route
          path="/freelance/:facultyId"
          element={
            <ProtectedRoute allowedRoles={["LYF_EMPLOYEE"]}>
              <LayoutPremium>
                <FreelanceFAcultyManagerRoute>
                  <FreelanceFacultyPage/>
                </FreelanceFAcultyManagerRoute>
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        <Route
          path="/weekly-off"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <LayoutPremium>
                <WeeklyOff />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        <Route
          path="/departments"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <LayoutPremium>
                <Departments />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        {/* LEAVES */}
        <Route
          path="/leaves"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]}>
              <LayoutPremium>
                <Leaves />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        {/* ATTENDANCE */}
        <Route
          path="/attendance"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]}>
              <LayoutPremium>
                <Attendance />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        {/* PAYROLL */}
        <Route
          path="/payroll"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]}>
              <LayoutPremium>
                <Payroll />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        {/* NOTIFICATIONS */}
        <Route
          path="/notifications"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]}>
              <LayoutPremium>
                <Notifications />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        {/* PROFILE */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]}>
              <LayoutPremium>
                <Profile />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        {/* EMPLOYEE DETAIL PAGE */}
        <Route
          path="/employees/:id"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <LayoutPremium>
                <EmployeeView />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        {/* REIMBURSEMENT */}
        <Route
          path="/reimbursements"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]}>
              <LayoutPremium>
                <Reimbursement />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        {/* DASHBOARD DIRECT ROUTE */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]}>
              <LayoutPremium>
                <Dashboard />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        {/* RESIGNATION */}
        <Route
          path="/resignation"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "AGILITY_EMPLOYEE", "LYF_EMPLOYEE"]}>
              <LayoutPremium>
                <Resignation />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        {/* HOLIDAYS */}
        <Route
          path="/holidays"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <LayoutPremium>
                <HolidayPage />
              </LayoutPremium>
            </ProtectedRoute>
          }
        />

        {/* CATCH-ALL */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DeviceGuard>
  );
}