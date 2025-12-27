// ========================= PART 1 — LOGIC (FINAL WITH KPI SUPPORT) ===========================
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api/axios";

/* ------------------ HELPERS ------------------ */
const toISODate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
};

const uiStatus = (s) => {
  if (!s) return "ABSENT";
  if (s === "LATE") return "PRESENT";
  return s;
};

const formatTime = (v) =>
  v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";

const parseHours = (cin, cout) => {
  if (!cin || !cout) return 0;
  const diff = new Date(cout) - new Date(cin);
  return diff > 0 ? +(diff / 3600000).toFixed(2) : 0;
};

/* ------------------ DATE UTILITIES ------------------ */
function iterateDatesInclusive(startIso, endIso) {
  const arr = [];
  let cur = new Date(startIso + "T00:00:00");
  const end = new Date(endIso + "T00:00:00");
  while (cur <= end) {
    arr.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return arr;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const start = startOfWeek(first);
  const end = new Date(last);

  const fill = (7 - ((end.getDay() + 6) % 7) - 1 + 7) % 7;
  const endInc = new Date(end);
  endInc.setDate(end.getDate() + fill);

  let cur = new Date(start);
  const weeks = [];

  while (cur <= endInc) {
    const w = [];
    for (let i = 0; i < 7; i++) {
      w.push(cur.getMonth() === month ? new Date(cur) : null);
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(w);
  }
  return weeks;
}

/* QUICK FILTERS */
const getThisWeek = () => {
  const now = new Date();
  const s = startOfWeek(now);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  return { start: toISODate(s), end: toISODate(e) };
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
    start: `${d.getFullYear()}-01-01`,
    end: `${d.getFullYear()}-12-31`,
  };
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ======================= MAIN COMPONENT ======================= */

export default function AttendanceEmployee() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* FULL YEAR CACHED DATA */
  const [fullData, setFullData] = useState({
    calendar: {},
    logs: [],
  });

  /* ⭐ KPI COUNTS */
  const [kpi, setKpi] = useState({
    present: 0,
    leave: 0,
    wfh: 0,
  });

  const [filters, setFilters] = useState(getThisWeek());
  const [calendar, setCalendar] = useState({});
  const [dailyLogs, setDailyLogs] = useState([]);

  const [logFilter, setLogFilter] = useState({ start: "", end: "" });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 7;

  const filteredLogs = useMemo(() => {
    if (!logFilter.start && !logFilter.end) return dailyLogs;

    return dailyLogs.filter((log) => {
      if (logFilter.start && log.date < logFilter.start) return false;
      if (logFilter.end && log.date > logFilter.end) return false;
      return true;
    });
  }, [logFilter, dailyLogs]);

  const paginatedLogs = useMemo(() => {
    const s = (page - 1) * PAGE_SIZE;
    return filteredLogs.slice(s, s + PAGE_SIZE);
  }, [page, filteredLogs]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);

  /* ------------------ 1. LOAD FULL YEAR ------------------ */
  const loadFullYear = useCallback(async () => {
    try {
      const year = new Date().getFullYear();
      const q = `start=${year}-01-01&end=${year}-12-31`;

      const res = await api.get(`/attendance/me?${q}`);

      const rawCal = res.data.calendar || {};
      const attends = res.data.attendances || [];

      const calendarMap = {};
      Object.keys(rawCal).forEach((k) => {
        calendarMap[toISODate(k)] = uiStatus(rawCal[k]);
      });

      const logs = attends.map((a) => ({
        ...a,
        date: toISODate(a.date),
        status: uiStatus(a.status),
      }));

      setFullData({ calendar: calendarMap, logs });

      /* ⭐ KPI CALCULATION (from full year) */
      const present = Object.values(calendarMap).filter((s) => s === "PRESENT").length;
      const leave = Object.values(calendarMap).filter((s) => s === "LEAVE").length;
      const wfh = Object.values(calendarMap).filter((s) => s === "WFH").length;

      setKpi({ present, leave, wfh });
    } catch (err) {
      console.log("YEAR LOAD FAILED", err);
    }
  }, []);

  useEffect(() => {
    loadFullYear();
  }, [loadFullYear]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 2000);
      return () => clearTimeout(t);
    }
  }, [error]);

  /* ------------------ 2. APPLY FILTERS ------------------ */
