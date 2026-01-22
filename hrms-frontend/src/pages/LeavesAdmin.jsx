// ====================== LeavesAdmin.jsx ======================
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import ConfirmDelPopup from "../components/ConfirmDelPopup";
import ConfirmRejectPopup from "../components/ConfirmRejPopup";

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

function LeaveItem({ l, updateStatus, deleteLeave, openRejectPopup,approveLoadingId, rejectLoadingId, deleteLoadingId }) {
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
    <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow relative">
      
      {/* DELETE BUTTON */}
    <button
  onClick={() => deleteLeave(l.id)}
  disabled={deleteLoadingId === l.id}
  className="absolute top-3 right-3 text-red-600 hover:text-red-800 font-bold text-xl disabled:opacity-50"
>
  {deleteLoadingId === l.id ? "Deleting..." : "✕"}
</button>

      {/* LEFT SECTION */}
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
          ) : l.type === "HALF_DAY" ? (
            <span className="text-purple-600">Half Day</span>
          ) : l.type === "UNPAID" ? (
            <span className="text-gray-600">Unpaid Leave</span>
          ) : (
            l.type
          )}
        </div>

        <div className="text-sm text-gray-500">
          {l.startDate?.slice(0, 10)} → {l.endDate?.slice(0, 10)}
        </div>

        <div className="text-xs text-gray-400">{getDisplayDays()}</div>

        {l.reason && (
          <div className="text-xs text-gray-500 mt-1">
            <b>Reason:</b> {l.reason}
          </div>
        )}
{l.responsiblePerson && (
  <div className="text-xs text-gray-500 mt-1">
    <b>Responsibility Given To:</b>{" "}
    {l.responsiblePerson.firstName} {l.responsiblePerson.lastName}
  </div>
)}
        {/* SHOW REJECT REASON IF LEAVE IS REJECTED */}
        {l.status === "REJECTED" && l.rejectReason && (
          <div className="text-xs text-red-500 mt-1">
            <b>Rejected Because:</b> {l.rejectReason}
          </div>
        )}

        <div className="text-xs text-gray-400">
          User: {l.user?.firstName} {l.user?.lastName}
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex items-center gap-3 mt-3">
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

{l.status === "PENDING" && (
  <div className="flex gap-2">

    <button
      onClick={() => updateStatus(l.id, "APPROVED")}
      disabled={approveLoadingId === l.id}
      className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
    >
      {approveLoadingId === l.id ? "Please wait..." : "Approve"}
    </button>

    <button
      onClick={() => openRejectPopup(l.id)}
      disabled={rejectLoadingId === l.id}
      className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
    >
      {rejectLoadingId === l.id ? "Processing..." : "Reject"}
    </button>

  </div>
)}
      </div>
    </div>
  );
}

// ================= MAIN COMPONENT =================

export default function LeavesAdmin() {
  const [leaves, setLeaves] = useState([]);
  const [compOff, setCompOff] = useState([]);   // ⭐ New
  const [tab, setTab] = useState("leave"); 
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");
  const [loading, setLoading] = useState(true);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState(null);

  const [approveLoadingId, setApproveLoadingId] = useState(null);
  const [rejectLoadingId, setRejectLoadingId] = useState(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [lateHalfDays, setLateHalfDays] = useState([]);

  const [attendanceCorrections, setAttendanceCorrections] = useState([]);
  const [correctionRejectId, setCorrectionRejectId] = useState(null);
  const [correctionRejectOpen, setCorrectionRejectOpen] = useState(false);


  const openRejectPopup = (id) => {
    setRejectId(id);
    setRejectOpen(true);
  };

  const paginatedLeaves = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return leaves.slice(start, start + PAGE_SIZE);
  }, [page, leaves]);

  const totalPages = Math.ceil(leaves.length / PAGE_SIZE);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 3000);
    return () => clearTimeout(t);
  }, [msg]);

