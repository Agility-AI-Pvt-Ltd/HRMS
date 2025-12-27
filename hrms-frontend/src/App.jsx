import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

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

import useAuthStore from "./stores/authstore";
import api from "./api/axios";

import ProtectedRoute from "./components/ProtectedRoute";
import LayoutPremium from "./components/LayoutPremium";

export default function App() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const finishLoading = useAuthStore((s) => s.finishLoading);

  useEffect(() => {
    const token = localStorage.getItem("hrms_access");
    const refresh = localStorage.getItem("hrms_refresh");

    if (!token) {
      finishLoading();
      return;
    }

    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    api
      .get("/users/me")
      .then((r) => setAuth(r.data.user, token, refresh))
      .catch(() => finishLoading());
  }, []);

  return (
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

      {/* ==============================
          ⭐ NEW — REIMBURSEMENT ROUTES
         ============================== */}

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

      {/* /dashboard direct route */}
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
      {/* ==============================
       ⭐ NEW — RESIGNATION ROUTE
        ============================== */}
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

      {/* CATCH-ALL */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
