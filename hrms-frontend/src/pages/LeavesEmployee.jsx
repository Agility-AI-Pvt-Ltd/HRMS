// ====================== LeavesEmployee.jsx (FINAL FIXED VERSION) ======================
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import useAuthStore from "../stores/authstore";
import { FiPlusCircle, FiCalendar, FiClock, FiEdit } from "react-icons/fi";
import EmployeeDropdown from "../components/EmployeeDropdown";
import ConfirmDelPopup from "../components/ConfirmDelPopup";

function checkHolidayOrWeekOff(dateISO, holidays = [], weekOff) {
  const d = new Date(dateISO);
  const dayName = d.toLocaleDateString("en-US", { weekday: "long" });

  const isHoliday = holidays.some((h) => h.date === dateISO);

  if (isHoliday) {
    return { blocked: true, reason: "HOLIDAY" };
  }

  const isWeekOff =
    weekOff &&
    ((weekOff.isFixed && weekOff.offDay === dayName) ||
      (!weekOff.isFixed && weekOff.offDate === dateISO));

  if (isWeekOff) {
    return { blocked: true, reason: "WEEK_OFF" };
  }

  return { blocked: false };
}

function getChargeableLeaveDays(leaves, holidays = [], weekOff) {
  const dayMap = {};

  leaves.forEach((l) => {
    let cur = new Date(l.startDate);
    const end = new Date(l.endDate);
    const value = l.type === "HALF_DAY" ? 0.5 : 1;

    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      const dayName = cur.toLocaleDateString("en-US", { weekday: "long" });

      const isHoliday = holidays.some((h) => h.date === iso);

      const isWeekOff =
        weekOff &&
        ((weekOff.isFixed && weekOff.offDay === dayName) ||
          (!weekOff.isFixed && weekOff.offDate === iso));

      // ⛔ skip holiday & weekoff
      if (!isHoliday && !isWeekOff) {
        dayMap[iso] = Math.max(dayMap[iso] || 0, value);
      }

      cur.setDate(cur.getDate() + 1);
    }
  });

  return Object.values(dayMap).reduce((a, b) => a + b, 0);
}

