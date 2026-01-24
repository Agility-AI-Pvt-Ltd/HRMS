// ========================= PART 1 — LOGIC (FINAL WITH KPI SUPPORT) ===========================
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api/axios";
import useAuthStore from "../stores/authstore";
import AttendanceCorrectionPopup from "../components/AttendanceCorrectionPopup.jsx";

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
  return s; // backend is the single source of truth
};

const formatTime = (v) => {
  if (!v) return "--";

  const d = new Date(v);

  // 🔥 subtract 5 hours 30 minutes
  d.setMinutes(d.getMinutes() - 330);

  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

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
  const [weekOff,setWeekOff] = useState(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [checkOutSuccess, setCheckOutSuccess] = useState(false);
  const [holidaysList, setHolidaysList] = useState([]);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionDate, setCorrectionDate] = useState(null);

  const [corrections, setCorrections] = useState({});

  const openCorrectionPopup = (date) => {
    setCorrectionDate(date);
    setCorrectionOpen(true);
  };


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
    weekoffPresent: 0,
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
      setCorrections(res.data.corrections || {});

      /* ⭐ KPI CALCULATION (from full year) */
const present = Object.values(calendarMap).filter(s => s === "PRESENT" || s === "LATE").length;
const leave =
  Object.values(calendarMap).filter(s => s === "LEAVE").length +
  Object.values(calendarMap).filter(
    s => s === "HALF_DAY" || s === "HALF_DAY_PENDING"
  ).length * 0.5;
const wfh = Object.values(calendarMap).filter(s => s === "WFH").length;
const weekoffPresent = Object.values(calendarMap).filter( s => s === "WEEKOFF_PRESENT").length;
  setKpi({ present, leave, wfh, weekoffPresent});
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

  useEffect(() => {
  const loadHolidays = async () => {
    const res = await api.get("/holidays");
   setHolidaysList(res.data.holidays.map(h => ({
   date: h.date.split("T")[0],
   title: h.title
   })));
  };
  loadHolidays();
}, []);

  useEffect(()=>{
  const loadWeekOff = async ()=>{
      const r = await api.get("/weekly-off/me");
      setWeekOff(r.data.weekOff);
  }
  loadWeekOff();
  },[]);

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
if (todayLog?.status === "PRESENT") {
  const existing = newCal[todayIso];

  // ⛔ approved statuses ko override mat karo
  if (!["WFH", "LEAVE", "HALF_DAY", "HALF_DAY_PENDING"].includes(existing)) {
    newCal[todayIso] = "PRESENT";
  }
}

// ⭐ If WeekOff day + Check-In exists → Show PRESENT instead of ABSENT
// ⭐ If WeekOff day + Check-In exists → Show PRESENT or WEEKOFF in UI
if (weekOff) {
  Object.keys(newCal).forEach(date => {
    const dayName = new Date(date).toLocaleDateString("en-US", { weekday: "long" });

    const isWeekOffDate =
      (weekOff.isFixed && weekOff.offDay === dayName) ||
      (!weekOff.isFixed && toISODate(weekOff.offDate) === date);

    const log = fullData.logs.find(l => l.date === date);
    const existing = newCal[date];

    if (!isWeekOffDate) return;

    // 🟢 Highest priority
    if (log?.status === "WEEKOFF_PRESENT") {
      newCal[date] = "WEEKOFF_PRESENT";
      return;
    }

    // ⛔ Approved statuses should NEVER be overridden
    if (["WFH", "LEAVE", "HALF_DAY", "HALF_DAY_PENDING"].includes(existing)) {
      return;
    }

    // Default weekoff
    newCal[date] = "WEEKOFF";
  });
}


      /* ⭐ KPI CALCULATION FOR FILTER RANGE */
const present = Object.values(newCal).filter(
  s => s === "PRESENT" || s === "LATE"
).length;
const leave =
  Object.values(newCal).filter(s => s === "LEAVE").length +
  Object.values(newCal).filter(s => s === "HALF_DAY").length * 0.5;
const wfh = Object.values(newCal).filter(s => s === "WFH").length;
const weekoffPresent = Object.values(newCal)
  .filter(s => s === "WEEKOFF_PRESENT").length;
setKpi({ present, leave, wfh, weekoffPresent });

      setCalendar(newCal);
      setDailyLogs([...newLogs].reverse());
    } finally {
      setLoading(false);
    }
  },
  [fullData , weekOff]
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

   setCheckInSuccess(true);
   setTimeout(() => setCheckInSuccess(false), 1000);   // 1 sec बाद hide

  } catch {
    setError("Check-in failed");
  }
};

  /* CHECK-OUT */
