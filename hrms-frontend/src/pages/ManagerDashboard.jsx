import React, { useEffect, useState } from "react";
import api from "../api/axios";
import useAuthStore from "../stores/authstore";
import { FiEdit, FiTrash2 } from "react-icons/fi";

// calculate raw days between dates
const getLeaveDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const s = new Date(startDate);
  const e = new Date(endDate);
  return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
};

// display days (HALF DAY / MULTI DAY)
const getDisplayDays = (leave) => {
  if (leave.type === "HALF_DAY") return "0.5 day";
  const days = getLeaveDays(leave.startDate, leave.endDate);
  return `${days} day${days > 1 ? "s" : ""}`;
};
const toLocalISO = (date) => {
  const d = new Date(date);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

/* =========================================================
   MANAGER DASHBOARD
========================================================= */
export default function ManagerDashboard() {
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState("LEAVES");
  const [loading, setLoading] = useState(true);

  const [leaves, setLeaves] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);

const [selectedEmployees, setSelectedEmployees] = useState([]);
const [notifTitle, setNotifTitle] = useState("");
const [notifBody, setNotifBody] = useState("");
const [notifications, setNotifications] = useState([]);

const [msg, setMsg] = useState("");
const [msgType, setMsgType] = useState("success"); // success | error

/* =========================================================
   🔁 LEAVE HELPERS (SAME AS ADMIN)
========================================================= */
  /* ================= LOAD DATA ================= */
  useEffect(() => {
  if (!msg) return;
  const t = setTimeout(() => setMsg(""), 4000);
  return () => clearTimeout(t);
}, [msg]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      switch (activeTab) {
        case "LEAVES": {
          const res = await api.get("/manager/leaves");
          setLeaves(res.data.leaves || []);
          break;
        }

     case "REIMBURSEMENTS": {
  const res = await api.get("/reimbursement/manager");
  setReimbursements(res.data.list || []);
  break;
}


        case "EMPLOYEES": {
          const res = await api.get("/manager/employees");
          setEmployees(res.data.employees || []);
          break;
        }

  case "ATTENDANCE": {
  const res = await api.get("/manager/attendance/today");

  setTodayAttendance(res.data.rows || []);
  setAttendanceSummary(res.data.summary || null);
  break;
}

case "NOTIFICATIONS": {
  const [empRes, notifRes] = await Promise.all([
    api.get("/manager/employees"),
    api.get("/manager/notifications"), // 🔥 yahi missing tha
  ]);

  setEmployees(empRes.data.employees || []);
  setNotifications(notifRes.data.notifications || []);
  break;
}

        default:
          break;
      }
    } catch (err) {
      console.error("ManagerDashboard ERROR:", err);
    } finally {
      setLoading(false);
    }
  };
  const sendNotification = async () => {
  if (!notifTitle || !notifBody || selectedEmployees.length === 0) {
    alert("Fill all fields");
    return;
  }

  await api.post("/manager/notifications", {
    employeeIds: selectedEmployees,
    title: notifTitle,
    body: notifBody,
  });

  alert("Notification sent");
  await loadData(); // 👈 IMPORTANT
  setNotifTitle("");
  setNotifBody("");
  setSelectedEmployees([]);
};

  /* ================= ACTIONS ================= */
const deleteLeave = async (leaveId) => {
  if (!window.confirm("Delete this leave request?")) return;
  try {
    await api.delete(`/manager/leaves/${leaveId}`);
    setMsg("Leave deleted");
    setMsgType("success");
    loadData();
  } catch (err) {
    console.error("Delete leave error:", err);
    setMsg(err?.response?.data?.message || "Delete failed");
    setMsgType("error");
  }
};

const deleteReimbursement = async (reimbId) => {
  if (!window.confirm("Delete this reimbursement?")) return;
  try {
    await api.delete(`/manager/reimbursements/${reimbId}`);
    setMsg("Reimbursement deleted");
    setMsgType("success");
    loadData();
  } catch (err) {
    console.error("Delete reimbursement error:", err);
    setMsg(err?.response?.data?.message || "Delete failed");
    setMsgType("error");
  }
};
  // ---- LEAVES ----
 const approveLeave = async (id) => {
  try {
    await api.patch(`/leaves/${id}/approve`, {
      action: "APPROVED",
    });

    setMsg("Leave approved successfully");
    setMsgType("success");
    loadData();

  } catch (err) {
    setMsg(
      err?.response?.data?.message ||
      "You are not allowed to approve this leave"
    );
    setMsgType("error");
  }
};

