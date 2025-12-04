// src/pages/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { Bar, Line, Doughnut, Pie } from "react-chartjs-2";
import { FiDownload, FiRefreshCw, FiPlus, FiFileText } from "react-icons/fi";
import clsx from "clsx";
import useAuthStore from "../stores/authstore";


import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const [generating, setGenerating] = useState(false);
  const [payrolls, setPayrolls] = useState([]);
  const [payrollsLoading, setPayrollsLoading] = useState(true);
  

  // Load Dashboard
  const loadDashboard = async () => {
    setLoading(true);
    setData(null);

    try {
      const r = await api.get("/dashboard");
      setData(r.data);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load dashboard" });
    } finally {
      setLoading(false);
    }
  };

  // Generate Single Payroll
const generateSingle = async (id) => {
  try {
    const r = await api.post(`/payroll/${id}/generate`);

    setMessage({
      type: "success",
      text: r.data.message || "Payroll generated",
    });

    fetchPayrolls();
    loadDashboard();
  } catch (err) {
    setMessage({
      type: "error",
      text: err.response?.data?.message || "Generation failed",
    });
  }
};

  useEffect(() => {
    loadDashboard();
  }, []);

  // Payrolls
  const fetchPayrolls = async () => {
    setPayrollsLoading(true);
    try {
      const r = await api.get("/payroll");
      setPayrolls(r.data.payrolls || []);
    } catch {
      setMessage({ type: "error", text: "Failed to load payrolls" });
    } finally {
      setPayrollsLoading(false);
    }
  };
  const deletePayroll = async (id) => {
  if (!window.confirm("Delete this payroll record?")) return;

  try {
    await api.delete(`/payroll/${id}`);
    setMessage({ type: "success", text: "Payroll deleted" });
    fetchPayrolls();
  } catch {
    setMessage({ type: "error", text: "Delete failed" });
  }
};

  useEffect(() => {
  if (!message) return;
  const t = setTimeout(() => setMessage(null), 2000);
  return () => clearTimeout(t);
}, [message]);

  useEffect(() => {
    fetchPayrolls();
  }, []);

  // Generate Payroll
  const generatePayroll = async () => {
    setGenerating(true);
    try {
     const r = await api.post("/payroll/generate-all");
      setMessage({
        type: "success",
        text: r.data.message || "Payroll generated",
      });
      fetchPayrolls();
      loadDashboard();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Generation failed",
      });
    } finally {
      setGenerating(false);
    }
  };

  // Download Slip