const checkOut = async () => {
  try {
    await api.post("/attendance/checkout");

    await refreshUser();        // ⭐ COMP-OFF BALANCE UPDATE
    await loadFullYear();
    loadAttendance(filters);

    setCheckOutSuccess(true);
    setTimeout(() => setCheckOutSuccess(false), 1000);
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
    const holiday = holidaysList.find(h => h.date === iso);
    const isHoliday = !!holiday;
    const holidayName = holiday?.title || null;

    const status = calendar[iso] || "ABSENT";

    // ⭐ WeekOff Logic FIXED (Correct Day Match)
    const dayName = d.toLocaleDateString("en-US",{weekday:"long"});
    const isWeekOff = weekOff && (
      (weekOff.isFixed && weekOff.offDay === dayName) ||
      (!weekOff.isFixed && toISODate(weekOff.offDate) === iso)
    );

    // ⭐ WeekOff + Holiday Combined Rule
    const isOverlap = isHoliday && isWeekOff;

    return { 
      iso,
      day: d.getDate(),
status: isOverlap ? "HOLIDAY_WEEKOFF"
 : isHoliday ? "HOLIDAY"
 : status === "WEEKOFF_PRESENT" ? "WEEKOFF_PRESENT"
 : isWeekOff ? "WEEKOFF"
 : status,     
      isWeekOff,
      isHoliday,
      isOverlap,
      holidayName
    };
  });
}, [filters, calendar, weekOff, holidaysList]);

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
{/* Assigned WeekOff */}
<div className="p-5 rounded-2xl shadow-xl bg-white dark:bg-gray-900 border dark:border-[#2a2c33]">
  <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
    {weekOff  ? weekOff.isFixed  ? weekOff.offDay : `${weekOff.offDate}`  : "Not Assigned"}
  </div>
  <div className="text-sm text-gray-600 dark:text-gray-300">
    Assigned WeekOff
  </div>
</div>
{/*WeekOff Present*/}
        <div className="p-5 rounded-2xl shadow-xl bg-white dark:bg-gray-900 border dark:border-[#2a2c33]">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {kpi.weekoffPresent}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Total WeekOff Present
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
  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold shadow flex items-center justify-center gap-2"
>
 {checkInSuccess ? "✔" : "Check-in"}
</button>
<button
  onClick={checkOut}
  className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow flex items-center justify-center gap-2"
>
 {checkOutSuccess ? "✔" : "Check-out"}
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
      (() => {
        const iso = cell.iso;
        const holiday = holidaysList.find(h => h.date === iso);
        const isHoliday = !!holiday;
        const holidayName = holiday?.title;

        const status = calendar[iso] || "ABSENT";

        // ⭐ WeekOff logic same for year
        const d = new Date(iso);
        const dayName = d.toLocaleDateString('en-US',{weekday:'long'});
        const isWeekOff = weekOff && (
          (weekOff.isFixed && weekOff.offDay === dayName) ||
          (!weekOff.isFixed && weekOff.offDate === iso)
        );
        /* 🟣 SPECIAL CASE: Holiday + WeekOff */
        const isOverlap = isHoliday && isWeekOff;
        return (
          <div
            key={iso}
  className={`h-12 sm:h-14 rounded-md flex flex-col items-center justify-center 
  text-[8px] sm:text-[9px] font-medium overflow-hidden text-center px-1 leading-tight

              ${isOverlap
                ? "bg-purple-300 text-black font-bold dark:bg-purple-700 dark:text-white"   // ⭐ overlap UI
                : isHoliday
                ? "bg-yellow-300 text-black font-bold dark:bg-yellow-600"
                : status === "HALF_DAY_PENDING"|| status === "HALF_DAY"
  ? "bg-yellow-300 text-black font-bold dark:bg-yellow-600"
                : status === "WEEKOFF_PRESENT"
                ? "bg-gray-300 dark:bg-gray-600 text-black dark:text-white"
              : isWeekOff
                ? "bg-orange-200 text-black dark:bg-orange-600"
                : status === "WFH"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200"
              : status === "PRESENT"
                ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200"
              : status === "LEAVE"
                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-yellow-200"
              : "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200"
            }`}
          >
            <div className="font-bold">{cell.day}</div>

            {/* 📌 Show only holiday name even if weekoff + holiday */}
{isHoliday ? (
  <div className="text-[7px] sm:text-[8px] leading-none font-bold truncate w-full text-center">
    {holidayName}
  </div>
): status === "WEEKOFF_PRESENT" ? (
  <div className="text-[7px] sm:text-[8px] font-bold truncate">
    WeekOff Present
  </div>
) : isWeekOff ? (
  <div className="text-[7px] leading-none truncate w-full text-center">WeekOff</div>
) : (
  <div className="truncate w-full">{status.slice(0,3)}</div>
)}

          </div>
        );
      })()
    )
  )}
