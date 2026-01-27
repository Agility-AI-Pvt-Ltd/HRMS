// =============================
// AttendanceAdmin.jsx (PART 1)
// =============================
import React, { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
/* ----------------------------------------------------------
   HELPERS
---------------------------------------------------------- */
const toISODate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

const formatTime = (v) => {
  if (!v) return "--";

  const d = new Date(v);

  // // 🔥 FORCE UTC → IST rollback (−5:30)
  // d.setHours(d.getHours() - 5);
  // d.setMinutes(d.getMinutes() - 30);

  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};


const parseHours = (cin, cout) => {
  if (!cin || !cout) return 0;
  const diff = new Date(cout) - new Date(cin);
  return diff > 0 ? (diff / 3600000).toFixed(2) : 0;
};

/* QUICK FILTERS */
const getToday = () => {
  const d = new Date();
  const iso = toISODate(d);
  return { start: iso, end: iso };
};
const getThisWeek = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;

  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);

  return { start: toISODate(mon), end: toISODate(sun) };
};
const getThisMonth = () => {
  const d = new Date();
  return {
    start: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
};
const getThisYear = () => {
  const d = new Date();
  return {
    start: toISODate(new Date(d.getFullYear(), 0, 1)),
    end: toISODate(new Date(d.getFullYear(), 11, 31)),
  };
};

/* ----------------------------------------------------------
   STAT CARD
---------------------------------------------------------- */
function StatCard({ title, value, color }) {
  return (
    <div className="p-4 bg-white/70 dark:bg-gray-800/50 rounded-xl text-center border shadow">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}
const STATUS_LABELS = {
  PRESENT: "Present",
  WEEKOFF_PRESENT: "WeekOff Present",
  WEEKOFF: "WeekOff",
  WFH: "WFH",
  HALF_DAY: "Half Day",
  HALF_DAY_PENDING: "Half Day By Late Check-in",
  COMP_OFF: "CompOff",
  ABSENT: "Absent",
};

/* ----------------------------------------------------------
   MAIN SCREEN
---------------------------------------------------------- */
export default function AttendanceAdmin() {
  const [filters, setFilters] = useState({
    start: getToday().start,
    end: getToday().end,
    departmentId: "",
    userId: "",
    status: "",
  });

  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

const [summary, setSummary] = useState({
  totalEmployees: 0,
  present: 0,
  halfDay: 0, 
  weekOffPresent: 0,
  wfh: 0,
  leave: 0,
  compOff: 0,
  weekOff: 0,
  absent: 0,
});

  const [attendance, setAttendance] = useState([]);

  const [employeeModal, setEmployeeModal] = useState(null);

  /* LOAD DEPARTMENTS + USERS */
useEffect(() => {
  async function load() {
    try {
      const [d, u] = await Promise.all([
        api.get("/departments"),
        api.get("/users"),
      ]);
      setDepartments(d.data.departments ?? []);
      setEmployees(u.data.users ?? []);
    } catch {}
  }
  load();
}, []);

  /* LOAD ATTENDANCE */
  const loadAttendance = useCallback(
    async (overrides = null) => {
      const f = overrides ? { ...filters, ...overrides } : filters;
      try {
        setLoading(true);
        setError("");

        const q = new URLSearchParams();
        if (f.start) q.append("start", f.start);
        if (f.end) q.append("end", f.end);
        if (f.departmentId) q.append("departmentId", f.departmentId);
        if (f.userId) q.append("userId", f.userId);
        if (f.status) q.append("status", f.status);

        const res = await api.get(`/attendance/all?${q.toString()}`);

        const att = res.data.attendances ?? [];

        setAttendance(
          att.map((a) => ({
            ...a,
totalHours:
  ["WEEKOFF", "LEAVE", "ABSENT"].includes(a.status)
    ? "—"
    : parseHours(a.checkIn, a.checkOut),
          }))
        );

      const s = res.data.summary || {};
setSummary({
  totalEmployees: s.totalEmployees ?? 0,
  present: s.present ?? 0,
  halfDay: s.halfDay ?? 0, 
  wfh: s.wfh ?? 0,
  leave: s.leave ?? 0,
  compOff: s.compOff ?? 0,
  weekOff: s.weekOff ?? 0,
  weekOffPresent: s.weekOffPresent ?? 0,
  absent: s.absent ?? 0,
});
      } catch (err) {
        setError("Unable to load attendance");
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
  async function run() {
    await loadAttendance();
  }
  run();
}, [loadAttendance]);


  /* EXPORT */
  const exportFile = async (format) => {
    try {
      const q = new URLSearchParams();
      q.append("start", filters.start);
      q.append("end", filters.end);

      const res = await api.get(
        `/attendance/export?format=${format}&${q.toString()}`,
        { responseType: "blob" }
      );

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance.${format}`;
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Export failed");
    }
  };

// ✅ ADMIN HALF DAY DECISION
const decideHalfDay = async (attendanceId, action) => {
  try {
    await api.post("/attendance/half-day/decision", {
      attendanceId,
      action, // "APPROVE" | "REJECT"
    });
    loadAttendance();
  } catch (err) {
    alert(err?.response?.data?.message || "Action failed");
  }
};

  /* OPEN EMPLOYEE MODAL */
  const openEmployeeModal = async (userId) => {
    try {
      const month = filters.start?.slice(0, 7);
      const r = await api.get(`/attendance/user/${userId}/month?month=${month}`);
      setEmployeeModal({ user: r.data.user, logs: r.data.days });
    } catch {
      setError("Failed to load logs");
    }
  };

  return (
    <div className="space-y-6 p-3">

      {/* EXPORT */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => exportFile("csv")}
          className="px-3 py-1 bg-indigo-600 text-white rounded-lg shadow"
        >
          CSV
        </button>
        <button
          onClick={() => exportFile("xlsx")}
          className="px-3 py-1 bg-indigo-600 text-white rounded-lg shadow"
        >
          Excel
        </button>
      </div>

      {error && <div className="p-3 bg-red-200 text-red-800 rounded-xl">{error}</div>}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Employees" value={summary.totalEmployees} color="text-indigo-600"/>
        <StatCard title="Present" value={summary.present} color="text-green-600" />
        <StatCard title="On HalfDay" value={summary.halfDay} color="text-yellow-600" />
        <StatCard title="WFH" value={summary.wfh} color="text-blue-600" />
        <StatCard title="WeekOff Present" value={summary.weekOffPresent} color="text-gray-500" />
        <StatCard title="On Leave" value={summary.leave} color="text-yellow-600" />
        <StatCard title="On CompOff Leave" value={summary.compOff} color="text-yellow-400"/>
        <StatCard title="Week Off" value={summary.weekOff} color="text-orange-400"/>
        <StatCard title="Absent" value={summary.absent} color="text-red-600" />
      </div>

      {/* FILTER PANEL */}
      <AdminFilters
        filters={filters}
        setFilters={setFilters}
        departments={departments}
        employees={employees}
        loadAttendance={loadAttendance}
      />

      {/* TABLE + MOBILE CARDS */}
      <AttendanceTable
        loading={loading}
        rows={attendance}
        onView={openEmployeeModal}
        onDecideHalfDay={decideHalfDay}
      />

      {/* MODAL */}
      {employeeModal && (
        <EmployeeModal
          employee={employeeModal.user}
          logs={employeeModal.logs}
          onClose={() => setEmployeeModal(null)}
        />
      )}
    </div>
  );
}
// =============================
// PART 2 — FILTERS + MOBILE CARDS + TABLE
// =============================

/* ----------------------------------------------------------
   FILTER PANEL
---------------------------------------------------------- */
function AdminFilters({ filters, setFilters, departments, employees, loadAttendance }) {
  const applyRange = (r) => {
    setFilters((p) => ({ ...p, start: r.start, end: r.end }));
    loadAttendance(r);
  };

  return (
    <div className="p-4 rounded-xl bg-white/70 dark:bg-gray-800/50 shadow border space-y-4">

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => applyRange(getToday())}
          className="px-3 py-1 bg-blue-600 text-white rounded-lg"
        >
          Today
        </button>

        <button
          onClick={() => applyRange(getThisWeek())}
          className="px-3 py-1 bg-purple-600 text-white rounded-lg"
        >
          This Week
        </button>

        <button
          onClick={() => applyRange(getThisMonth())}
          className="px-3 py-1 bg-green-600 text-white rounded-lg"
        >
          This Month
        </button>

        <button
          onClick={() => applyRange(getThisYear())}
          className="px-3 py-1 bg-orange-600 text-white rounded-lg"
        >
          This Year
        </button>
      </div>

      {/* Detailed Filters */}
      <div className="grid md:grid-cols-5 gap-4">

        {/* Start Date */}
        <div>
          <label className="text-sm">Start</label>
          <input
            type="date"
            value={filters.start}
            onChange={(e) =>
              setFilters((p) => ({ ...p, start: e.target.value }))
            }
            className="w-full px-2 py-2 rounded border bg-white dark:bg-gray-900"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="text-sm">End</label>
          <input
            type="date"
            value={filters.end}
            onChange={(e) =>
              setFilters((p) => ({ ...p, end: e.target.value }))
            }
            className="w-full px-2 py-2 rounded border bg-white dark:bg-gray-900"
          />
        </div>

        {/* Department */}
        <div>
          <label className="text-sm">Department</label>
          <select
            value={filters.departmentId}
            onChange={(e) =>
              setFilters((p) => ({ ...p, departmentId: e.target.value }))
            }
            className="w-full px-2 py-2 rounded border bg-white dark:bg-gray-900"
          >
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Employees */}
        <div>
          <label className="text-sm">Employee</label>
          <select
            value={filters.userId}
            onChange={(e) =>
              setFilters((p) => ({ ...p, userId: e.target.value }))
            }
            className="w-full px-2 py-2 rounded border bg-white dark:bg-gray-900"
          >
            <option value="">All</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="text-sm">Status</label>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((p) => ({ ...p, status: e.target.value }))
            }
            className="w-full px-2 py-2 rounded border bg-white dark:bg-gray-900"
          >
<option value="PRESENT">Present</option>
<option value="WEEKOFF_PRESENT">Week-Off Present</option>
<option value="WEEKOFF">Week Off</option>
<option value="WFH">WFH</option>
<option value="HALF_DAY">Half Day</option>
<option value="COMP_OFF">Comp-Off</option>
<option value="ABSENT">Absent</option>
          </select>
        </div>
      </div>

      <button
        onClick={() => loadAttendance()}
        className="px-5 py-2 bg-indigo-600 text-white rounded-lg shadow"
      >
        Apply Filters
      </button>
    </div>
  );
}

/* ----------------------------------------------------------
   STATUS BADGE
---------------------------------------------------------- */
function StatusBadge({ status }) {
const colors = {
  PRESENT: "bg-green-100 text-green-700",
  WEEKOFF_PRESENT: "bg-gray-200 text-gray-700",
  WEEKOFF: "bg-orange-100 text-orange-700",
  WFH: "bg-blue-100 text-blue-700",
  HALF_DAY_PENDING: "bg-yellow-200 text-yellow-800",
  HALF_DAY: "bg-yellow-100 text-yellow-700",
  COMP_OFF: "bg-purple-100 text-purple-700",
  ABSENT: "bg-red-100 text-red-700",
};

  return (
    <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${colors[status]}`}>
       {STATUS_LABELS[status] || status}
    </span>
  );
}

/* ----------------------------------------------------------
   MOBILE CARD VIEW (FULL RESPONSIVE)
---------------------------------------------------------- */
function MobileAttendanceCards({ rows, onView }) {
  return (
    <div className="space-y-3 sm:hidden">

      {rows.map((r) => (
        <div
          key={r.id}
          className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow border space-y-2"
        >
          <div className="flex justify-between">
            <h3 className="font-semibold text-base">
              {r.user?.firstName} {r.user?.lastName}
            </h3>

            <StatusBadge status={r.status} />
          </div>

          <p className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Date:</strong> {toISODate(r.date)}
          </p>

          <p className="text-sm">
            <strong>In:</strong> {r.status === "WFH" ? "—" : formatTime(r.checkIn)}
          </p>

          <p className="text-sm">
            <strong>Out:</strong> {r.status === "WFH" ? "—" : formatTime(r.checkOut)}
          </p>

       <strong>Hours:</strong>{" "}
{typeof r.totalHours === "string"
  ? r.totalHours
  : `${r.totalHours} hrs`}

          <button
            onClick={() => onView(r.userId)}
            className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm shadow"
          >
            View Logs
          </button>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------
   DESKTOP TABLE VIEW
---------------------------------------------------------- */
function AttendanceTable({ rows, loading, onView, onDecideHalfDay}) {
  return (
    <>
      {/* MOBILE CARDS */}
      <MobileAttendanceCards rows={rows} onView={onView} />

      {/* DESKTOP TABLE */}
      <div className="hidden sm:block rounded-xl bg-white/70 dark:bg-gray-800/50 shadow border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
              <th className="p-2 text-left">Employee</th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">In</th>
              <th className="p-2 text-left">Out</th>
              <th className="p-2 text-left">Hours</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="p-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-4 text-center">
                  No Records Found
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t dark:border-gray-700">

                  <td className="p-2">
                    {r.user?.firstName} {r.user?.lastName}
                  </td>

                  <td className="p-2">{toISODate(r.date)}</td>

                  <td className="p-2">
                    {r.status === "WFH" ? "—" : formatTime(r.checkIn)}
                  </td>

                  <td className="p-2">
                    {r.status === "WFH" ? "—" : formatTime(r.checkOut)}
                  </td>

                 <td className="p-2">
  {typeof r.totalHours === "string"
    ? r.totalHours
    : `${r.totalHours} hrs`}
</td>


                  <td className="p-2">
                    <StatusBadge status={r.status} />
                  </td>

<td className="p-2">
  {r.lateHalfDayEligible ? (
    <div className="flex gap-2">
<button
  onClick={() => onDecideHalfDay(r.id, "REJECT")}
  className="px-2 py-1 bg-green-600 text-white rounded"
>
  Remain Present
</button>

<button
  onClick={() => onDecideHalfDay(r.id, "APPROVE")}
  className="px-2 py-1 bg-red-600 text-white rounded"
>
  Yes ,Half Day 
</button>

    </div>
  ) : (
    <button
      onClick={() => onView(r.userId)}
      className="text-indigo-600 underline"
    >
      View Logs
    </button>
  )}
</td>

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
// =============================
// PART 3 — EMPLOYEE MODAL (FULL RESPONSIVE)
// =============================
function EmployeeModal({ employee, logs, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-6">
      <div className="
        bg-white dark:bg-gray-900 
        rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 
        w-full max-w-4xl 
        max-h-[90vh] overflow-y-auto 
        p-4 sm:p-6
      ">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl font-bold">
            Attendance Logs — {employee?.firstName} {employee?.lastName}
          </h2>

          <button
            onClick={onClose}
            className="px-3 py-1 sm:px-4 sm:py-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm"
          >
            Close
          </button>
        </div>

        {/* GRID LOGS (FULL RESPONSIVE) */}
        <div className="
          grid 
          grid-cols-1 
          xs:grid-cols-2 
          md:grid-cols-3 
          lg:grid-cols-4 
          gap-3 sm:gap-4
        ">
          {logs?.length === 0 ? (
            <p className="col-span-full text-center text-gray-500">No logs found</p>
          ) : (
            logs.map((d) => (
              <div
                key={d.id}
                className="
                  p-3 sm:p-4 
                  rounded-xl border border-gray-300 dark:border-gray-700 
                  bg-white/80 dark:bg-gray-800 
                  text-center shadow-sm
                "
              >
                <p className="font-semibold text-sm sm:text-base">
                  {toISODate(d.date)}
                </p>

                <p className="text-xs sm:text-sm mt-1 font-medium">
                  Status:{" "}
                  <span className="font-bold">
                   {STATUS_LABELS[d.status] || d.status}
                  </span>
                </p>

                <p className="text-xs sm:text-sm mt-1">
                  In: {formatTime(d.checkIn)}
                </p>

                <p className="text-xs sm:text-sm">
                  Out: {formatTime(d.checkOut)}
                </p>

<p className="text-xs sm:text-sm font-medium mt-1">
  Hours:{" "}
  {["WEEKOFF", "LEAVE", "ABSENT"].includes(d.status)
    ? "—"
    : `${parseHours(d.checkIn, d.checkOut)} hrs`}
</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
