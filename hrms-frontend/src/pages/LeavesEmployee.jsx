// ====================== LeavesEmployee.jsx (FINAL CLEAN VERSION) ======================
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import useAuthStore from "../stores/authstore";
import { FiPlusCircle, FiCalendar, FiClock } from "react-icons/fi";
import EmployeeDropdown from "../components/EmployeeDropdown";

// --- Merge overlapping leave date ranges (unique days) ---
function getUniqueLeaveDays(leaves) {
  const ranges = leaves.map(l => ({
    start: new Date(l.startDate),
    end: new Date(l.endDate),
  }));

  if (ranges.length === 0) return 0;
  ranges.sort((a, b) => a.start - b.start);

  const merged = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    const curr = ranges[i];
    if (curr.start <= last.end) {
      last.end = new Date(Math.max(last.end, curr.end));
    } else {
      merged.push(curr);
    }
  }

  let total = 0;
  for (const r of merged) {
    const diff = Math.floor((r.end - r.start) / (1000 * 60 * 60 * 24)) + 1;
    total += diff;
  }
  return total;
}

export default function Leaves() {
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const paginatedLeaves = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return leaves.slice(start, start + PAGE_SIZE);
  }, [page, leaves]);

  const totalPages = Math.ceil(leaves.length / PAGE_SIZE);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);
  const [todayApplied, setTodayApplied] = useState(false);

  const [form, setForm] = useState({
    type: "CASUAL",
    startDate: "",
    endDate: "",
    reason: "",
    responsiblePerson: "",
  });

  const [showTodayPopup, setShowTodayPopup] = useState(false);
  const [todayForm, setTodayForm] = useState({
    type: "CASUAL",
    reason: "",
    responsiblePerson: "",
  });

  const user = useAuthStore((s) => s.user);
  const isAdmin = user.role === "ADMIN";

  const TOTAL_YEARLY_LEAVES = 21;

  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  const getDays = (l) => {
    if (!l?.startDate || !l?.endDate) return 0;
    const s = new Date(l.startDate);
    const e = new Date(l.endDate);
    return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  };

  // ⭐ Unique approved leave days
  const approvedLeaveDays = getUniqueLeaveDays(
    leaves.filter(
      (l) =>
        l.status === "APPROVED" &&
        l.type !== "WFH" &&
        l.type !== "UNPAID" &&
        l.startDate >= yearStart &&
        l.endDate <= yearEnd
    )
  );

  const remainingLeaves = TOTAL_YEARLY_LEAVES - approvedLeaveDays;
// ⭐ WFH unique days
const totalWFHDays = getUniqueLeaveDays(
  leaves.filter(
    (l) =>
      l.type?.toUpperCase() === "WFH" &&
      new Date(l.startDate) >= new Date(yearStart) &&
      new Date(l.endDate) <= new Date(yearEnd)
  )
);