const loadAttendance = useCallback(
  (range) => {
    try {
      setLoading(true);

      const newCal = {};
      const newLogs = [];

      const allDates = iterateDatesInclusive(range.start, range.end);

      allDates.forEach((d) => {
        const iso = toISODate(d);
        newCal[iso] = fullData.calendar[iso] || "ABSENT";
      });

      fullData.logs.forEach((l) => {
        if (l.date >= range.start && l.date <= range.end) {
          newLogs.push(l);
        }
      });
const todayIso = toISODate(new Date());
const todayLog = fullData.logs.find((x) => x.date === todayIso);
if (todayLog?.status === "PRESENT") newCal[todayIso] = "PRESENT";

      /* ⭐ KPI CALCULATION FOR FILTER RANGE */
      const present = Object.values(newCal).filter((s) => s === "PRESENT").length;
      const leave = Object.values(newCal).filter((s) => s === "LEAVE").length;
      const wfh = Object.values(newCal).filter((s) => s === "WFH").length;
      setKpi({ present, leave, wfh });

      setCalendar(newCal);
      setDailyLogs([...newLogs].reverse());
    } finally {
      setLoading(false);
    }
  },
  [fullData]
);

  useEffect(() => {
    if (fullData.logs.length > 0) loadAttendance(filters);
  }, [filters, fullData, loadAttendance]);

  /* CHECK-IN */
  const checkIn = async () => {
    try {
      await api.post("/attendance/checkin");
      await loadFullYear();
      loadAttendance(filters);
    } catch {
      setError("Check-in failed");
    }
  };

  /* CHECK-OUT */
  const checkOut = async () => {
    try {
      await api.post("/attendance/checkout");
      await loadFullYear();
      loadAttendance(filters);
    } catch {
      setError("Check-out failed");
    }
  };

  /* EXPORT */
  const exportFile = async (format = "csv") => {
    try {
      const q = new URLSearchParams(filters).toString();
      const res = await api.get(`/attendance/export?format=${format}&${q}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance.${format}`;
      a.click();
      a.remove();
    } catch {
      setError("Export failed");
    }
  };

  /* YEAR CHECK */
  const isYearView = useMemo(() => {
    const s = new Date(filters.start);
    const e = new Date(filters.end);
    return s.getMonth() === 0 && e.getMonth() === 11;
  }, [filters]);

  /* CALENDAR DAYS */
  const calendarDays = useMemo(() => {
    return iterateDatesInclusive(filters.start, filters.end).map((d) => {
      const iso = toISODate(d);
      return { iso, day: d.getDate(), status: calendar[iso] || "ABSENT" };
    });
  }, [filters, calendar]);

  /* MONTH MATRIX FOR YEAR */
  const yearMonths = useMemo(() => {
    if (!isYearView) return [];

    const year = new Date(filters.start).getFullYear();
    return Array.from({ length: 12 }).map((_, m) => {
      const matrix = monthMatrix(year, m);
      return {
        month: m,
        label: new Date(year, m, 1).toLocaleString(undefined, { month: "long" }),
        weeks: matrix.map((w) =>
          w.map((cell) =>
            cell
              ? {
                  iso: toISODate(cell),
                  day: cell.getDate(),
                  status: calendar[toISODate(cell)] || "ABSENT",
                }
              : null
          )
        ),
      };
    });
  }, [isYearView, filters, calendar]);

// ========================= END OF PART 1 ===========================
// ========================= PART 2 — UI (FINAL WITH KPI BOX) ===========================
return (
  <div className="min-h-screen">
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

      {/* HEADER */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl 
      p-5 sm:p-6 border border-gray-200 dark:border-[#2a2c33]">

        <div className="flex flex-col lg:flex-row justify-between gap-5">

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              My Attendance
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
              Track attendance, working hours & export records.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3">

            {/* EXPORT */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => exportFile("csv")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg shadow"
              >
                Export CSV
              </button>

              <button
                onClick={() => exportFile("xlsx")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg shadow"
              >
                Export Excel
              </button>
            </div>

            {/* FILTER BUTTONS */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilters(getThisWeek())}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs"
              >
                This Week
              </button>

              <button
                onClick={() => setFilters(getThisMonth())}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs"
              >
                This Month
              </button>

              <button
                onClick={() => setFilters(getThisYear())}
                className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs"
              >
                This Year
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ⭐ KPI SECTION */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* PRESENT */}
        <div className="p-5 rounded-2xl shadow-xl bg-white dark:bg-gray-900 border dark:border-[#2a2c33]">
          <div className="text-xl font-bold text-green-600 dark:text-green-400">
            {kpi.present}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Total Present
          </div>
        </div>

        {/* LEAVE */}
        <div className="p-5 rounded-2xl shadow-xl bg-white dark:bg-gray-900 border dark:border-[#2a2c33]">
          <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
            {kpi.leave}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Total Leave
          </div>
        </div>

        {/* WFH */}
        <div className="p-5 rounded-2xl shadow-xl bg-white dark:bg-gray-900 border dark:border-[#2a2c33]">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {kpi.wfh}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Total WFH
          </div>
        </div>

      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-2xl shadow-xl 
      border border-gray-300 dark:border-[#2a2c33]">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Quick Actions
        </h2>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={checkIn}
            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold shadow"
          >
            Check-in
          </button>

          <button
            onClick={checkOut}
            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow"
          >
            Check-out
          </button>
        </div>
      </div>

      {/* CALENDAR */}
      <div className="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-2xl shadow-xl 
      border border-gray-300 dark:border-[#2a2c33]">

        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Attendance Calendar
          </h2>

          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isYearView ? "Year Overview" : `${filters.start} → ${filters.end}`}
          </span>
        </div>

        {/* YEAR VIEW */}
        {isYearView ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

            {yearMonths.map((m) => (
              <div 
                key={m.month} 
                className="p-4 rounded-xl border shadow bg-white dark:bg-gray-800 
                dark:border-[#2a2c33]"
              >
                <h3 className="text-lg font-bold mb-3 text-center dark:text-white">
                  {m.label}
                </h3>

                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {w}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {m.weeks.flat().map((cell, idx) =>
                    !cell ? (
                      <div key={idx} className="h-8 sm:h-10"></div>
                    ) : (
                      <div
                        key={cell.iso}
                        className={`h-10 sm:h-12 rounded-md flex flex-col items-center justify-center text-xs font-medium 
                        ${
                          cell.status === "PRESENT"
                            ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200"
                          : cell.status === "WFH"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                          : cell.status === "LEAVE"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-yellow-200"
                            : "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200"
                        }`}
                      >
                        <div className="font-bold">{cell.day}</div>
                        <div>{cell.status.slice(0, 3)}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}

          </div>
        ) : (
          /* NORMAL VIEW */
          <div>

            <div className="grid grid-cols-7 gap-2 mb-4">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center font-bold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-3">
              {calendarDays.map((d) => (
                <div
                  key={d.iso}
                  className={`p-3 sm:p-4 rounded-xl text-center shadow border 
                  dark:border-[#2a2c33] dark:bg-gray-800 transition 
                  ${
                    d.status === "PRESENT"
                      ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200"
                    : d.status === "WFH"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
                    : d.status === "LEAVE"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-yellow-200"
                    : "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200"
                  }`}
                >
                  <div className="text-lg sm:text-2xl font-bold">{d.day}</div>
<div className="text-center leading-tight font-semibold min-h-[20px]">

  {/* Mobile → sirf first letter */}
  <span className="block sm:hidden text-[8px]">
    {d.status.charAt(0)}
  </span>

  {/* Desktop → full text */}
  <span className="hidden sm:block text-[12px]">
    {d.status}
  </span>

</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DAILY LOGS */}
      <div className="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-2xl shadow-xl 
      border border-gray-300 dark:border-[#2a2c33]">

        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">

          <h2 className="text-lg font-semibold dark:text-white">Daily Logs</h2>

          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="date"
              value={logFilter.start}
              max={logFilter.end || undefined}
              onChange={(e) => {
                setLogFilter((p) => ({ ...p, start: e.target.value }));
                setPage(1);
              }}
              className="px-2 py-1 text-sm rounded-lg border dark:border-[#2a2c33] dark:bg-gray-800 dark:text-white"
            />

            <span className="dark:text-gray-300">→</span>

            <input
              type="date"
              value={logFilter.end}
              min={logFilter.start || undefined}
              onChange={(e) =>
                setLogFilter((p) => ({ ...p, end: e.target.value }))
              }
              className="px-2 py-1 text-sm rounded-lg border dark:border-[#2a2c33] dark:bg-gray-800 dark:text-white"
            />

            {(logFilter.start || logFilter.end) && (
              <button
                onClick={() => {
                  setLogFilter({ start: "", end: "" });
                  setPage(1);
                }}
                className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {page} / {totalPages || 1}
          </span>
        </div>

        {loading ? (
          <p className="text-center py-4 dark:text-white">Loading...</p>
        ) : paginatedLogs.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400">No logs found</p>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">

            {paginatedLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl border shadow 
                bg-white dark:bg-gray-800 dark:border-[#2a2c33]
                flex flex-col sm:flex-row justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-sm sm:text-base dark:text-white">
                    {log.date}
                  </div>

                  <div className="flex flex-wrap gap-3 mt-1 text-xs sm:text-sm dark:text-gray-300">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold 
                      ${
                        log.status === "PRESENT"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                        : log.status === "WFH"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                        : log.status === "LEAVE"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200"
                        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {log.status}
                    </span>

                    <span><b>In:</b> {formatTime(log.checkIn)}</span>

                    {log.checkOut && (
                      <span><b>Out:</b> {formatTime(log.checkOut)}</span>
                    )}
                  </div>
                </div>

                <div className="sm:text-right flex sm:block justify-between">
                  <div className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400">
                    {parseHours(log.checkIn, log.checkOut)}h
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Total Hours
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-3 mt-4">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 bg-gray-200 dark:bg-[#2a2c33] dark:text-white rounded-lg disabled:opacity-40"
            >
              ⬅ Previous
            </button>

            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 bg-gray-200 dark:bg-[#2a2c33] dark:text-white rounded-lg disabled:opacity-40"
            >
              Next ➜
            </button>
          </div>
        )}
      </div>

      {/* ERROR POPUP */}
      {error && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-red-600 text-white px-4 py-3 rounded-xl shadow-xl animate-slide-in">
            {error}
          </div>
        </div>
      )}

    </div>
  </div>
);
};
// ========================= END PART 2 ===========================