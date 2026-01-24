// ====================== FULL UPDATED Dashboard with WFH Box + Calendar Color ======================

import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { Line, Bar } from "react-chartjs-2";
import clsx from "clsx";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { FiRefreshCw, FiDownload, FiBell } from "react-icons/fi";
import useAuthStore from "../stores/authstore";
import { useNavigate } from "react-router-dom";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export default function EmployeeDashboard() {
  const user = useAuthStore((s) => s.user);

  const [data, setData] = useState(null);
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  /* ======================================================================================
     ATTENDANCE CALENDAR WITH WFH COLOR
  ====================================================================================== */
// Small Monthly Attendance Calendar (Dashboard)
const SmallMonthCalendar = ({ attendance = [] }) => {
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const attMap = {};
  attendance.forEach((a) => {
    const iso =
      typeof a.date === "string"
        ? a.date.slice(0, 10)
        : new Date(a.date).toLocaleDateString("en-CA");
attMap[iso] = {
  present:
    a.status === "PRESENT" ||
    a.status === "LATE" ||
    a.status === "ON_TIME",

  wfh: a.status === "WFH",
  compOff: a.status === "COMP_OFF",
  leave:
  a.status === "LEAVE" ||
  a.status === "PAID" ||
  a.status === "SICK" ||
  a.status === "CASUAL" ||
  a.status === "UNPAID",
  halfDay: a.status === "HALF_DAY",
  holiday: a.status === "HOLIDAY",
  
  weekOff:
    a.status === "WEEKOFF" ||
    a.status === "WEEK_OFF",

  weekOffPresent:
    a.status === "WEEKOFF_PRESENT",
};
  });

  const offset = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);

  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d);
    const iso = date.toLocaleDateString("en-CA");
    const rec = attMap[iso] || {};

    cells.push({
      day: d,
      iso,
      ...rec,
      isFuture: date > now,
      today: iso === new Date().toLocaleDateString("en-CA"),
    });
  }

  return (
    <div className="p-4 bg-white/80 dark:bg-gray-800/60 rounded-2xl shadow">
      <h3 className="font-semibold mb-3">This Month Attendance</h3>

      {/* Weekdays */}
      <div className="grid grid-cols-7 text-center font-semibold text-xs mb-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="dark:text-gray-300">{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-2 text-center text-sm">
        {cells.map((c, idx) => {
          if (!c)
            return <div key={`e-${idx}`} className="p-3 rounded-lg"></div>;

          let clsLight = "";
          let clsDark = "";

          // 🌞 LIGHT MODE COLORS
          if (c.present) clsLight = "bg-green-200/40 border-green-500 text-green-700";
          else if (c.wfh) clsLight = "bg-blue-200/40 border-blue-500 text-blue-700";
          else if (c.halfDay) clsLight = "bg-purple-200/40 border-purple-500 text-purple-700";
          else if (c.compOff) clsLight = "bg-amber-200/40 border-amber-500 text-amber-700";
          else if (c.weekOffPresent) clsLight = "bg-gray-400/50 border-gray-600 text-gray-800";
          else if (c.weekOff) clsLight = "bg-orange-200/50 border-orange-500 text-orange-700";
          else if (c.holiday) clsLight = "bg-gradient-to-br from-yellow-200 via-yellow-200 to-orange-200 " + "border-orange-500 text-orange-800";
          else if (c.leave) clsLight = "bg-yellow-200/40 border-yellow-500 text-yellow-700";
          else if (c.isFuture) clsLight = "bg-gray-300/30 border-gray-400 text-gray-500";
          else clsLight = "bg-red-200/40 border-red-500 text-red-700";

          // 🌚 DARK MODE SOLID COLORS (visible)
    if (c.present) clsDark = "dark:bg-green-700 dark:border-green-400 dark:text-green-100";
else if (c.halfDay) clsDark = "dark:bg-purple-700 dark:border-purple-400 dark:text-purple-100";
else if (c.compOff) clsDark = "dark:bg-amber-700 dark:border-amber-400 dark:text-amber-100";
else if (c.wfh) clsDark = "dark:bg-blue-700 dark:border-blue-400 dark:text-blue-100";
else if (c.weekOffPresent) clsDark = "dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100";
else if (c.weekOff) clsDark = "dark:bg-orange-700 dark:border-orange-400 dark:text-orange-100";
else if (c.holiday)
  clsDark =
    "dark:bg-gradient-to-br dark:from-yellow-600 dark:via-orange-400 dark:to-orange-600 " +
    "dark:border-orange-400 dark:text-orange-100";

else if (c.leave) clsDark = "dark:bg-yellow-700 dark:border-yellow-400 dark:text-yellow-100";
else if (c.isFuture) clsDark = "dark:bg-gray-700 dark:border-gray-500 dark:text-gray-300";
else clsDark = "dark:bg-red-700 dark:border-red-400 dark:text-red-100";

          return (
            <div
              key={c.iso}
              className={`p-2 rounded-lg border ${clsLight} ${clsDark} ${
                c.today ? "ring-2 ring-indigo-500" : ""
              }`}
            >
              {c.day}
            </div>
          );
        })}
      </div>
    </div>
  );
};

  /* ======================================================================================
     LOAD DASHBOARD
  ====================================================================================== */
  const loadDashboard = async () => {
    setLoading(true);
    setData(null);

    try {
      const r = await api.get("/dashboard");
      setData(r.data);
    } catch {
      setMessage({ type: "error", text: "Failed to load dashboard" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  /* Auto-hide message */
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(t);
  }, [message]);

  /* ======================================================================================
     PAYROLL FETCH
  ====================================================================================== */
  const fetchPayrolls = async () => {
    try {
      const r = await api.get("/payroll");
      setPayrolls(r.data.payrolls || []);
    } catch {
      setMessage({ type: "error", text: "Failed to load payrolls." });
    }
  };

  useEffect(() => {
    fetchPayrolls();
  }, []);

  /* ======================================================================================
     DOWNLOAD PDF
  ====================================================================================== */
  const downloadSlip = async (p) => {
    try {
      setPayrollLoading(true);

      const r = await api.get(`/payroll/${p.id}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([r.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `Salary-Slip-${p.salaryMonth}.pdf`;
      a.click();

      setMessage({ type: "success", text: "Salary slip downloaded" });
    } catch {
      setMessage({ type: "error", text: "Download failed" });
    } finally {
      setPayrollLoading(false);
    }
  };

  /* ======================================================================================
     ATTENDANCE TREND (Chart)
  ====================================================================================== */
const attendanceBar = useMemo(() => {
  if (!data) return null;

  const months = Array.from({ length: 12 }, () => ({
    present: 0,
    wfh: 0,
    leave: 0,
    halfDay: 0,
    compOff: 0,   
  }));

data.stats.attendance.forEach((a) => {
  const d = new Date(a.date);
  const m = d.getMonth();

  switch (a.status) {
    case "PRESENT":
    case "LATE":
    case "ON_TIME":
      months[m].present += 1;
      break;

    case "WFH":
      months[m].wfh += 1;
      break;

   case "LEAVE":
case "PAID":
case "SICK":
case "CASUAL":
case "UNPAID":
  months[m].leave += 1;
  break;

    case "HALF_DAY":
      months[m].halfDay += 0.5;
      break;

    case "COMP_OFF":
      months[m].compOff += 1;
      break;

      case "HOLIDAY":
case "WEEKOFF":
case "WEEKOFF_PRESENT":
  break;

    default:
      break; // WEEKOFF / ABSENT ignored
  }
});

  // 🔥 REAL MAX VALUE
const maxValue = Math.max(
  ...months.map((m) => Math.max(m.present, m.wfh, m.leave, m.halfDay)
  )
);
  // 🔥 Y-axis ko perfect round banane ka logic
  let autoMax = Math.ceil((maxValue + 1) / 2) * 2;
  if (autoMax < 4) autoMax = 4; // minimum 4

  return {
    labels: [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ],
datasets: [
  {
    label: "Present",
    data: months.map((m) => m.present),
    backgroundColor: "#10B981",
  },
  {
    label: "Leave",
    data: months.map((m) => m.leave),
    backgroundColor: "#FACC15",
  },
  {
    label: "Half Day",
    data: months.map((m) => m.halfDay),
    backgroundColor: "#A855F7", // 🟣 PURPLE
  },
  {
    label: "WFH",
    data: months.map((m) => m.wfh),
    backgroundColor: "#3B82F6",
  },
  {
    label: "Comp-Off",
    data: months.map((m) => m.compOff),
    backgroundColor: "#D97706", // 🟤 light brown
  },
],
    autoMax,
  };
}, [data]);

  const Skeleton = ({ className }) => (
    <div
      className={clsx(
        "animate-pulse bg-gray-200/60 dark:bg-gray-700/40 rounded-md",
        className
      )}
    />
  );

const InfoBox = ({ title, subtitle, icon }) => (
<div className="flex items-center gap-3 px-4 py-3 min-h-[96px] bg-white/70 dark:bg-gray-800/50 rounded-2xl shadow">
    <div className="w-10 h-10 shrink-0 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-bold">
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-sm text-gray-500 dark:text-gray-300 leading-tight">
        {title}
      </div>
      <div className="text-xl font-semibold truncate">
        {subtitle}
      </div>
    </div>
  </div>
);

  const MessageBar = ({ msg }) => {
    if (!msg) return null;

    const color =
      msg.type === "success"
        ? "bg-green-50 text-green-800 border-green-200"
        : msg.type === "error"
        ? "bg-red-50 text-red-800 border-red-200"
        : "bg-blue-50 text-blue-800 border-blue-200";

    return (
      <div
        className={`fixed top-6 right-6 z-50 p-4 rounded-lg border ${color} shadow-lg`}
      >
        <div className="font-medium">{msg.type.toUpperCase()}</div>
        <div className="text-sm">{msg.text}</div>
      </div>
    );
  };

  return (
    <div className="p-0 space-y-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      <MessageBar msg={message} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold">
            Welcome back, {user.firstName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your performance overview
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboard}
            className="px-3 py-2 bg-white/60 dark:bg-gray-800/60 rounded-lg shadow flex items-center gap-2"
          >
            <FiRefreshCw />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => navigate("/notifications")}
            className="px-3 py-2 bg-white/60 dark:bg-gray-800/60 rounded-lg shadow flex items-center gap-2"
          >
            <FiBell />
            <span className="hidden sm:inline">Notifications</span>
          </button>
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ================= LEFT ================= */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* KPI ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {loading ? (
              <>
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </>
            ) : (
              <>
                <InfoBox title="Days Present" subtitle={data.stats.presentDays} icon="✓" />
                {/* <InfoBox
  title="Total Leaves + Half_days Applied"
  subtitle={data.stats.appliedLeaveDays}
  icon="L"
/> */}

<InfoBox
  title="Approved Leaves + Half_Days + CompOff"
  subtitle={data.stats.approvedLeaveDays}
  icon="A"
/>

<InfoBox
  title="WFH Days"
  subtitle={data.stats.appliedWFHDays}
  icon="W"
/>

              </>
            )}
          </div>

          {/* Chart */}
          <div className="p-4 bg-white/80 dark:bg-gray-800/50 rounded-2xl shadow">
            <h3 className="font-semibold mb-3">Attendance Trend</h3>

            {loading ? (
              <Skeleton className="h-40" />
            ) : (
<Bar
  data={attendanceBar}
  options={{
    responsive: true,
    plugins: {
      legend: { position: "top" },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: attendanceBar.autoMax, // 🔥 AUTO MAX VALUE
        ticks: {
          stepSize: 2,
          color: "#6B7280",
          font: {
            size: 12,
            weight: "bold",
          },
        },
        grid: {
          color: "rgba(0,0,0,0.1)",
        },
      },
      x: {
        ticks: {
          color: "#6B7280",
          font: { size: 12 },
        },
      },
    },
  }}
/>
            )}
          </div>
        </div>

        {/* ================= RIGHT ================= */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Calendar */}
<SmallMonthCalendar attendance={data?.stats?.attendance || []} />
          {/* Payroll */}
          <div className="p-4 bg-white/80 dark:bg-gray-800/50 rounded-2xl shadow">
            <h3 className="font-semibold mb-3">Recent Payrolls</h3>

            {payrollLoading ? (
              <>
                <Skeleton className="h-16 mb-2" />
                <Skeleton className="h-16 mb-2" />
              </>
            ) : (
              <div className="space-y-3">
                {payrolls.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-sm">
                        {new Date(p.salaryMonth).toLocaleDateString("en-IN", {
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-xs text-gray-500">
                        Net: ₹{p.netSalary}
                      </div>
                    </div>

                    <button
                      onClick={() => downloadSlip(p)}
                      className="px-3 py-1 rounded-lg bg-white dark:bg-gray-800/60 border hover:shadow"
                    >
                      <FiDownload />
                    </button>
                  </div>
                ))}

                {payrolls.length === 0 && (
                  <div className="text-sm text-gray-500">
                    No payroll records found.
                  </div>
                )}
              </div>
            )}

            <button
              onClick={fetchPayrolls}
              className="mt-4 w-full px-3 py-2 bg-white/60 dark:bg-gray-800/60 rounded-lg"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