// ⭐ Approved WFH unique days
const approvedWFHDays = getUniqueLeaveDays(
  leaves.filter(
    (l) =>
      l.type?.toUpperCase() === "WFH" &&
      l.status === "APPROVED" &&
      new Date(l.startDate) >= new Date(yearStart) &&
      new Date(l.endDate) <= new Date(yearEnd)
  )
);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2000);
    return () => clearTimeout(t);
  }, [msg]);

  const load = async () => {
    try {
      setLoading(true);
      const r = await api.get("/leaves");
      setLeaves(r.data.leaves || []);

      try {
        const u = await api.get("/users");
        setEmployees(u.data.users || []);
      } catch (e) {
        console.error("Failed to load employees:", e);
      }
    } catch (err) {
      setMsg("Failed to load leaves");
      setMsgType("error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

const apply = async () => {
  try {
    await api.post("/leaves", {
      ...form,
      responsiblePerson: form.responsiblePerson || null,
    });

    setApplied(true);       
    setMsg("Your leave is successfully sent.");  // only top banner message

    // Button reset after 2 seconds
    setTimeout(() => setApplied(false), 2000);

    setForm({
      type: "PAID",
      startDate: "",
      endDate: "",
      reason: "",
      responsiblePerson: "",
    });

    load();
  } catch (err) {
    setMsg(err.response?.data?.message || "Failed");
    setMsgType("error");
  }
};


const submitTodayLeave = async () => {
  const today = new Date().toISOString().slice(0, 10);

  try {
    await api.post("/leaves", {
      type: todayForm.type,
      startDate: today,
      endDate: today,
      reason: todayForm.reason || "Taking leave today",
      responsiblePerson: todayForm.responsiblePerson || null,
    });

    setMsg("Your leave is successfully sent. Please wait for approval.");
    setMsgType("success");

    setTodayForm({ type: "SICK", reason: "", responsiblePerson: "" });

    setTodayApplied(true);

    // ⭐ Auto reset + auto close popup after 2 sec
    setTimeout(() => {
      setTodayApplied(false);
      setShowTodayPopup(false);
    }, 2000);

    load();
  } catch (err) {
    setMsg("Failed to apply leave");
    setMsgType("error");
  }
};

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/leaves/${id}/approve`, { action: status });
      setMsg(`Leave ${status.toLowerCase()}`);
      setMsgType("success");
      load();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Action failed");
      setMsgType("error");
    }
  };
  return (
    <div className="space-y-10">
      {msg && (
        <div
          className={`p-3 rounded-xl text-center text-sm ${
            msgType === "success"
              ? "bg-green-100 text-green-700 border border-green-300"
              : "bg-red-100 text-red-700 border border-red-300"
          }`}
        >
          {msg}
        </div>
      )}

      <PageTitle title="Leaves" sub="Manage your leaves & WFH" />

      {!isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-5">

         <StatCard
  icon={<FiCalendar className="text-blue-500" />}
  title="Leave Days Applied"
  value={leaves
    .filter((l) => l.type?.toUpperCase() !== "WFH")
    .reduce((sum, l) => sum + getDays(l), 0)}
/>

          <StatCard
            icon={<FiClock className="text-green-500" />}
            title="Approved Leave Days"
            value={approvedLeaveDays}
          />

          <StatCard
            icon={<FiPlusCircle className="text-purple-500" />}
            title="WFH Days Applied"
            value={totalWFHDays}
          />

          <StatCard
            icon={<FiClock className="text-blue-500" />}
            title="Approved WFH Days"
            value={approvedWFHDays}
          />

          <StatCard
            icon={<FiCalendar className="text-red-500" />}
            title="Remaining Leaves"
            value={`${remainingLeaves} out of ${TOTAL_YEARLY_LEAVES}`}
          />

        </div>
      )}

      {!isAdmin && (
        <GlassCard>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Apply for Leave/WFH</h3>
            <button
              onClick={() => setShowTodayPopup(true)}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow"
            >
              Apply Today Leave/WFH
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="font-medium text-gray-600">Leave Type</label>
              <select
                className="p-3 rounded-xl border dark:bg-gray-900 shadow"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="PAID">Paid Leave</option>
                <option value="UNPAID">Unpaid Leave</option>
                <option value="SICK">Sick Leave</option>
                <option value="CASUAL">Casual Leave</option>
                <option value="WFH">Work From Home</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium text-gray-600">Start Date</label>
              <input
                type="date"
                className="p-3 rounded-xl border dark:bg-gray-900 shadow"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-medium text-gray-600">End Date</label>
              <input
                type="date"
                className="p-3 rounded-xl border dark:bg-gray-900 shadow"
                value={form.endDate}
                onChange={(e) =>
                  setForm({ ...form, endDate: e.target.value })
                }
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="font-medium text-gray-600">Reason (optional)</label>
            <textarea
              rows={3}
              placeholder="Enter reason..."
              className="p-3 w-full rounded-xl border dark:bg-gray-900 shadow"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>

          <div className="mt-4">
            <label className="font-medium text-gray-600">
              Who takes your responsibility? (optional)
            </label>
            <EmployeeDropdown
              employees={employees}
              value={form.responsiblePerson}
              onChange={(val) =>
                setForm({ ...form, responsiblePerson: val })
              }
            />
          </div>

 <div className="flex items-center gap-3 mt-6">
  <button
    onClick={apply}
    disabled={applied}
    className={`px-6 py-3 rounded-xl font-semibold shadow-lg text-white
      ${applied ? "bg-green-600 cursor-default" : "bg-indigo-600 hover:bg-indigo-700"}
    `}
  >
    {applied ? "Applied ✔" : "Apply"}
  </button>

  {applied && (
    <span className="text-green-600 text-sm font-medium">
      Your leave is successfully sent.
    </span>
  )}
</div>

        </GlassCard>
      )}
      <GlassCard>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Your Leave/WFH History</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {page} / {totalPages || 1}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-6">Loading...</div>
        ) : paginatedLeaves.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400">
            No leave history found
          </p>
        ) : (
          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
            {paginatedLeaves.map((l) => (
              <LeaveItem
                key={l.id}
                l={l}
                isAdmin={isAdmin}
                updateStatus={updateStatus}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-3 mt-4">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm disabled:opacity-40"
            >
              ⬅ Previous
            </button>

            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm disabled:opacity-40"
            >
              Next ➜
            </button>
          </div>
        )}
      </GlassCard>

      {showTodayPopup && (
<TodayPopup
  todayForm={todayForm}
  setTodayForm={setTodayForm}
  close={() => setShowTodayPopup(false)}
  submit={submitTodayLeave}
  employees={employees}
  todayApplied={todayApplied}   // ⭐ MUST HAVE
/>

      )}
    </div>
  );
}
function TodayPopup({ todayForm, setTodayForm, close, submit, employees, todayApplied }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm z-50 p-4">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl max-w-md w-full shadow-xl border border-gray-300 dark:border-gray-700">
        
        <h2 className="text-xl font-semibold mb-4">Apply Today Leave or WFH</h2>

        {/* Leave Type */}
        <label className="font-medium text-gray-600">Leave Type</label>
        <select
          className="p-3 w-full rounded-xl border dark:bg-gray-800 mt-1 mb-3"
          value={todayForm.type}
          onChange={(e) =>
            setTodayForm({ ...todayForm, type: e.target.value })
          }
        >
          <option value="SICK">Sick Leave</option>
          <option value="CASUAL">Casual Leave</option>
          <option value="PAID">Paid Leave</option>
          <option value="UNPAID">Unpaid Leave</option>
          <option value="WFH">Work From Home</option>
        </select>

        {/* Reason */}
        <label className="font-medium text-gray-600">Reason</label>
        <textarea
          className="p-3 w-full rounded-xl border dark:bg-gray-800 mt-1"
          rows={3}
          value={todayForm.reason}
          placeholder="Enter Reason..."
          onChange={(e) =>
            setTodayForm({ ...todayForm, reason: e.target.value })
          }
        ></textarea>

        {/* Responsible Person */}
        <label className="font-medium text-gray-600 mt-2">
          Who takes your responsibility? (optional)
        </label>
        <EmployeeDropdown
          employees={employees}
          value={todayForm.responsiblePerson}
          onChange={(val) =>
            setTodayForm({ ...todayForm, responsiblePerson: val })
          }
        />

        {/* Buttons Section */}
        <div className="flex justify- items-center mt-6">

          {/* Cancel Button */}
          <button
            className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-xl"
            onClick={close}
          >
            Cancel
          </button>

          {/* Submit + Message */}
          <div className="flex items-center gap-3">
            <button
              disabled={todayApplied}
              className={`px-4 py-2 rounded-xl text-white
                ${todayApplied ? "bg-green-600 cursor-default" : "bg-indigo-600 hover:bg-indigo-700"}
              `}
              onClick={submit}
            >
              {todayApplied ? "Applied ✔" : "Submit"}
            </button>

            {todayApplied && (
              <span className="text-green-600 text-sm font-medium">
                Today leave successfully sent.
              </span>
            )}
          </div>

          

        </div>

      </div>
    </div>
  );
}


function LeaveItem({ l, isAdmin, updateStatus }) {
  const getDays = () => {
    if (!l?.startDate || !l?.endDate) return 0;
    const s = new Date(l.startDate);
    const e = new Date(l.endDate);
    return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow flex justify-between items-center">
      <div>
        <div className="text-lg font-semibold">
          {l.type === "WFH" ? (
            <span className="text-blue-600">Work From Home</span>
          ) : l.type === "PAID" ? (
            <span className="text-green-600">Paid Leave</span>
          ) : l.type === "SICK" ? (
            <span className="text-yellow-600">Sick Leave</span>
          ) : l.type === "CASUAL" ? (
            <span className="text-orange-600">Casual Leave</span>
          ) : (
            l.type
          )}
        </div>

        <div className="text-sm text-gray-500">
          {l.startDate?.slice(0, 10)} → {l.endDate?.slice(0, 10)}
        </div>

        <div className="text-xs text-gray-400">{getDays()} day(s)</div>

        {/* 🌟 EMPLOYEE SEES HIS APPLIED REASON */}
        {l.reason && (
          <div className="text-xs text-gray-500 mt-1">
            <b>Your Reason:</b> {l.reason}
          </div>
        )}

        {/* 🌟 NEW — EMPLOYEE SEES WHY ADMIN REJECTED */}
        {l.status === "REJECTED" && l.rejectReason && (
          <div className="text-xs text-red-500 mt-1">
            <b>Rejected Reason:</b> {l.rejectReason}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`px-4 py-1 rounded-full text-white text-sm font-medium ${
            l.status === "APPROVED"
              ? "bg-green-600"
              : l.status === "REJECTED"
              ? "bg-red-600"
              : "bg-yellow-500"
          }`}
        >
          {l.status}
        </span>
      </div>
    </div>
  );
}

function PageTitle({ title, sub }) {
  return (
    <div>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-gray-500 dark:text-gray-400">{sub}</p>
    </div>
  );
}

function GlassCard({ children }) {
  return (
    <div className="p-6 rounded-2xl bg-white/60 dark:bg-gray-800/40 shadow border border-gray-200 dark:border-gray-700 backdrop-blur-lg">
      {children}
    </div>
  );
}

function StatCard({ icon, title, value }) {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 shadow border border-gray-200 dark:border-gray-700 flex items-center gap-4">
      <div className="text-3xl">{icon}</div>
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-sm text-gray-500">{title}</div>
      </div>
    </div>
  );
}