const rejectLeave = async (id) => {
  const reason = prompt("Reject reason?");
  if (!reason) return;

  try {
    await api.patch(`/leaves/${id}/approve`, {
      action: "REJECTED",
      reason,
    });

    setMsg("Leave rejected successfully");
    setMsgType("success");
    loadData();

  } catch (err) {
    setMsg(
      err?.response?.data?.message ||
      "You are not allowed to reject this leave"
    );
    setMsgType("error");
  }
};

  // ---- REIMBURSEMENTS ----
// ✅ APPROVE
const approveReimbursement = async (id) => {
  try {
    await api.patch(`/reimbursement/${id}/status`, {
      status: "APPROVED",
    });

    setMsg("Reimbursement approved successfully");
    setMsgType("success");
    loadData();

  } catch (err) {
    setMsg(
      err?.response?.data?.message ||
      "You are not allowed to approve this reimbursement"
    );
    setMsgType("error");
  }
};

// ✅ REJECT
const rejectReimbursement = async (id) => {
  const reason = prompt("Reject reason?");
  if (!reason) return;

  try {
    await api.patch(`/reimbursement/${id}/status`, {
      status: "REJECTED",
      reason,
    });

    setMsg("Reimbursement rejected successfully");
    setMsgType("success");
    loadData();

  } catch (err) {
    setMsg(
      err?.response?.data?.message ||
      "You are not allowed to reject this reimbursement"
    );
    setMsgType("error");
  }
};

  /* ================= UI ================= */
