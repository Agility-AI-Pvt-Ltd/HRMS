import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowUpRight, FiPlus, FiSearch, FiX } from "react-icons/fi";
import api from "../api/axios";
import { createNewFacultyManager, getFreelanceManagers } from "../data/freelanceFaculty";

const roleBadge = (role) => {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset";

  if (role === "ADMIN") {
    return `${base} bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:ring-purple-800`;
  }

  if (role === "LYF_EMPLOYEE") {
    return `${base} bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800`;
  }

  return `${base} bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800`;
};

const statusBadge = (status) => {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset";

  if (status === "ACTIVE") {
    return `${base} bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800`;
  }

  if (status === "ON_LEAVE") {
    return `${base} bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:ring-yellow-800`;
  }

  return `${base} bg-gray-50 text-gray-700 ring-gray-200 dark:bg-gray-900/30 dark:text-gray-200 dark:ring-gray-800`;
};

export default function FreelanceFacultyDashboard() {
  const [managers, setManagers] = useState([]);
  const [filteredEmployees,setFilteredEmployees]=useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("FACULTIES_DESC"); // NAME_ASC | NAME_DESC | FACULTIES_ASC | FACULTIES_DESC
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 7;
  const [error,setError]=useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [msg, setMsg] = useState("");

 const loadManagers=useCallback(async ()=>{
  setLoading(true);
  setError(null);
  const {managers:managers,error:error}=await getFreelanceManagers();
  setManagers(managers ?? []);
  setError(error ?? null);
  setLoading(false);
 },[]);

 const addManager = async () => {
  setLoading(true);
  setError(null);
  if (!selectedEmployee.id) return;
  const data=await createNewFacultyManager(selectedEmployee.id);
  loadManagers();
  setError(data?.error ?? null);
  setLoading(false);
  closeAddModal();
};


 useEffect(()=>{
  loadManagers();
 },[loadManagers]);

  useEffect(() => {
    // reset to first page whenever filters or sort/search change
    setCurrentPage(1);
  }, [query, roleFilter, statusFilter, sortBy, managers]);


  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2000);
    return () => clearTimeout(t);
  }, [msg]);


  useEffect(()=>{
    async function loadEmployees(){
      try{
        const res=await api.get("/users");
        const data=res.data;
        if(data.success){
          const employees=data.users;
          const idsToRemove = new Set(managers?.map(obj => obj.id));
          setFilteredEmployees(employees?.filter(e=>(e.role !== "ADMIN" && e.role !== "AGILITY_EMPLOYEE" && !idsToRemove?.has(e.id))));
        }
      }catch(err){
        console.log(err);
        alert("Something went wrong while loading employees.")
      }
    };
    loadEmployees();
  },[managers])

  const openAddModal = () => {
    setEmployeeQuery("");
    setSelectedEmployeeId("");
    setAddOpen(true);
  };

  const closeAddModal = () => {
    setAddOpen(false);
    setEmployeeQuery("");
    setSelectedEmployeeId("");
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();

    let filtered = managers?.filter((m) => {
      const searchable = [
        `${m.firstName} ${m.lastName}`,
        m.email,
        m.phone,
        m.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const queryOk = !q || searchable.includes(q);
      const roleOk = roleFilter === "ALL" || m.role === roleFilter;
      const statusOk = statusFilter === "ALL" || m.status === statusFilter;
      return queryOk && roleOk && statusOk;
    });

    const byName = (a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);

    const byFaculties = (a, b) => (a.facultiesCount || 0) - (b.facultiesCount || 0);

    switch (sortBy) {
      case "NAME_ASC":
        filtered = [...filtered].sort(byName);
        break;
      case "NAME_DESC":
        filtered = [...filtered].sort((a, b) => byName(b, a));
        break;
      case "FACULTIES_ASC":
        filtered = [...filtered].sort(byFaculties);
        break;
      case "FACULTIES_DESC":
      default:
        filtered = [...filtered].sort((a, b) => byFaculties(b, a));
        break;
    }

    return filtered;
  }, [query, roleFilter, statusFilter, sortBy, managers]);

  const totalManagers = managers?.length;
  const totalFaculties = managers?.reduce(
    (sum, m) => sum + (m.facultiesCount || 0),
    0
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedRows = rows.slice(startIndex, startIndex + PAGE_SIZE);
  const showingFrom = rows.length === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(startIndex + PAGE_SIZE, rows.length);

  const managerEmployeeIds = useMemo(
    () => new Set(managers?.map((m) => m.employeeId).filter(Boolean)),
    [managers]
  );
  const managerEmails = useMemo(
    () => new Set(managers?.map((m) => (m.email || "").toLowerCase()).filter(Boolean)),
    [managers]
  );



  const selectedEmployee = useMemo(
    () => filteredEmployees.find((e) => e.id === selectedEmployeeId) || null,
    [selectedEmployeeId]
  );

  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Freelance Faculty Managers
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Click a manager to view their faculties.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700"
          >
            <FiPlus /> Add Manager
          </button>

          <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Managers
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {totalManagers}
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Faculties under managers
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {totalFaculties}
            </div>
          </div>
          </div>
        </div>
      </div>

      {msg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
          {msg}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center">
          <div className="md:col-span-6">
            <label className="sr-only" htmlFor="ffm-search">
              Search
            </label>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="ffm-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, phone, role…"
                className="w-full rounded-xl border bg-white py-2 pl-10 pr-3 text-sm text-gray-900 shadow-sm outline-none ring-0 placeholder:text-gray-400 focus:border-indigo-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="sr-only" htmlFor="ffm-role">
              Role
            </label>
            <select
              id="ffm-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-indigo-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="ALL">All roles</option>
              <option value="AGILITY_EMPLOYEE">AGILITY_EMPLOYEE</option>
              <option value="LYF_EMPLOYEE">LYF_EMPLOYEE</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="sr-only" htmlFor="ffm-status">
              Status
            </label>
            <select
              id="ffm-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-indigo-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="ALL">All status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ON_LEAVE">ON_LEAVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="sr-only" htmlFor="ffm-sort">
              Sort
            </label>
            <select
              id="ffm-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-indigo-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="FACULTIES_DESC">Faculties (high → low)</option>
              <option value="FACULTIES_ASC">Faculties (low → high)</option>
              <option value="NAME_ASC">Name (A → Z)</option>
              <option value="NAME_DESC">Name (Z → A)</option>
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
                  Manager
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Faculties
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-gray-600 dark:text-gray-400"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
                      <span>Loading managers...</span>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {paginatedRows.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-950/40"
                    >
                      <td className="px-6 py-4">
                        <Link
                          to={`/freelanceManagers/${m.id}`}
                          className="group block"
                        >
                          <div className="font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-gray-100 dark:group-hover:text-indigo-300">
                            {m.firstName} {m.lastName}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {m.email}
                            
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className={roleBadge(m.role)}>{m.role}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={statusBadge(m.status)}>{m.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {m.facultiesCount}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/freelanceManagers/${m.id}`}
                          className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
                        >
                          View <FiArrowUpRight />
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-sm text-gray-600 dark:text-gray-400"
                      >
                        No managers found for your filters.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            {rows.length > 0 ? (
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
                managers
              </span>
            ) : (
              <span>No managers to display</span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={safePage === 1 || rows.length === 0}
              onClick={() =>
                setCurrentPage((p) => (p > 1 ? p - 1 : p))
              }
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
                setCurrentPage((p) =>
                  p < totalPages ? p + 1 : p
                )
              }
              className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add Manager Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeAddModal}
          />
          {loading ? "Loading...":<div className="relative w-full max-w-2xl rounded-2xl border bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Add new manager
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Select from employees.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded-xl p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <FiX />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={employeeQuery}
                  onChange={(e) => setEmployeeQuery(e.target.value)}
                  placeholder="Search employees by name/email/role…"
                  className="w-full rounded-xl border bg-white py-2 pl-10 pr-3 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-indigo-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              <div className="max-h-72 overflow-auto rounded-xl border dark:border-gray-800">
                {filteredEmployees.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-600 dark:text-gray-400">
                    No available employees (already managers or no match).
                  </div>
                ) : (
                  <ul className="divide-y dark:divide-gray-800">
                    {filteredEmployees?.map((e) => (
                      <li key={e.id}>
                        <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-950/40">
                          <input
                            type="radio"
                            name="employee"
                            value={e.id}
                            checked={selectedEmployeeId === e.id}
                            onChange={() => setSelectedEmployeeId(e.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {e.firstName} {e.lastName}{" "}
                              <span className="ml-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                ({e.role})
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {e.email}
                            </div>
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedEmployee && (
                <div className="rounded-xl border bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    Selected:
                  </span>{" "}
                  {selectedEmployee.firstName} {selectedEmployee.lastName} —{" "}
                  <span className="font-mono">{selectedEmployee.email}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-5 py-4 dark:border-gray-800">
              <button
                type="button"
                onClick={closeAddModal}
                className="inline-flex items-center rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addManager}
                disabled={!selectedEmployee}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 hover:from-blue-700 hover:to-indigo-700"
              >
                <FiPlus /> Add
              </button>
            </div>
          </div>}
        </div>
      )}
    </div>
  );
}