// --- Merge overlapping leave date ranges (unique days) ---
function getUniqueLeaveDays(leaves) {
  const ranges = leaves.map((l) => ({
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

// --- Calculate unique leave units (handles half days) ---
// function getUniqueLeaveUnits(leaves) {
//   const dayMap = {}; // { "2025-09-10": 1 | 0.5 }

//   leaves.forEach((l) => {
//     let cur = new Date(l.startDate);
//     const end = new Date(l.endDate);

//     const value = l.type === "HALF_DAY" ? 0.5 : 1;

//     while (cur <= end) {
//       const iso = cur.toISOString().slice(0, 10);
//       // Same date → max value wins
//       dayMap[iso] = Math.max(dayMap[iso] || 0, value);
//       cur.setDate(cur.getDate() + 1);
//     }
//   });
//   return Object.values(dayMap).reduce((a, b) => a + b, 0);
// }

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
  const [applyMessage, setApplyMessage] = useState("");
  const [applyLoading, setApplyLoading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingLeaveId, setEditingLeaveId] = useState(null);
  const [editInfo, setEditInfo] = useState("");

  const [holidaysList, setHolidaysList] = useState([]);
  const [weekOff, setWeekOff] = useState(null);

  const calcLeaveDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  };

const emptyLeaveForm = {
  type: "CASUAL",
  startDate: "",
  endDate: "",
  reason: "",
  responsiblePerson: "",
};
const [form, setForm] = useState(emptyLeaveForm);


  // const [showTodayPopup, setShowTodayPopup] = useState(false);
  const [formMode, setFormMode] = useState("LEAVE"); // LEAVE | CANCEL
  // Today‑leave quick modal is removed per latest requirement
  const [cancelForm, setCancelForm] = useState({
    date: "",
    checkInTime: "",
    checkOutTime: "",
    witnessId: "",
    reason: "",
  });
  const [cancelSubmitLoading, setCancelSubmitLoading] = useState(false);
  const [cancelSubmitted, setCancelSubmitted] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");

  const user = useAuthStore((s) => s.user);
  const isAdmin = user.role === "ADMIN";

  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  // const getDays = (l) => {
  //   if (!l?.startDate || !l?.endDate) return 0;
  //   const s = new Date(l.startDate);
  //   const e = new Date(l.endDate);
  //   return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  // };

  const confirmDeleteLeave = async () => {
    try {
      await api.delete(`/leaves/${deleteId}`);
      setMsg("Leave deleted successfully");
      setMsgType("success");
      load();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to delete leave");
      setMsgType("error");
    } finally {
      setShowDelete(false);
      setDeleteId(null);
    }
  };

  // ⭐ Unique approved leave days (excluding WFH and UNPAID)
  const approvedLeaveDays = React.useMemo(() => {
    return getChargeableLeaveDays(
      leaves.filter(
        (l) =>
          l.status === "APPROVED" &&
          l.type !== "WFH" &&
          l.type !== "UNPAID" &&
          l.type !== "COMP_OFF" &&
          // 🔥 ADD YEAR FILTER
          new Date(l.startDate) >= new Date(yearStart) &&
          new Date(l.endDate) <= new Date(yearEnd),
      ),
      holidaysList,
      weekOff,
    );
  }, [leaves, holidaysList, weekOff, yearStart, yearEnd]);

  // ⭐ Approved WFH unique days
  const approvedWFHDays = getUniqueLeaveDays(
    leaves.filter(
      (l) =>
        l.type?.toUpperCase() === "WFH" &&
        l.status === "APPROVED" &&
        new Date(l.startDate) >= new Date(yearStart) &&
        new Date(l.endDate) <= new Date(yearEnd),
    ),
  );

  // ⭐ Approved half day (count)
  const approvedHalfDay = leaves.filter(
    (l) =>
      l.type?.toUpperCase() === "HALF_DAY" &&
      l.status === "APPROVED" &&
      new Date(l.startDate) >= new Date(yearStart) &&
      new Date(l.endDate) <= new Date(yearEnd),
  ).length;

  // ⭐ Approved Unpaid Leaves (count)
const approvedUnpaidCount = leaves.filter(
  (l) =>
    l.type?.toUpperCase() === "UNPAID" &&
    l.status === "APPROVED" &&
    new Date(l.startDate) >= new Date(yearStart) &&
    new Date(l.endDate) <= new Date(yearEnd),
).length;

  // ⭐ Remaining leaves
  const yearlyQuota = user?.stats?.yearlyQuota ?? 21;

  const remainingLeaves = user?.stats?.remainingLeaves ?? Math.max(yearlyQuota - approvedLeaveDays, 0);

  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const res = await api.get("/holidays");
        setHolidaysList(
          res.data.holidays.map((h) => ({
            date: h.date.slice(0, 10),
            title: h.title,
          })),
        );
      } catch (e) {
        console.error("Failed to load holidays", e);
      }
    };

    loadHolidays();
  }, []);

  useEffect(() => {
    const loadWeekOff = async () => {
      try {
        const res = await api.get("/weekly-off/me");
        setWeekOff(res.data.weekOff);
      } catch (e) {
        console.error("Failed to load weekoff", e);
      }
    };

    loadWeekOff();
  }, []);

  useEffect(() => {
    // ✅ Refresh user data on component mount
    useAuthStore.getState().refreshUser();
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  useEffect(() => {
    if (!editInfo) return;
    const t = setTimeout(() => setEditInfo(""), 5000);
    return () => clearTimeout(t);
  }, [editInfo]);

  useEffect(() => {
    if (!applyMessage) return;
    const t = setTimeout(() => setApplyMessage(""), 3000);
    return () => clearTimeout(t);
  }, [applyMessage]);

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
    } catch (error) {
      console.error("Failed to load leaves:", error);
      setMsg("Failed to load leaves");
      setMsgType("error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // 3) Add this new function (apply ke upar/neeche kahin bhi component ke andar)
const startEditLeave = (l) => {
  setFormMode("LEAVE");
  setEditingLeaveId(l.id);
  setForm({
    type: l.type || "CASUAL",
    startDate: l.startDate?.slice(0, 10) || "",
    endDate: l.endDate?.slice(0, 10) || "",
    reason: l.reason || "",
    responsiblePerson: l.responsiblePerson?.id || "",
  });
  setEditInfo("You can update your leave here");
  setMsgType("success");
  document.getElementById("leaveFormCard")?.scrollIntoView({
  behavior: "smooth",
  block: "start",
});

};

  const apply = async () => {
     
    if (!form.startDate || !form.endDate) {
    const t = "Start date and end date are required";
    setApplyMessage(t);
    setMsg(t);
    setMsgType("error");
    return;
  }
    const days = calcLeaveDays(form.startDate, form.endDate);
  
    if (new Date(form.startDate) > new Date(form.endDate)) {
    const t = "Start date cannot be after end date";
    setApplyMessage(t);
    setMsg(t);
    setMsgType("error");
    return;
  }
    // 🚫 single-day leave check
    if (days === 1) {
      const dateCheck = checkHolidayOrWeekOff(
        form.startDate,
        holidaysList,
        weekOff,
      );

      if (dateCheck.blocked) {
        const message =
          dateCheck.reason === "HOLIDAY"
            ? "Selected date is a Holiday. Leave cannot be applied."
            : "Selected date is a Week-Off. Leave cannot be applied.";

        setApplyMessage(message);
        setMsg(message);
        setMsgType("error"); // 🔴 red
        return;
      }
    }
    // 🔥 RULE 1: WFH → reason compulsory (any duration)
    if (form.type === "WFH" && !form.reason.trim()) {
      setApplyMessage("Reason is mandatory for Work From Home");
      setMsg("Reason is mandatory for Work From Home");
      setMsgType("error");
      return;
    }
    // 🔥 RULE: 3+ days → reason compulsory
    if (days >= 3 && !form.reason.trim()) {
      setApplyMessage("Reason is mandatory for leave of 3 days or more");
      setMsg("Reason is mandatory for leave of 3 days or more");
      setMsgType("error");
      return;
    }

    if (form.type === "COMP_OFF" && (user?.compOffBalance ?? 0) <= 0) {
      setMsg("You don't have Comp-Off balance");
      setMsgType("error");
      setApplyMessage("Not enough Comp-Off balance");
      return;
    }
    setApplyLoading(true);
    setApplied(false);
    // ⬅ button text Applying...
    try {
      const payload = {
        ...form,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        responsiblePerson: form.responsiblePerson || null,
      };

    let res;
       // ✏️ EDIT MODE
    if (editingLeaveId) {
      res = await api.put(`/leaves/${editingLeaveId}`, payload);
      setApplyMessage("Leave updated successfully.");
      setMsg("Leave updated successfully.");
    }
    // 🆕 CREATE MODE
    else {
      res = await api.post("/leaves", payload);
      setApplyMessage("Your leave is successfully sent.");
      setMsg("Your leave is successfully sent.");
    }

      // ✅ UPDATE USER BALANCE WITHOUT REFRESH
      if (res.data.updatedUser) {
        useAuthStore.getState().setUser({
          ...user,
          ...res.data.updatedUser,
        });
      }
      setMsgType("success");
      setApplied(true);
 
    // Refresh leaves
    const r = await api.get("/leaves");
    setLeaves(r.data.leaves || []); 

     // Reset form & edit state
    setEditingLeaveId(null);
    setForm(emptyLeaveForm);

      setTimeout(() => {
        setApplied(false);
        setApplyMessage("");
      }, 2000);
      load();
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to apply leave";
      setApplyMessage(errorMsg);
      setMsg(errorMsg);
      setMsgType("error");
    } finally {
      setApplyLoading(false); // ⬅ important
    }
  };

const updateStatus = async (id, status) => {
  try {
    setLeaves((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, status: status === "APPROVED" ? "APPROVED" : "REJECTED" }
          : l
      )
    );

    await api.patch(`/leaves/${id}/approve`, { action: status });

    setMsg(`Leave ${status.toLowerCase()}`);
    setMsgType("success");

    load();
  } catch (err) {
    setMsg(err?.response?.data?.message || "Action failed");
    setMsgType("error");
    load();
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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
  icon={<FiClock className="text-green-500" />}
  title="Total Approved Leave"
  subtitle="(Count Paid Leaves and HalfDays not CompOff and Unpaid Leaves)"
  value={approvedLeaveDays}
/>
          <StatCard
            icon={<FiClock className="text-blue-500" />}
            title="Approved WFH Days"
            value={approvedWFHDays}
          />
<StatCard
  icon={<FiClock className="text-green-500" />}
  title="Approved HalfDay Count"
  subtitle="(0.5 Leave deduct as per count)"
  value={approvedHalfDay}
/>
          <StatCard
  icon={<FiClock className="text-gray-500" />}
  title="Approved Unpaid Leaves"
  value={approvedUnpaidCount}
/>
          <StatCard
            icon={<FiClock className="text-teal-500" />}
            title="Comp-Off Balance"
            value={user?.compOffBalance ?? 0}
          />
          <StatCard
            icon={<FiCalendar className="text-green-600" />}
            title="Available Leave Balance"
            value={user?.leaveBalance ?? 0}
          />
          <StatCard
            icon={<FiCalendar className="text-red-500" />}
            title="Remaining Leaves"
            value={`${remainingLeaves} / ${yearlyQuota}`}
          />
        </div>
      )}

      {!isAdmin && (
        <GlassCard id="leaveFormCard">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h3 className="text-xl font-semibold">
              {formMode === "LEAVE"
                ? "Apply for Leave/WFH"
                : "Cancel Leave (Missed Check-in)"}
            </h3>
            <div className="flex flex-wrap gap-3">
              {/* Top buttons only switch between forms */}
              <button
                onClick={() => setFormMode("LEAVE")}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow text-sm md:text-base"
              >
                Apply Leave
              </button>
              <button
                onClick={() => setFormMode("CANCEL")}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow text-sm md:text-base"
              >
                Cancel Leave
              </button>
            </div>
          </div>
          {editInfo && formMode === "LEAVE" && (
    <div className="mb-4 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
      {editInfo}
    </div>
  )}
          {formMode === "LEAVE" ? (
            <>
              {/* Apply Leave form */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-medium text-gray-600">
                    Leave Type
                  </label>
                  <select
                    className="p-3 rounded-xl border dark:bg-gray-900 shadow"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="CASUAL">Casual Leave</option>
                    <option value="SICK">Sick Leave</option>
                    {/* <option value="PAID">Paid Leave</option> */}
                    <option value="UNPAID">Unpaid Leave</option>
                    <option value="COMP_OFF">Comp Off</option>
                    <option value="HALF_DAY">Half Day</option>
                    <option value="WFH">Work From Home</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium text-gray-600">
                    Start Date
                  </label>
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
                <label className="font-medium text-gray-600">
                  Reason{" "}
                  {(form.type === "WFH" ||
                    calcLeaveDays(form.startDate, form.endDate) >= 3) && (
                    <span className="text-red-500">*</span>
                  )}
                </label>

                <textarea
                  rows={3}
                  placeholder={
                    form.type === "WFH"
                      ? "Reason is required for Work From Home"
                      : calcLeaveDays(form.startDate, form.endDate) >= 3
                        ? "Reason is required beyond three days leave"
                        : "Enter reason (optional)"
                  }
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
            </>
          ) : (
            <>
              {/* Cancel Leave form, mirroring the structure of Apply Leave */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-medium text-gray-600">
                    Date of Leave <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="p-3 rounded-xl border dark:bg-gray-900 shadow"
                    value={cancelForm.date}
                    onChange={(e) =>
                      setCancelForm((f) => ({ ...f, date: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium text-gray-600">
                    Check-in Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    className="p-3 rounded-xl border dark:bg-gray-900 shadow"
                    value={cancelForm.checkInTime}
                    onChange={(e) =>
                      setCancelForm((f) => ({
                        ...f,
                        checkInTime: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium text-gray-600">
                    Check-out Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    className="p-3 rounded-xl border dark:bg-gray-900 shadow"
                    value={cancelForm.checkOutTime}
                    onChange={(e) =>
                      setCancelForm((f) => ({
                        ...f,
                        checkOutTime: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="font-medium text-gray-600 text-sm">
                  Witness (employee / admin who saw you in office){" "}
                  <span className="text-red-500">*</span>
                </label>
                <EmployeeDropdown
                  employees={employees}
                  value={cancelForm.witnessId}
                  onChange={(val) =>
                    setCancelForm((f) => ({ ...f, witnessId: val }))
                  }
                />
              </div>

              <div className="mt-4">
                <label className="font-medium text-gray-600 text-sm">
                  Reason / Additional Details
                </label>
                <textarea
                  rows={3}
                  className="p-3 w-full rounded-xl border dark:bg-gray-900 shadow"
                  placeholder="Explain why you missed check-in (optional)"
                  value={cancelForm.reason}
                  onChange={(e) =>
                    setCancelForm((f) => ({
                      ...f,
                      reason: e.target.value,
                    }))
                  }
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={
                formMode === "LEAVE"
                  ? apply
                  : async () => {
                      if (
                        !cancelForm.date ||
                        !cancelForm.checkInTime ||
                        !cancelForm.checkOutTime ||
                        !cancelForm.witnessId
                      ) {
                        setMsg(
                          "Date, times and witness are required for Cancel Leave",
                        );
                        setMsgType("error");
                        return;
                      }
                      setCancelSubmitLoading(true);
                      setMsg("");
                      setCancelMessage("");
                      try {
                        await api.post("/attendance-corrections/request", {
                          date: cancelForm.date,
                          checkInTime: cancelForm.checkInTime,
                          checkOutTime: cancelForm.checkOutTime,
                          witnessId: cancelForm.witnessId,
                          reason:
                            cancelForm.reason ||
                            "Missed to check-in, present in office",
                        });
                        const successMsg =
                          "Cancel leave request submitted. Admins will be notified for approval.";
                        setMsg(successMsg);
                        setMsgType("success");
                        setCancelMessage(successMsg);
                        setCancelSubmitted(true);
                        setCancelForm({
                          date: "",
                          checkInTime: "",
                          checkOutTime: "",
                          witnessId: "",
                          reason: "",
                        });
                        setTimeout(() => {
                          setCancelSubmitted(false);
                          setCancelMessage("");
                          setFormMode("LEAVE");
                        }, 2000);
                      } catch (err) {
                        const errorMsg =
                          err?.response?.data?.message ||
                          "Failed to submit cancel leave request";
                        setMsg(errorMsg);
                        setMsgType("error");
                        setCancelMessage(errorMsg);
                      } finally {
                        setCancelSubmitLoading(false);
                      }
                    }
              }
              disabled={
                formMode === "LEAVE"
                  ? applyLoading
                  : cancelSubmitLoading || cancelSubmitted
              }
              className={`px-6 py-3 rounded-xl font-semibold shadow-lg text-white
    ${
      applied && formMode === "LEAVE"
        ? "bg-green-600 cursor-default"
        : cancelSubmitted && formMode === "CANCEL"
          ? "bg-green-600 cursor-default"
          : formMode === "CANCEL" && cancelSubmitLoading
            ? "bg-indigo-400 cursor-wait"
            : applyLoading
              ? "bg-indigo-400 cursor-wait"
              : "bg-indigo-600 hover:bg-indigo-700"
    }
  `}
            >
              {formMode === "LEAVE"
                ? applied
                  ? "Applied ✔"
                 : applyLoading
                  ? editingLeaveId
                  ? "Updating..."
                  : "Applying..."
                  : editingLeaveId
                  ? "Update Leave"
                  : "Apply"

                : cancelSubmitted
                  ? "Submitted ✔"
                  : cancelSubmitLoading
                    ? "Submitting..."
                    : "Submit Cancel Request"}
            </button>

            {cancelMessage && formMode === "CANCEL" && (
              <span
                className={`text-sm font-medium ${
                  cancelMessage.includes("Failed") ||
                  cancelMessage.includes("Error") ||
                  cancelMessage.includes("required") ||
                  cancelMessage.includes("already")
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {cancelMessage}
              </span>
            )}

            {applyMessage && formMode === "LEAVE" && (
              <span
                className={`text-sm font-medium ${
                  applyMessage.includes("already") ||
                  applyMessage.includes("Failed") ||
                  applyMessage.includes("Error") ||
                  applyMessage.includes(
                    "Half day leave must be for a single date",
                  ) ||
                  applyMessage.includes("Not enough Comp-Off balance") ||
                  applyMessage.includes("Holiday") ||
                  applyMessage.includes("Week-Off") ||
                  applyMessage.includes("don't have Comp-Off balance")
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {applyMessage}
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
                onDelete={(id) => {
                  setDeleteId(id);
                  setShowDelete(true);
                }}
                onEdit={startEditLeave}
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
      {showDelete && (
        <ConfirmDelPopup
          title="Delete Leave?"
          message="Are you sure you want to delete this leave request? This action cannot be undone."
          onConfirm={confirmDeleteLeave}
          onCancel={() => {
            setShowDelete(false);
            setDeleteId(null);
          }}
        />
      )}

      {/* Today‑leave modal removed as per latest requirement */}
    </div>
  );
}

function LeaveItem({ l, isAdmin, onDelete, onEdit }) {
  const getDays = () => {
    if (!l?.startDate || !l?.endDate) return 0;
    const s = new Date(l.startDate);
    const e = new Date(l.endDate);
    return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  };

  const getDisplayDays = () => {
    if (l.type === "HALF_DAY") return "0.5 day";
    const days = getDays();
    return `${days} day${days > 1 ? "s" : ""}`;
  };

  return (
    <div className="relative p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow">
      <div>
        <div className="text-lg font-semibold">
          {l.type === "WFH" ? (
            <span className="text-blue-600">Work From Home</span>
          ) : l.type === "COMP_OFF" ? (
            <span className="text-yellow-400">Comp Off</span>
          ) : l.type === "PAID" ? (
            <span className="text-green-600">Paid Leave</span>
          ) : l.type === "SICK" ? (
            <span className="text-yellow-600">Sick Leave</span>
          ) : l.type === "CASUAL" ? (
            <span className="text-orange-600">Casual Leave</span>
          ) : l.type === "HALF_DAY" ? (
            <span className="text-purple-600">Half Day</span>
          ) : l.type === "UNPAID" ? (
            <span className="text-gray-600">Unpaid Leave</span>
          ) : (
            l.type
          )}
        </div>

        <div className="text-sm text-gray-500">
          {l.startDate?.slice(0, 10) === l.endDate?.slice(0, 10)
            ? l.startDate?.slice(0, 10)
            : `${l.startDate?.slice(0, 10)} → ${l.endDate?.slice(0, 10)}`}
        </div>

        <div className="text-xs text-gray-400">{getDisplayDays()}</div>

        {/* Employee sees their applied reason */}
        {l.reason && (
          <div className="text-xs text-gray-500 mt-1">
            <b>Your Reason:</b> {l.reason}
          </div>
        )}

        {/* Responsible person (if assigned) */}
        {l.responsiblePerson && (
          <div className="text-xs text-gray-500 mt-1">
            <b>Responsible:</b> {l.responsiblePerson.firstName}{" "}
            {l.responsiblePerson.lastName || ""}
          </div>
        )}

        {/* Employee sees why admin rejected */}
        {l.status === "REJECTED" && l.rejectReason && (
          <div className="text-xs text-red-500 mt-1">
            <b>Rejected Reason:</b> {l.rejectReason}
          </div>
        )}
      </div>
{!isAdmin && l.status === "PENDING" && (
  <div className="absolute top-4 right-4 flex items-center gap-2">
    
    {/* ✏️ EDIT BUTTON */}
    <button
      onClick={() => onEdit(l)}
      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600"
      title="Edit leave"
    >
      <FiEdit className="text-xs" /> Edit
    </button>

    {/* ❌ DELETE BUTTON */}
    <button
      onClick={() => onDelete(l.id)}
      className="text-red-500 hover:text-red-700 font-bold text-lg 
                 rounded-full w-7 h-7 flex items-center justify-center"
      title="Delete leave"
    >
      ✕
    </button>

  </div>
)}

      <div className="flex items-center gap-3">
        <span
          className={`px-4 py-1 rounded-full text-white text-sm font-medium ${l.status === "APPROVED" ? "bg-green-600" : l.status === "REJECTED" ? "bg-red-600" : "bg-yellow-500"}`}
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

function GlassCard({ children, className = "", ...rest }) {
  return (
    <div
      {...rest}  // yahan se id, onClick, etc. sab div par aa jayenge
      className={
        "p-6 rounded-2xl bg-white/60 dark:bg-gray-800/40 shadow border border-gray-200 dark:border-gray-700 backdrop-blur-lg " +
        className
      }
    >
      {children}
    </div>
  );
}

function StatCard({ icon, title, subtitle, value }) {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 shadow border border-gray-200 dark:border-gray-700 flex items-center gap-4">
      <div className="text-3xl">{icon}</div>
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-sm text-gray-500">{title}</div>
        {subtitle && (
          <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{subtitle}</div>
        )}
      </div>
    </div>
  );
}