const load = async () => {
  setLoading(true);

  // 1️⃣ Leaves Load
  try {
    const r = await api.get("/leaves");
    setLeaves(r.data.leaves || []);
  } catch (err) {
    setMsg("Failed to load leaves");
    setMsgType("error");
  }

  // 2️⃣ Comp-Off Load
  try {
    const c = await api.get("/comp-off");
    setCompOff(c.data.data || []);
  } 
  catch (err) {
    setMsg("Failed to load comp-off");
    setMsgType("error");
  }

  // 3️⃣ Late Half Day Attendance (from Attendance)
try {
const today = new Date().toISOString().slice(0, 10);
const h = await api.get(
  `/attendance/all?start=${today}&end=${today}`
);
const pending = (h.data.attendances || []).filter(
  a => a.status === "HALF_DAY_PENDING"
);
setLateHalfDays(pending);
} catch (err) {
  console.error("Failed to load late half day");
}
// 4️⃣ Attendance Correction Requests
try {
  const r = await api.get("/attendance-corrections");
  setAttendanceCorrections(r.data.data || []);
} catch (e) {
  console.error("Failed to load attendance corrections");
}

  setLoading(false);

};

  useEffect(() => {
    load();
  }, []);

const decideHalfDay = async (attendanceId, action) => {
  try {
    await api.post("/attendance/half-day/decision", {
      attendanceId,
      action, // APPROVE | REJECT
    });

    setMsg("Decision applied successfully");
    setMsgType("success");
    load(); // 🔥 reload leaves + attendance
  } catch (e) {
    setMsg(e?.response?.data?.message || "Action failed");
    setMsgType("error");
  }
};
const decideAttendanceCorrection = async (id, action, reason) => {
  try {
    await api.post("/attendance-corrections/decision", {
      id,
      action,   // "APPROVE" | "REJECT"
      reason,
    });

    setMsg("Attendance correction updated");
    setMsgType("success");
    load();
  } catch (e) {
    setMsg(e?.response?.data?.message || "Action failed");
    setMsgType("error");
  }
};

  // APPROVE - Now shows backend custom message
// APPROVE
const updateStatus = async (id, status) => {
  try {
    setApproveLoadingId(id);                     // only this button loading
    const res = await api.patch(`/leaves/${id}/approve`, { action: status });

    setMsg(res.data?.message || "Status updated");
    setMsgType("success");
    load();
  } catch (e) {
    setMsg("Failed to update");
    setMsgType("error");
  } finally {
    setApproveLoadingId(null);
  }
};

  // REJECT WITH REASON - Now shows backend custom message
