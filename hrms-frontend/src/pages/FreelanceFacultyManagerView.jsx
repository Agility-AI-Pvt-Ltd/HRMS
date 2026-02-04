import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";
import { FiArrowLeft, FiSearch, FiMoreVertical } from "react-icons/fi";
import {
  getFacultiesByManagerId,
  assignFreelanceFacultyToManager,
  updateFacultyStatus,
  changeFacultyManager,
  getFreelanceManagers,
} from "../data/freelanceFaculty";

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

export default function FreelanceFacultyManagerView() {
  const { managerId } = useParams();
  const [managers,setManagers]=useState([]);
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("NAME_ASC");

  const [error,setError]=useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const DUMMY_MANAGERS = [
    { id: "MGR-1001", name: "Aarav Mehta", email: "aarav.mehta@dummy.com" },
    { id: "MGR-1002", name: "Neha Sharma", email: "neha.sharma@dummy.com" },
    { id: "MGR-1003", name: "Kabir Singh", email: "kabir.singh@dummy.com" },
    { id: "MGR-1004", name: "Isha Verma", email: "isha.verma@dummy.com" },
  ];

  // Assign freelance faculty modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignName, setAssignName] = useState("");
  const [assignSubjects, setAssignSubjects] = useState([]);
  const [assignDays, setAssignDays] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);

  // Change manager modal state
  const [showChangeManagerModal, setShowChangeManagerModal] = useState(false);
  const [changeTargetFaculty, setChangeTargetFaculty] = useState(null);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState(null);

  const SUBJECT_OPTIONS = [
    "Maths",
    "Science",
    "Physics",
    "Chemistry",
    "Biology",
    "English",
    "Computer Science",
  ];

  const DAY_OPTIONS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  const loadManagers=useCallback(async ()=>{
    setLoading(true);
    setError(null);
    const {managers:managers,error:error}=await getFreelanceManagers();
    setManagers(managers ?? []);
    setError(error ?? null);
    setLoading(false);
   },[]);

   useEffect(()=>{
    loadManagers();
   },[loadManagers])

  const loadFaculties=useCallback(async ()=>{
    if(!managerId) return;
    setLoading(true);
    setError(null);
    const {data,error:error}=await getFacultiesByManagerId(managerId);
    setFaculties(data ?? null);
    setError(error ?? null);
    setLoading(false);
  },[managerId]);

  useEffect(()=>{
    loadFaculties();
  },[loadFaculties])

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, sortBy]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    let filtered = faculties.filter((f) => {
      const searchable = [
        f.name,
        ...(f.subjects || []),
        ...(f.preferredDaysOfWeek || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const queryOk = !q || searchable.includes(q);
      const statusOk = statusFilter === "ALL" || f.status === statusFilter;
      return queryOk && statusOk;
    });

    const byName = (a, b) => a.name.localeCompare(b.name);
    const byEntries = (a, b) => (a.totalEntries || 0) - (b.totalEntries || 0);
    const byClasses = (a, b) => (a.totalClasses || 0) - (b.totalClasses || 0);
    const byHours = (a, b) => (a.totalHours || 0) - (b.totalHours || 0);

    switch (sortBy) {
      case "NAME_ASC":
        filtered = [...filtered].sort(byName);
        break;
      case "NAME_DESC":
        filtered = [...filtered].sort((a, b) => byName(b, a));
        break;
      case "ENTRIES_ASC":
        filtered = [...filtered].sort(byEntries);
        break;
      case "ENTRIES_DESC":
        filtered = [...filtered].sort((a, b) => byEntries(b, a));
        break;
      case "CLASSES_ASC":
        filtered = [...filtered].sort(byClasses);
        break;
      case "CLASSES_DESC":
        filtered = [...filtered].sort((a, b) => byClasses(b, a));
        break;
      case "HOURS_ASC":
        filtered = [...filtered].sort(byHours);
        break;
      case "HOURS_DESC":
        filtered = [...filtered].sort((a, b) => byHours(b, a));
        break;
      default:
        filtered = [...filtered].sort(byName);
    }

    return filtered;
  }, [query, statusFilter, sortBy, faculties]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedRows = rows.slice(startIndex, startIndex + PAGE_SIZE);
  const showingFrom = rows.length === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(startIndex + PAGE_SIZE, rows.length);

  const managerInfo = faculties.length > 0 ? faculties[0].manager : null;
  const totalEntries = faculties.reduce((sum, f) => sum + (f.totalEntries || 0), 0);
  const totalClasses = faculties.reduce((sum, f) => sum + (f.totalClasses || 0), 0);
  const totalHours = faculties.reduce((sum, f) => sum + (f.totalHours || 0), 0);

  const openAssignModal = () => {
    setAssignName("");
    setAssignSubjects([]);
    setAssignDays([]);
    setAssignError(null);
    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    if (assignLoading) return;
    setShowAssignModal(false);
  };

  const openChangeManagerModal = (faculty) => {
    setChangeTargetFaculty(faculty);
    setChangeError(null);

    const currentManager = String(faculty?.managerId ?? managerId ?? "");
    const candidates = managers?.filter(
      (m) => String(m.id) !== managerId
    );
    setSelectedManagerId(candidates[0]?.id ?? "");
    setShowChangeManagerModal(true);
  };

  const closeChangeManagerModal = () => {
    if (changeLoading) return;
    setShowChangeManagerModal(false);
    setChangeTargetFaculty(null);
    setSelectedManagerId("");
    setChangeError(null);
  };

  const toggleSubject = (subject) => {
    setAssignSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject]
    );
  };

  const toggleDay = (day) => {
    setAssignDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!managerId) return;

    setAssignLoading(true);
    setAssignError(null);

    const payload = {
      managerId,
      name: assignName,
      subjects: assignSubjects,
      preferredDaysOfWeek: assignDays,
    };

    const { data, error: apiError } = await assignFreelanceFacultyToManager(
      payload
    );

    if (apiError || !data?.success) {
      setAssignError(
        apiError || data?.message || "Failed to assign freelance faculty."
      );
      setAssignLoading(false);
      return;
    }

    // Refresh list and close modal on success
    await loadFaculties();
    setAssignLoading(false);
    setShowAssignModal(false);
  };

  const handleStatusUpdate= async ({facultyId,status})=>{
    setLoading(true);
    setError(null);
    const {error}=await updateFacultyStatus({facultyId,status});
    setError(error);
    if (!error) {
      await loadFaculties();
    }
    setLoading(false);
  }

  const handleManagerChange=async ({facultyId,newManagerId})=>{
    if (!facultyId || !newManagerId) return;

    setChangeLoading(true);
    setChangeError(null);

    const { error: apiError } = await changeFacultyManager({
      facultyId,
      newManagerId,
    });

    if (apiError) {
      setChangeError(
        apiError?.response?.data?.message ??
          apiError?.message ??
          "Failed to change manager."
      );
      setChangeLoading(false);
      return;
    }

    await loadFaculties();
    setChangeLoading(false);
    setShowChangeManagerModal(false);
    setChangeTargetFaculty(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              to="/freelanceManagers"
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
            >
              <FiArrowLeft /> Back
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Faculty Members
          </h1>
          {managerInfo && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Under {managerInfo.firstName} {managerInfo.lastName} ({managerInfo.email})
            </p>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={openAssignModal}
              className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Assign Freelance Faculty
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
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
      </div>

      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Assign Freelance Faculty to Manager
            </h2>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Faculty Name
                </label>
                <input
                  type="text"
                  value={assignName}
                  onChange={(e) => setAssignName(e.target.value)}
                  placeholder="Enter faculty name"
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-indigo-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subjects
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Select one or more subjects.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_OPTIONS.map((subject) => {
                    const selected = assignSubjects.includes(subject);
                    return (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => toggleSubject(subject)}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                          selected
                            ? "bg-indigo-600 text-white ring-indigo-600"
                            : "bg-gray-50 text-gray-700 ring-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
                        }`}
                      >
                        {subject}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preferred Days of Week
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Select one or more days.
                </p>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((day) => {
                    const selected = assignDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                          selected
                            ? "bg-emerald-600 text-white ring-emerald-600"
                            : "bg-gray-50 text-gray-700 ring-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {assignError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {assignError}
                </p>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  disabled={assignLoading}
                  className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading}
                  className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assignLoading ? "Assigning..." : "Assign Faculty"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChangeManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Change Manager
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select a new manager for{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {changeTargetFaculty?.name ?? "this faculty"}
              </span>
              .
            </p>

            <div className="space-y-2">
              {managers?.filter(
                (m) => String(m.id) !== managerId
              ).length === 0 ? (
                <div className="rounded-xl border p-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
                  No other managers available.
                </div>
              ) : (
                <div className="max-h-64 overflow-auto rounded-xl border p-2 dark:border-gray-800">
                  {managers.filter(
                    (m) => String(m.id) !== managerId
                  ).map((m) => {
                    const selected = String(selectedManagerId) === String(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedManagerId(m.id)}
                        className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                          selected
                            ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{m.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {m.firstName}{" "}{m.lastName} • {m.email}
                          </div>
                        </div>
                        <div
                          className={`mt-1 h-4 w-4 rounded-full ring-2 ${
                            selected
                              ? "bg-indigo-600 ring-indigo-600"
                              : "bg-white ring-gray-300 dark:bg-gray-900 dark:ring-gray-700"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {changeError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {changeError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeChangeManagerModal}
                disabled={changeLoading}
                className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  changeLoading ||
                  !changeTargetFaculty?.id ||
                  !selectedManagerId ||
                  String(selectedManagerId) ===
                    String(changeTargetFaculty?.managerId ?? managerId ?? "")
                }
                onClick={() =>
                  handleManagerChange({
                    facultyId: changeTargetFaculty?.id,
                    newManagerId: selectedManagerId,
                  })
                }
                className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {changeLoading ? "Changing..." : "Change"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center">
          <div className="md:col-span-6">
            <label className="sr-only" htmlFor="faculty-search">
              Search
            </label>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="faculty-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, subjects, days…"
                className="w-full rounded-xl border bg-white py-2 pl-10 pr-3 text-sm text-gray-900 shadow-sm outline-none ring-0 placeholder:text-gray-400 focus:border-indigo-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="sr-only" htmlFor="faculty-status">
              Status
            </label>
            <select
              id="faculty-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-indigo-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="ALL">All status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ON_HOLD">ON_HOLD</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="sr-only" htmlFor="faculty-sort">
              Sort
            </label>
            <select
              id="faculty-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-indigo-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="NAME_ASC">Name (A → Z)</option>
              <option value="NAME_DESC">Name (Z → A)</option>
              <option value="ENTRIES_DESC">Entries (high → low)</option>
              <option value="ENTRIES_ASC">Entries (low → high)</option>
              <option value="CLASSES_DESC">Classes (high → low)</option>
              <option value="CLASSES_ASC">Classes (low → high)</option>
              <option value="HOURS_DESC">Hours (high → low)</option>
              <option value="HOURS_ASC">Hours (low → high)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
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
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-10 text-center text-sm text-gray-600 dark:text-gray-400"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
                      <span>Loading faculties...</span>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {paginatedRows.map((faculty) => (
                    <tr
                      key={faculty.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-950/40"
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
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            setOpenMenuId((prev) =>
                              prev === faculty.id ? null : faculty.id
                            );

                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuWidth = 128; // w-32

                            setMenuPosition({
                              top: rect.bottom + window.scrollY + 8,
                              left: rect.right + window.scrollX - menuWidth,
                            });
                          }}
                          className="inline-flex items-center justify-center rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                        >
                          <span className="sr-only">Open actions</span>
                          <FiMoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td
                    colSpan={8}
                        className="px-6 py-10 text-center text-sm text-gray-600 dark:text-gray-400"
                      >
                        {faculties.length === 0
                          ? "No faculties found for this manager."
                          : "No faculties match your filters."}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {rows.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <span>
                Showing{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {showingFrom}
                </span>{" "}
                –{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {showingTo}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {rows.length}
                </span>{" "}
                {rows.length === 1 ? "faculty" : "faculties"}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={safePage === 1 || rows.length === 0}
                onClick={() => setCurrentPage((p) => (p > 1 ? p - 1 : p))}
                className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Page{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {rows.length === 0 ? 0 : safePage}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {rows.length === 0 ? 0 : totalPages}
                </span>
              </span>
              <button
                type="button"
                disabled={safePage === totalPages || rows.length === 0}
                onClick={() =>
                  setCurrentPage((p) => (p < totalPages ? p + 1 : p))
                }
                className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {openMenuId && menuPosition &&
        createPortal(
          <div
            className="fixed z-[9999]"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
            }}
          >
            <div className="w-32 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-900 dark:ring-gray-700">
              {faculties.find((f) => f.id === openMenuId)?.status === "INACTIVE" && (
                <button
                  type="button"
                  onClick={() => {
                    handleStatusUpdate({
                      facultyId: openMenuId,
                      status: "ACTIVE",
                    });
                    setOpenMenuId(null);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs text-emerald-600 hover:bg-gray-50 dark:text-emerald-400 dark:hover:bg-gray-800"
                >
                  Activate
                </button>
              )}
              {faculties.find((f) => f.id === openMenuId)?.status === "ACTIVE" && (
                <button
                  type="button"
                  onClick={() => {
                    handleStatusUpdate({
                      facultyId: openMenuId,
                      status: "INACTIVE",
                    });
                    setOpenMenuId(null);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-gray-50 dark:text-red-400 dark:hover:bg-gray-800"
                >
                  Deactivate
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const target = faculties.find((f) => f.id === openMenuId);
                  if (target) openChangeManagerModal(target);
                  setOpenMenuId(null);
                }}
                className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Change Manager
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
