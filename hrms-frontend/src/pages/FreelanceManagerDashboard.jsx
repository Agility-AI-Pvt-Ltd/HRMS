import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listFacultiesForManager } from "../data/freelanceFaculty";
import useAuthStore from "../stores/authstore";

const statusBadge = (status) => {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset";

  if (status === "ACTIVE") {
    return `${base} bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800`;
  }

  if (status === "ON_HOLD") {
    return `${base} bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:ring-yellow-800`;
  }

  return `${base} bg-gray-50 text-gray-700 ring-gray-200 dark:bg-gray-900/30 dark:text-gray-200 dark:ring-gray-800`;
};

const FreelanceManagerDashboard = () => {
  const user = useAuthStore((s) => s.user);
  const managerId = user?.id;
  const navigate = useNavigate();

  const [faculties, setFaculties] = useState([]);
  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [error, setError] = useState(null);

  const handleFetchFaculties = useCallback(async (managerIdToUse) => {
    if (!managerIdToUse) return;

    setLoadingFaculties(true);
    setError(null);

    try {
      const { faculties: apiFaculties = [], error: apiError = null } =
        await listFacultiesForManager(managerIdToUse);

      setFaculties(Array.isArray(apiFaculties) ? apiFaculties : []);
      setError(apiError);
    } catch (err) {
      console.error("Failed to load faculties for manager:", err);
      setFaculties([]);
      setError(err?.message || "Failed to load faculties.");
    } finally {
      setLoadingFaculties(false);
    }
  }, []);

  useEffect(() => {
    if (!managerId) return;
    handleFetchFaculties(managerId);
  }, [managerId, handleFetchFaculties]);

  useEffect(() => {
    console.log("ManagerId:", managerId);
    console.log("Faculties:", faculties);
  }, [managerId, faculties]);

  const totalEntries = faculties.reduce(
    (sum, f) => sum + (f.totalEntries || 0),
    0
  );
  const totalClasses = faculties.reduce(
    (sum, f) => sum + (f.totalClasses || 0),
    0
  );
  const totalHours = faculties.reduce(
    (sum, f) => sum + (f.totalHours || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          My Freelance Faculties
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          List of freelance faculties assigned to you as a manager.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Faculties
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {faculties.length}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Total Entries
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {totalEntries}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Total Classes
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {totalClasses}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Total Hours
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {totalHours}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loadingFaculties && (
        <div className="rounded-2xl border bg-white px-6 py-8 text-center text-sm text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          <div className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
            <span>Loading faculties...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loadingFaculties && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Empty / table state */}
      {!loadingFaculties && !error && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {faculties.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-600 dark:text-gray-400">
              No freelance faculties found for you yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-950/60">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Faculty Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Subjects
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Preferred Days
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Entries
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Classes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Hours
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {faculties.map((faculty) => (
                    <tr
                      key={faculty.id}
                      className="cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-950/40"
                      onClick={() => navigate(`/freelance/${faculty.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {faculty.name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {faculty.subjects && faculty.subjects.length > 0 ? (
                            faculty.subjects.map((subject, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800"
                              >
                                {subject}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {faculty.preferredDaysOfWeek &&
                          faculty.preferredDaysOfWeek.length > 0 ? (
                            faculty.preferredDaysOfWeek.map((day, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-700/10 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
                              >
                                {day}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={statusBadge(faculty.status)}>
                          {faculty.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {faculty.totalEntries || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {faculty.totalClasses || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {faculty.totalHours || 0}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FreelanceManagerDashboard;