return (
  <div className="space-y-5">
    {/* HEADER */}
    <div>
      <h1 className="text-2xl font-bold">Manage Your Department</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Welcome {user.firstName}, manage your team here
      </p>
    </div>
    {msg && (
  <div
    className={`mb-4 px-4 py-2 rounded text-sm ${
      msgType === "success"
        ? "bg-green-100 text-green-700"
        : "bg-red-100 text-red-700"
    }`}
  >
    {msg}
  </div>
)}

    {/* TABS */}
    <div className="flex gap-2 flex-wrap">
      <TabButton label="Leaves" value="LEAVES" activeTab={activeTab} setActiveTab={setActiveTab} />
      <TabButton label="Reimbursements" value="REIMBURSEMENTS" activeTab={activeTab} setActiveTab={setActiveTab} />
      <TabButton label="Employees" value="EMPLOYEES" activeTab={activeTab} setActiveTab={setActiveTab} />
      <TabButton label="Attendance" value="ATTENDANCE" activeTab={activeTab} setActiveTab={setActiveTab} />
      <TabButton label="Notifications" value="NOTIFICATIONS" activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>

    {/* CONTENT */}
    <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow">
      {loading && <div className="text-center py-6">Loading...</div>}

      {/* LEAVES */}
      {!loading && activeTab === "LEAVES" && (
<LeavesTable 
  leaves={leaves} 
  approveLeave={approveLeave} 
  rejectLeave={rejectLeave}
  deleteLeave={deleteLeave}
/>
      )}

      {/* REIMBURSEMENTS */}
{!loading && activeTab === "REIMBURSEMENTS" && (
  <ReimbursementsTable 
    reimbursements={reimbursements} 
    approve={approveReimbursement}
    reject={rejectReimbursement}
    deleteReimbursement={deleteReimbursement}
  />
)}
      {/* EMPLOYEES */}
      {!loading && activeTab === "EMPLOYEES" && (
        <EmployeesTable employees={employees} />
      )}

      {/* ATTENDANCE */}
{!loading && activeTab === "ATTENDANCE" && (
  <TodayAttendance
    rows={todayAttendance}
    summary={attendanceSummary}
  />
)}

      {/* ================= NOTIFICATIONS ================= */}
{!loading && activeTab === "NOTIFICATIONS" && (
  <div className="space-y-6">

    {/* ===== SEND NOTIFICATION ===== */}
    <div className="border rounded-xl p-4 bg-gray-50 dark:bg-gray-800">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Send Notification
      </h3>

      <input
        value={notifTitle}
        onChange={(e) => setNotifTitle(e.target.value)}
        placeholder="Notification Title"
        className="w-full mb-3 px-3 py-2 text-sm rounded
                   bg-white dark:bg-gray-900
                   text-gray-900 dark:text-gray-100
                   border border-gray-300 dark:border-gray-700"
      />

      <textarea
        value={notifBody}
        onChange={(e) => setNotifBody(e.target.value)}
        placeholder="Notification Message"
        rows={4}
        className="w-full mb-4 px-3 py-2 text-sm rounded
                   bg-white dark:bg-gray-900
                   text-gray-900 dark:text-gray-100
                   border border-gray-300 dark:border-gray-700"
      />

      <div className="mb-4">
        <div className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Select Employees
        </div>

        <div className="flex flex-wrap gap-3">
          {employees.map((e) => (
            <label
              key={e.id}
              className="flex items-center gap-2 text-xs
                         text-gray-700 dark:text-gray-300"
            >
              <input
                type="checkbox"
                className="accent-indigo-600"
                checked={selectedEmployees.includes(e.id)}
                onChange={() =>
                  setSelectedEmployees((prev) =>
                    prev.includes(e.id)
                      ? prev.filter((x) => x !== e.id)
                      : [...prev, e.id]
                  )
                }
              />
              {e.firstName} {e.lastName}
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={sendNotification}
        className="px-4 py-2 rounded text-sm
                   bg-indigo-600 hover:bg-indigo-700
                   text-white"
      >
        Send Notification
      </button>
    </div>

    {/* ===== NOTIFICATION TABLE (UI READY) ===== */}
    <div className="border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-700">
          <tr>
            <th className="p-3 text-left text-gray-700 dark:text-gray-200">
              Employee
            </th>
            <th className="p-3 text-left text-gray-700 dark:text-gray-200">
              Title
            </th>
            <th className="p-3 text-left text-gray-700 dark:text-gray-200">
              Message
            </th>
            <th className="p-3 text-left text-gray-700 dark:text-gray-200">
              Date
            </th>
          </tr>
        </thead>

      <tbody className="bg-white dark:bg-gray-900">
  {notifications.length === 0 && (
    <tr>
      <td
        colSpan={4}
        className="text-center p-6 text-gray-500 dark:text-gray-400"
      >
        No notifications sent yet
      </td>
    </tr>
  )}

  {notifications.map((n) => (
    <tr key={n.id} className="border-t dark:border-gray-700">
      <td className="p-3">
        {n.user?.firstName}
        {n.user?.lastName ? ` ${n.user.lastName}` : ""}
      </td>

      <td className="p-3 font-medium text-gray-800 dark:text-gray-200">
        {n.title}
      </td>

      <td className="p-3 text-gray-600 dark:text-gray-300">
        {n.body}
      </td>

      <td className="p-3 text-xs text-gray-500">
        {new Date(n.createdAt).toLocaleDateString()}
      </td>
    </tr>
  ))}
</tbody>

      </table>
    </div>

  </div>
)}
    </div>
  </div>
);
}

/* =========================================================
   SUB COMPONENTS
========================================================= */

function TabButton({ label, value, activeTab, setActiveTab }) {
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`px-4 py-2 rounded-lg text-sm ${
        activeTab === value
          ? "bg-indigo-600 text-white"
          : "bg-gray-200 dark:bg-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

/* ================= LEAVES ================= */
function LeavesTable({ leaves, approveLeave, rejectLeave, deleteLeave }) {
  if (!leaves.length) return <Empty text="No leave requests" />;

  return (
    <table className="w-full text-sm">
<thead>
  <tr className="border-b">
    <th className="text-left">Name</th>
    <th className="text-left">Type</th>
    <th className="text-left">Dates</th>
    <th className="text-left">Status</th>
    <th className="text-left">Reject Reason</th> {/* ✅ NEW */}
  </tr>
</thead>
      <tbody>
        {leaves.map((l) => (
          <tr key={l.id} className="border-b">
            {/* ✅ FULL NAME */}
            <td>
              {l.user.firstName}
              {l.user.lastName ? ` ${l.user.lastName}` : ""}
            </td>
            <td>{l.type}</td>
           <td>
  <div>
    {l.startDate.slice(0, 10)} → {l.endDate.slice(0, 10)}
  </div>

  <div className="text-xs text-gray-500 dark:text-gray-400">
    {getDisplayDays(l)}
  </div>
</td>
  <td>{l.status}</td>

{/* ✅ REJECT REASON */}
<td className="text-xs text-red-600 dark:text-red-400">
  {l.status === "REJECTED" ? l.rejectReason || "-" : "-"}
</td>

<td className="flex gap-2">
  {l.status === "PENDING" && (
    <>
      <button
        onClick={() => approveLeave(l.id)}
        className="px-2 py-1 bg-green-600 text-white rounded"
      >
        Approve
      </button>
      <button
        onClick={() => rejectLeave(l.id)}
        className="px-2 py-1 bg-red-600 text-white rounded"
      >
        Reject
      </button>
            <button
            onClick={() => deleteLeave(l.id)}
            className="p-1 bg-red-500 text-white rounded-lg hover:bg-red-600"
            title="Delete"
             >
             <FiTrash2 />
            </button>
    </>
  )}
</td>

          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ================= REIMBURSEMENTS ================= */
function ReimbursementsTable({ reimbursements, approve, reject, deleteReimbursement }) {
  if (!reimbursements.length) return <Empty text="No reimbursements" />;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="text-left">Name</th>
          <th className="text-left">Amount</th>
          <th className="text-left">Bills</th>
          <th className="text-left">Status</th>
          <th className="text-left">Reject Reason</th> {/* ✅ NEW */}
        </tr>
      </thead>
      <tbody>
        {reimbursements.map((r) => (
          <tr key={r.id} className="border-b align-top">
            {/* ✅ FULL NAME */}
            <td>
              {r.user?.firstName}
              {r.user?.lastName ? ` ${r.user.lastName}` : ""}
            </td>
            <td>₹ {r.totalAmount}</td>
            {/* ✅ BILLS */}
            <td>
              {r.bills && r.bills.length > 0 ? (
                <ul className="space-y-1">
                  {r.bills.map((b) => (
                    <li key={b.id}>
                      <a
                        href={b.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 underline text-xs"
                      >
                        View Bill (₹{b.amount})
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-xs text-gray-500">No bills</span>
              )}
            </td>
<td>{r.status}</td>
{/* ✅ REJECT REASON */}
<td className="text-xs text-red-600 dark:text-red-400">
  {r.status === "REJECTED" ? r.rejectReason || "-" : "-"}
</td>
<td className="flex gap-2">
  {r.status === "PENDING" && (
    <>
      <button
        onClick={() => approve(r.id)}
        className="px-2 py-1 bg-green-600 text-white rounded"
      >
        Approve
      </button>
      <button
        onClick={() => reject(r.id)}
        className="px-2 py-1 bg-red-600 text-white rounded"
      >
        Reject
      </button>
                        <button
                    onClick={() => deleteReimbursement(r.id)}
                    className="p-1 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    title="Delete"
                  >
                   <FiTrash2 />
                  </button>
    </>
  )}
</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ================= EMPLOYEES ================= */
function roleLabel(role) {
  if (role === "LYF_EMPLOYEE") return "Lyfshilp Employee";
  if (role === "AGILITY_EMPLOYEE") return "Agility Employee";
  return role;
}

function EmployeesTable({ employees }) {
  if (!employees.length) return <Empty text="No employees" />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {employees.map((e) => (
        <div
          key={e.id}
          className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
        >
          <div className="font-semibold">
            {e.firstName} {e.lastName}
          </div>

          <div className="text-xs mt-1 inline-block px-2 py-1 rounded bg-indigo-100 text-indigo-700">
            {roleLabel(e.role)}
          </div>

          {e.position && (
            <div className="text-xs text-gray-500 mt-2">
              {e.position}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ================= ATTENDANCE ================= */
function statusBadge(status) {
  const map = {
    PRESENT: "bg-green-500/20 text-green-600 dark:text-green-400",
    LEAVE: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",      // 🔥 Yellow
    WFH: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    HALF_DAY: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
    HALF_DAY_PENDING: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    COMP_OFF: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    WEEK_OFF: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
    ABSENT: "bg-red-500/20 text-red-600 dark:text-red-400",              // 🔥 Red
    // LATE: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
    PENDING: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    LATE_CHECKIN: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  };

  return (
    <span 
      className={`text-xs px-3 py-1 rounded-full font-medium ${
        map[status] || "bg-gray-500/20 text-gray-600 dark:text-gray-400"
      }`}
    >
      {status}
    </span>
  );
}

/* ================= TODAY ATTENDANCE (MANAGER) ================= */

function TodayAttendance({ rows, summary }) {
  if (!rows.length && !summary) return <Empty text="No attendance for today" />;

  return (
    <div className="space-y-4">

      {/* 🔢 KPI CARDS */}
      {summary && (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
    <MiniKPI label="Total Employees" value={summary.totalEmployees ?? rows.length} color="indigo" />
    <MiniKPI label="Present" value={summary.present ?? 0} color="green" />
    <MiniKPI label="On HalfDay" value={summary.halfDay ?? 0} color="yellow" />
    <MiniKPI label="WFH" value={summary.wfh ?? 0} color="blue" />
    <MiniKPI label="WeekOff Present" value={summary.weekOffPresent ?? 0} color="gray" />
    <MiniKPI label="On Leave" value={summary.leave ?? 0} color="yellow" />
    <MiniKPI label="On CompOff Leave" value={summary.compOff ?? 0} color="yellowLight" />
    <MiniKPI label="Week Off" value={summary.weekOff ?? 0} color="orange" />
    <MiniKPI label="Absent" value={summary.absent ?? 0} color="red" />
  </div>
)}

      {/* 📋 TABLE */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Employee</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Check In</th>
            <th className="text-left p-2">Check Out</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="border-b">
              <td className="p-2">{r.name}</td>
              <td className="p-2">{statusBadge(r.status)}</td>
              <td className="p-2 text-xs">
                {r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "-"}
              </td>
              <td className="p-2 text-xs">
                {r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
/* ================= SUMMARY CARD ================= */
function SummaryCard({ label, value, color }) {
  const map = {
    green: "bg-green-500/20 text-green-600 dark:bg-green-500/30 dark:text-green-400 border border-green-500/30",
    yellow: "bg-yellow-500/20 text-yellow-600 dark:bg-yellow-500/30 dark:text-yellow-400 border border-yellow-500/30",
    red: "bg-red-500/20 text-red-600 dark:bg-red-500/30 dark:text-red-400 border border-red-500/30",
    blue: "bg-blue-500/20 text-blue-600 dark:bg-blue-500/30 dark:text-blue-400 border border-blue-500/30",
    purple: "bg-purple-500/20 text-purple-600 dark:bg-purple-500/30 dark:text-purple-400 border border-purple-500/30",
    gray: "bg-gray-500/20 text-gray-600 dark:bg-gray-500/30 dark:text-gray-400 border border-gray-500/30",
  };

  return (
    <div className={`rounded-xl p-4 text-center ${map[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1">{label}</div>
    </div>
  );
}
/* ================= EMPTY ================= */
function Empty({ text }) {
  return <div className="text-center py-8 text-gray-500">{text}</div>;
}
/* ================= MINI KPI ================= */
function MiniKPI({ label, value, color }) {
  const colorMap = {
    indigo: "text-indigo-600",
    green: "text-green-600",
    yellow: "text-yellow-600",
    blue: "text-blue-600",
    gray: "text-gray-500",
    yellowLight: "text-yellow-400",
    orange: "text-orange-400",
    red: "text-red-600",
  };

  return (
    <div className="p-4 bg-white/70 dark:bg-gray-800/50 rounded-xl text-center border shadow">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-extrabold ${colorMap[color]}`}>{value}</p>
    </div>
  );
}