</div>

              </div>
            ))}
          </div>
        ) : (
/* NORMAL VIEW */
(
<div>

  {/* Weekday headers */}
  <div className="grid grid-cols-7 gap-2 mb-4">
    {WEEKDAYS.map(w => (
      <div key={w} className="text-center font-bold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
        {w}
      </div>
    ))}
  </div>

  {/* Month View / Week View both auto-align using filters.start */}
  <div className="grid grid-cols-7 gap-2 sm:gap-3">
  {(() => {
  const s = new Date(filters.start);
  const e = new Date(filters.end);
  const diff = (e - s) / (1000*60*60*24);

  // ------------------ 🔥 Week View ------------------
  if(diff <= 7) {
    return calendarDays.map((d) => (
      <div
        key={d.iso}
        className={`p-3 sm:p-4 rounded-xl text-center shadow border dark:border-[#2a2c33]
        ${d.isOverlap ? "bg-purple-300 dark:bg-purple-700 dark:text-white"
        : d.isHoliday ? "bg-yellow-300 dark:bg-yellow-600 text-black font-bold"
        : d.status === "HALF_DAY_PENDING"|| d.status === "HALF_DAY" ? "bg-yellow-300 dark:bg-yellow-600 text-black font-bold"
        : d.status === "WEEKOFF_PRESENT" ? "bg-gray-300 dark:bg-gray-600 text-black dark:text-white"
        : d.isWeekOff ? "bg-orange-300 dark:bg-orange-600 text-black font-bold"
        : d.status === "WFH" ? "bg-blue-100 dark:bg-blue-800 dark:text-blue-200"
        : d.status === "PRESENT" ? "bg-green-100 dark:bg-green-800 dark:text-green-200"
        : d.status === "LEAVE" ? "bg-yellow-200 dark:bg-yellow-700"
        : "bg-red-100 dark:bg-red-800 dark:text-red-200"
        }`}>
          <div className="text-lg sm:text-2xl font-bold">{d.day}</div>
          <div className="text-[10px] font-semibold leading-tight">
            {d.isHoliday ? d.holidayName: d.status === "WEEKOFF_PRESENT" ? "WeekOff Present":d.isWeekOff ? "WeekOff" : d.status}
          </div>
      </div>
    ));
  }
  // ------------------ 🔥 Month View ------------------
  const base = new Date(filters.start);
  const year = base.getFullYear();
  const month = base.getMonth();
  const matrix = monthMatrix(year, month);

  return matrix.flat().map((cell, idx) => {
    if(!cell) return <div key={idx} className="h-12 sm:h-16"></div>;

    const iso = toISODate(cell);
    const d = calendarDays.find(x => x.iso === iso);

    if(!d) return <div key={iso} className="h-12 sm:h-16 opacity-20"></div>;

    return (
      <div
        key={iso}
        className={`p-3 sm:p-4 rounded-xl text-center shadow border dark:border-[#2a2c33]
        ${d.isOverlap ? "bg-purple-300 dark:bg-purple-700 dark:text-white"
        : d.isHoliday ? "bg-yellow-300 dark:bg-yellow-600 text-black font-bold"
        : d.status === "HALF_DAY_PENDING" || d.status === "HALF_DAY" ? "bg-yellow-300 dark:bg-yellow-600 text-black font-bold"
        : d.status === "WEEKOFF_PRESENT" ? "bg-gray-300 dark:bg-gray-600 text-black dark:text-white"
        : d.isWeekOff ? "bg-orange-300 dark:bg-orange-600 text-black font-bold"
        : d.status === "WFH" ? "bg-blue-100 dark:bg-blue-800 dark:text-blue-200"
        : d.status === "PRESENT" ? "bg-green-100 dark:bg-green-800 dark:text-green-200"
        : d.status === "LEAVE" ? "bg-yellow-200 dark:bg-yellow-700"
        : "bg-red-100 dark:bg-red-800 dark:text-red-200"
      }`}>
        <div className="text-lg sm:text-2xl font-bold">{d.day}</div>
        <div className="text-[10px] font-semibold leading-tight">
          {d.isHoliday ? d.holidayName: d.status === "WEEKOFF_PRESENT"  ? "WeekOff Present": d.isWeekOff ? "WeekOff" : d.status}
        </div>
      </div>
    );
  });
})()}
  </div>
</div>
)
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
              onChange={(e) => {setLogFilter((p) => ({ ...p, start: e.target.value }));setPage(1);}}
              className="px-2 py-1 text-sm rounded-lg border dark:border-[#2a2c33] dark:bg-gray-800 dark:text-white"
            />
            <span className="dark:text-gray-300">→</span>
            <input
              type="date"
              value={logFilter.end}
              min={logFilter.start || undefined}
              onChange={(e) => setLogFilter((p) => ({ ...p, end: e.target.value }))
              }
              className="px-2 py-1 text-sm rounded-lg border dark:border-[#2a2c33] dark:bg-gray-800 dark:text-white"
            />

            {(logFilter.start || logFilter.end) && (
              <button
                onClick={() => {setLogFilter({ start: "", end: "" }); setPage(1);
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
    className="p-3 rounded-xl border shadow bg-white dark:bg-gray-800 
    dark:border-[#2a2c33] flex flex-col sm:flex-row justify-between items-center gap-3"

  >

    {/* LEFT SIDE */}
    <div>
      <div className="font-bold text-sm sm:text-base dark:text-white">
        {log.date}
      </div>

      <div className="flex flex-wrap gap-3 mt-1 text-xs sm:text-sm dark:text-gray-300">
<span
  className={`px-2 py-1 rounded-full text-xs font-bold 
    ${
      log.status === "HALF_DAY_PENDING"
        ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-black"
        : log.status === "WEEKOFF_PRESENT"
        ? "bg-gray-300 text-black dark:bg-gray-600 dark:text-white"
        : log.status === "WFH"
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
        : log.status === "PRESENT"
        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
        : log.status === "LEAVE" || log.status === "HALF_DAY"
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200"
        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
    }`}
>
  {log.status === "HALF_DAY_PENDING" ? "HALF DAY (Pending)" : log.status}
</span>
        <span><b>In:</b> {formatTime(log.checkIn)}</span>
        {log.checkOut && (
          <span><b>Out:</b> {formatTime(log.checkOut)}</span>
        )}
      </div>
    </div>

{(() => {
  const todayIso = toISODate(new Date());
  const correction = corrections[log.date];

  // ❌ Today ke liye request nahi
  if (log.date === todayIso) return null;

  // ❌ Sirf ABSENT ke liye
  if (log.status !== "ABSENT") return null;

  // 🟡 Pending
  if (correction?.status === "PENDING") {
    return (
      <span className="px-2 py-1 text-xs font-bold rounded bg-yellow-300 text-black">
        Wait for Admin Decision
      </span>
    );
  }

  // 🔴 Rejected
  if (correction?.status === "REJECTED") {
    return (
      <div className="text-xs text-red-600 font-semibold">
       Rejected : {correction.adminReason || "No reason given"}
      </div>
    );
  }

  // 🟢 No request yet
  if (!correction) {
    return (
      <button
        onClick={() => openCorrectionPopup(log.date)}
        className="text-xs px-2 py-1 bg-indigo-600 text-white rounded"
      >
        Request Present
      </button>
    );
  }

  return null;
})()}
    {/* RIGHT SIDE — TOTAL HOURS */}
    <div className="text-right">
      <div className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400">
        {["WEEKOFF", "LEAVE", "ABSENT"].includes(log.status)
          ? "—"
          : `${parseHours(log.checkIn, log.checkOut)}h`}
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
          </div> )}
      </div>

      {/* ERROR POPUP */}
      {error && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-red-600 text-white px-4 py-3 rounded-xl shadow-xl animate-slide-in">
            {error}
          </div>
        </div>

      )}
      
{correctionOpen && (
  <AttendanceCorrectionPopup
    date={correctionDate}
    onClose={() => setCorrectionOpen(false)}
onSuccess={async (reason) => {
  try {
    await api.post("/attendance-corrections/request", {
      date: correctionDate,
      reason,
    });

    // ⭐ instant UI update
    setCorrections(prev => ({
      ...prev,
      [correctionDate]: {
        status: "PENDING",
        adminReason: null
      }
    }));

    setCorrectionOpen(false);
  } catch (e) {
    setError(
      e?.response?.data?.message || "Correction request failed"
    );
  }
}}
  />
)}

    </div>
  </div>);
};
// ========================= END PART 2 ===========================