const downloadSlip = async (p) => {
  try {
    const r = await api.get(`/payroll/${p.id}/download`, {
      responseType: "blob",
    });

    const blob = new Blob([r.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);

    window.open(url, "_blank");

  } catch {
    setMessage({ type: "error", text: "Download failed" });
  }
};

  // Skeleton Loader
  const Skeleton = ({ className }) => (
    <div
      className={clsx(
        "animate-pulse bg-gray-200/60 dark:bg-gray-700/40 rounded-md",
        className
      )}
    />
  );

  // InfoBox
  const InfoBox = ({ title, subtitle, icon }) => (
    <div className="flex items-center gap-4 p-4 bg-white/70 dark:bg-gray-800/50 rounded-xl shadow-sm">
      <div className="w-12 h-12 rounded-lg bg-indigo-500 text-white flex items-center justify-center text-lg font-bold">
        {icon}
      </div>
      <div>
        <div className="text-xs text-gray-500">{title}</div>
        <div className="text-xl font-semibold">{subtitle}</div>
      </div>
    </div>
  );

  // Toast
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

  // Charts
  const companyDoughnut = useMemo(() => {
    if (!data) return null;
    return {
      labels: ["Agility AI", "Lyfshilp Academy"],
      datasets: [
        {
          data: [
            data.stats.companyWise.agility,
            data.stats.companyWise.lyfshilp,
          ],
          backgroundColor: ["#6366F1", "#EC4899"],
        },
      ],
    };
  }, [data]);

  const departmentDoughnut = useMemo(() => {
    if (!data || !data.stats.departments) return null;

    const labels = data.stats.departments.map((d) => d.name);
    const counts = data.stats.departments.map(() => 1);

    return {
      labels,
      datasets: [
        {
          data: counts,
          backgroundColor: [
            "#6366F1",
            "#EC4899",
            "#10B981",
            "#F59E0B",
            "#3B82F6",
            "#8B5CF6",
            "#EF4444",
          ],
        },
      ],
    };
  }, [data]);

  const payrollBar = useMemo(() => {
    if (!data) return null;

    return {
      labels: ["Base", "Bonus", "Deductions", "Net"],
      datasets: [
        {
          label: "Total",
          data: [
            data.stats.payrollSummary.totalBase,
            data.stats.payrollSummary.totalBonus,
            data.stats.payrollSummary.totalDeduction,
            data.stats.payrollSummary.totalNet,
          ],
          backgroundColor: ["#3B82F6", "#10B981", "#EF4444", "#6366F1"],
          borderRadius: 6,
        },
      ],
    };
  }, [data]);

  const attendanceLine = useMemo(() => {
    if (!data) return null;
    return {
      labels: data.stats.attendanceTrend.map((i) =>
        new Date(i.date).toLocaleDateString()
      ),
      datasets: [
        {
          label: "Present",
          data: data.stats.attendanceTrend.map((i) => (i.checkIn ? 1 : 0)),
          borderColor: "#10B981",
          backgroundColor: "rgba(16,185,129,0.15)",
          tension: 0.35,
          fill: true,
        },
      ],
    };
  }, [data]);
  // UI START
  return (
    <div className="p-0 space-y-6 min-h-screen bg-gray-50 dark:bg-gray-900">

      <MessageBar msg={message} />

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold">Admin Console</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Company-wide insights
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboard}
            className="px-3 py-2 bg-white/70 dark:bg-gray-800/60 rounded-lg shadow flex items-center gap-2"
          >
            <FiRefreshCw /> Refresh
          </button>

          {/* <button
            disabled={generating}
            onClick={generatePayroll}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg shadow flex items-center gap-2"
          >
            <FiPlus />
            {generating ? "Generating..." : "Generate Payroll"}
          </button> */}
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT SECTION */}
        <div className="lg:col-span-8 space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {!data ? (
              <>
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </>
            ) : (
              <>
                <InfoBox
                  title="Total Employees"
                  subtitle={data.stats.totalEmployees}
                  icon="E"
                />
                <InfoBox
                  title="Departments"
                  subtitle={data.stats.totalDepartments}
                  icon="D"
                />
                <InfoBox
                  title="Present Today"
                  subtitle={data.stats.presentToday}
                  icon="P"
                />
              </>
            )}
          </div>

          {/* CHARTS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Company Distribution */}
            <div className="p-4 bg-white/70 dark:bg-gray-800/50 rounded-xl shadow">
              <h3 className="font-semibold mb-3">Employees</h3>
              {!data ? (
                <Skeleton className="h-48" />
              ) : (
                <Doughnut data={companyDoughnut} />
              )}
            </div>

            {/* Department Distribution (Pie Chart) */}
            <div
              className="p-4 bg-white/70 dark:bg-gray-800/50 rounded-xl shadow"
              style={{ height: "360px" }}
            >
              <h3 className="font-semibold mb-3">Departments</h3>

              {!data ? (
                <Skeleton className="h-48" />
              ) : (
                <Pie
                  data={departmentDoughnut}
                  options={{}}
                />
              )}
            </div>

          </div>

          {/* PAYROLL SNAPSHOT */}
          <div className="p-4 bg-white/70 dark:bg-gray-800/50 rounded-xl shadow">
            <h3 className="font-semibold mb-3">Payroll Snapshot</h3>
            {!data ? (
              <Skeleton className="h-48" />
            ) : (
              <Bar
                data={payrollBar}
                options={{
                  plugins: { legend: { display: false } },
                }}
              />
            )}
          </div>
          {/* LEAVE + WFH PANEL */}
          <div className="p-4 bg-white/70 dark:bg-gray-800/50 rounded-xl shadow space-y-5">

            <h3 className="font-semibold text-lg">People on Leave </h3>

            {!data ? (
              <>
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </>
            ) : (
              <>
                {/* ON LEAVE LIST */}
<div>
  <h4 className="text-sm font-semibold text-yellow-600 mb-2">🟡 On Leave</h4>

  {(!data.stats.leavesToday || data.stats.leavesToday.length === 0) && (
    <div className="text-xs text-gray-500">No one is on leave today.</div>
  )}

  {data.stats.leavesToday
    ?.filter((l) => l.type.toLowerCase() !== "wfh")   // 👈 MAIN FIX
    .map((l) => (
      <div
        key={l.id}
        className="flex items-center justify-between py-2 border-b dark:border-gray-700"
      >
        <div>
          <div className="text-sm font-medium">
            {l.user.firstName} {l.user.lastName}
          </div>

          <div className="text-xs text-gray-500">
            {l.type} • {l.days} day(s)
          </div>
        </div>

        <div className="text-xs text-gray-400">
          {l.startDateFormatted}
        </div>
      </div>
    ))}
</div>


                {/* WFH LIST */}
                {/* <div>
                  <h4 className="text-sm font-semibold text-blue-600 mb-2">🔵 Working From Home</h4>

                  {(!data.stats.wfhToday || data.stats.wfhToday.length === 0) && (
                    <div className="text-xs text-gray-500">No WFH today.</div>
                  )}

                  {data.stats.wfhToday?.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between py-2 border-b dark:border-gray-700"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {w.user.firstName} {w.user.lastName}
                        </div>

                        <div className="text-xs text-gray-500">
                          WFH (Working from home)
                        </div>
                      </div>

                      <div className="text-xs text-gray-400">
                        {w.dateFormatted}
                      </div>
                    </div>
                  ))}
                </div> */}
              </>
            )}
          </div>

          {/* ACTIVITY FEED (ONLY RECENT ATTENDANCE — CLEANED) */}
          <div className="p-4 bg-white/70 dark:bg-gray-800/50 rounded-xl shadow">
            <h3 className="font-semibold mb-3">Activity Feed (Recent)</h3>

            {!data ? (
              <>
                <Skeleton className="h-10 mb-2" />
                <Skeleton className="h-10 mb-2" />
              </>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {data.stats.attendanceTrend.slice(-10).reverse().map((a) => (
                  <div
                    key={a.id}
                    className="py-3 flex items-start gap-3 border-b dark:border-gray-700"
                  >
                    <div className="w-2.5 h-2.5 bg-green-400 rounded-full mt-2" />
                    <div>
                      <div className="text-sm">
                        Attendance marked by{" "}
                        <span className="font-medium">
                          {a.user.firstName} {a.user.lastName}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{a.dateFormatted}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="lg:col-span-4 space-y-6">

          {/* Attendance Mini Chart */}
          <div className="p-4 bg-white/70 dark:bg-gray-800/50 rounded-xl shadow">
            <h3 className="font-semibold mb-3">Attendance Trend (7 days)</h3>

            {!data ? (
              <Skeleton className="h-40" />
            ) : (
              <Line
                data={attendanceLine}
                options={{
                  plugins: { legend: { display: false } },
                  scales: { y: { min: 0, max: 1 } },
                }}
              />
            )}
          </div>

{/* PAYROLL MINI CARDS */}
<div className="p-4 bg-white/70 dark:bg-gray-800/50 rounded-xl shadow">
  <div className="flex items-center justify-between mb-3">
    <h3 className="font-semibold">Payrolls</h3>
    <div className="text-sm text-gray-500">{payrolls.length} records</div>
  </div>

  {payrollsLoading ? (
    <>
      <Skeleton className="h-20 mb-3" />
      <Skeleton className="h-20 mb-3" />
    </>
  ) : (
    <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2 sidebar-scroll">

      {payrolls.map((p) => (
        <div
          key={p.id}
          className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 
          border border-gray-200 dark:border-gray-700 shadow-sm"
        >
          <div className="font-medium text-sm">
            {p.user?.firstName} {p.user?.lastName} —{" "}
            {new Date(p.salaryMonth).toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric",
            })}
          </div>

          <div className="text-xs text-gray-500 mt-1">
            Base: ₹{p.baseSalary} • Bonus: ₹{p.bonus} • Ded: ₹{p.deductions}
          </div>

          <div className="font-semibold text-indigo-600 dark:text-indigo-300 text-sm mt-1">
            Net Salary: ₹{p.netSalary}
          </div>

          {/* BUTTONS ROW */}
          <div className="flex gap-2 mt-3">

            {/* Download Slip */}
            <button
              onClick={() => downloadSlip(p)}
              className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 
              text-white rounded-lg text-xs flex items-center justify-center gap-1"
            >
              <FiDownload /> Slip
            </button>

            {/* Generate Button */}
            <button
              onClick={() => generateSingle(p.id)}
              className="flex-1 px-2 py-1.5 bg-yellow-500 hover:bg-yellow-600 
              text-white rounded-lg text-xs flex items-center justify-center gap-1"
            >
              <FiFileText /> Gen
            </button>

            {/* Delete Button */}
            <button
              onClick={() => deletePayroll(p.id)}
              className="flex-1 px-2 py-1.5 bg-red-500 hover:bg-red-600 
              text-white rounded-lg text-xs flex items-center justify-center"
            >
              🗑 Delete
            </button>

          </div>
        </div>
      ))}

      {payrolls.length === 0 && (
        <div className="text-sm text-gray-500">No payroll records found.</div>
      )}
    </div>
  )}

  <div className="mt-3">
    <button
      onClick={fetchPayrolls}
      className="w-full px-3 py-2 bg-white/60 dark:bg-gray-800/60 rounded-lg"
    >
      Refresh
    </button>
  </div>
</div>

          {/* QUICK ACTIONS */}
          <div className="p-4 bg-white/70 dark:bg-gray-800/50 rounded-xl shadow">
            <h3 className="font-semibold mb-3">Quick Actions</h3>

            <div className="grid gap-2">
              <button
                onClick={() => (window.location.href = "/employees")}
                className="px-3 py-2 bg-white dark:bg-gray-900/40 rounded-lg text-left"
              >
                Manage Employees
              </button>

              <button
                onClick={() => (window.location.href = "/leaves")}
                className="px-3 py-2 bg-white dark:bg-gray-900/40 rounded-lg text-left"
              >
                Approve Leaves
              </button>

              <button
                onClick={() => (window.location.href = "/notifications")}
                className="px-3 py-2 bg-white dark:bg-gray-900/40 rounded-lg text-left"
              >
                Send Notification
              </button>
            </div>
          </div>

          {/* TODAY ACTIVITY (SCROLLABLE) */}
          <div className="p-4 bg-white/70 dark:bg-gray-800/50 rounded-xl shadow mt-4">
            <h3 className="font-semibold mb-3">Today's Activity</h3>

            {!data ? (
              <>
                <Skeleton className="h-10 mb-2" />
                <Skeleton className="h-10 mb-2" />
              </>
            ) : (
              <div className="max-h-64 overflow-y-auto pr-2 space-y-3">

                {/* Today's Leaves */}
                {data.stats.leavesToday?.map((l) => (
                  <div key={l.id} className="flex items-start gap-3 border-b pb-2">
                    <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full mt-2" />
                    <div>
                      <div className="text-sm">
                        <strong>{l.type}</strong> - {l.user.firstName} {l.user.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{l.startDateFormatted}</div>
                    </div>
                  </div>
                ))}

                {/* Today's WFH */}
                {data.stats.wfhToday?.map((w) => (
                  <div key={w.id} className="flex items-start gap-3 border-b pb-2">
                    <div className="w-2.5 h-2.5 bg-blue-400 rounded-full mt-2" />
                    <div>
                      <div className="text-sm">
                        WFH - {w.user.firstName} {w.user.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{w.dateFormatted}</div>
                    </div>
                  </div>
                ))}

                {/* Today's Attendance */}
                {data.stats.attendanceTrend
                  .filter((a) => a.isToday)
                  .map((a) => (
                    <div key={a.id} className="flex items-start gap-3 border-b pb-2">
                      <div className="w-2.5 h-2.5 bg-green-400 rounded-full mt-2" />
                      <div>
                        <div className="text-sm">
                          Attendance - {a.user.firstName} {a.user.lastName}
                        </div>
                        <div className="text-xs text-gray-500">{a.dateFormatted}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