// REJECT
const submitReject = async (reason) => {
  try {
    setRejectLoadingId(rejectId);

    const res = await api.patch(`/leaves/${rejectId}/approve`, {
      action: "REJECTED",
      reason,
    });

    setMsg(res.data?.message || "Leave rejected");
    setMsgType("success");
    setRejectOpen(false);
    setRejectId(null);
    load();

  } catch (e) {
    setMsg("Failed to reject");
    setMsgType("error");
  } finally {
    setRejectLoadingId(null);
  }
};


  // DELETE POPUP
  const deleteLeave = (id) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  // DELETE - Now shows backend custom message
  const confirmDelete = async () => {
    try {
      setDeleteLoadingId(deleteId);  
      const response = await api.delete(`/leaves/${deleteId}`);
      
      // ✨ Use backend message if available
      const successMessage = response.data?.message || "Leave deleted";

      setMsg(successMessage);
      setMsgType("success");

      setConfirmOpen(false);
      setDeleteId(null);
      load();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to delete leave");
      setMsgType("error");
    }finally {
     setDeleteLoadingId(null); 
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
{/* 🔥 LATE HALF DAY REQUESTS */}
{lateHalfDays.length > 0 && (
  <GlassCard>
    <h3 className="text-xl font-semibold mb-4">
      Late Half Day Requests
    </h3>

    <div className="space-y-4">
      {lateHalfDays.map((a) => (
        <div
          key={a.id}
          className="p-4 rounded-xl border bg-yellow-50 dark:bg-gray-900"
        >
          <div className="font-semibold">
            {a.user?.firstName} {a.user?.lastName}
          </div>

          <div className="text-sm text-gray-500">
            Date: {a.date?.slice(0, 10)}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => decideHalfDay(a.id, "REJECT")}
              className="px-3 py-1 bg-green-600 text-white rounded"
            >
              Remain Present
            </button>

            <button
              onClick={() => decideHalfDay(a.id, "APPROVE")}
              className="px-3 py-1 bg-red-600 text-white rounded"
            >
              Yes, Half Day
            </button>
          </div>
        </div>
      ))}
    </div>
  </GlassCard>
)}
{attendanceCorrections.length > 0 && (
  <GlassCard>
    <h3 className="text-xl font-semibold mb-4">
      Attendance Correction Requests
    </h3>

    <div className="space-y-4">
      {attendanceCorrections.map((c) => (
        <div
          key={c.id}
          className="p-4 rounded-xl border bg-indigo-50 dark:bg-gray-900"
        >
          <div className="font-semibold">
            {c.user.firstName} {c.user.lastName}
          </div>

          <div className="text-sm text-gray-500">
            Date: {c.date.slice(0, 10)}
          </div>

          <div className="text-xs text-gray-600 mt-1">
            <b>Reason:</b> {c.reason}
          </div>

          {c.status === "REJECTED" && c.adminReason && (
            <div className="text-xs text-red-600 mt-1">
              <b>Rejected:</b> {c.adminReason}
            </div>
          )}

          {c.status === "PENDING" && (
            <div className="flex gap-2 mt-3">
<button
  onClick={() => decideAttendanceCorrection(c.id, "APPROVE")}
  className="px-3 py-1 bg-green-600 text-white rounded"
>
  Approve
</button>

    <button
      onClick={() => {
        setCorrectionRejectId(c.id);
        setCorrectionRejectOpen(true);
      }}
      className="px-3 py-1 bg-red-600 text-white rounded"
    >
      Reject
    </button>
            </div>
          )}
        </div>
      ))}
    </div>
  </GlassCard>
)}

      <PageTitle title="Leaves" sub="Admin Panel – Approve & Manage Leaves" />

      <GlassCard>
        <h3 className="text-xl font-semibold mb-4">All Leave Requests</h3>

        {loading ? (
          <div className="text-center py-6">Loading...</div>
        ) : paginatedLeaves.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-6">
            No leave requests found
          </p>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {paginatedLeaves.map((l) => (
              <LeaveItem
                key={l.id}
                l={l}
                updateStatus={updateStatus}
                deleteLeave={deleteLeave}
                openRejectPopup={openRejectPopup}
                
                approveLoadingId={approveLoadingId}   // ADD THIS
                rejectLoadingId={rejectLoadingId}   
                deleteLoadingId={deleteLoadingId}   // ADD THIS
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-3 mt-4">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm disabled:opacity-40"
            >
              ⬅ Previous
            </button>

            <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
              Page {page} / {totalPages}
            </span>

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

      {confirmOpen && (
        <ConfirmDelPopup
          title="Delete Leave?"
          message="Are you sure you want to delete this leave request?"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={confirmDelete}
        />
      )}

      {rejectOpen && (
        <ConfirmRejectPopup
          onCancel={() => setRejectOpen(false)}
          onConfirm={submitReject}
        />
      )}
      {correctionRejectOpen && (
  <ConfirmRejectPopup
    onCancel={() => setCorrectionRejectOpen(false)}
    onConfirm={(reason) => {
decideAttendanceCorrection(
  correctionRejectId,
  "REJECT",
  reason
);
      setCorrectionRejectOpen(false);
      setCorrectionRejectId(null);
    }}
  />
)}
    </div>
  );
}