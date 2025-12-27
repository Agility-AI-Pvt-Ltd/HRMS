import React, { useEffect, useState } from "react";
import api from "../api/axios";
import ConfirmDelPopup from "../components/ConfirmDelPopup";
import ConfirmRejectPopup from "../components/ConfirmRejPopup";

const statusColor = {
  PENDING: "text-yellow-600 dark:text-yellow-400",
  APPROVED: "text-green-600 dark:text-green-400",
  REJECTED: "text-red-600 dark:text-red-400",
};

export default function AdminReimbursement() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState(null);

 const [actionLoadingId, setActionLoadingId] = useState(null);   // approve
 const [rejectLoadingId, setRejectLoadingId] = useState(null);   // 🔥 new for reject

  const loadAll = async () => {
    try {
      setLoading(true);
      const res = await api.get("/reimbursement/all");
      setList(res.data.list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ================= EXPORT ================= */
/* ================= EXPORT (FIXED) ================= */
const exportData = async (format) => {
  try {
    const res = await api.get(
      `/reimbursement/export?format=${format}`,
      { responseType: "blob" } // 👈 MOST IMPORTANT
    );

    const blob = new Blob([res.data]);
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `reimbursements.${format === "csv" ? "csv" : "xlsx"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error("EXPORT ERROR:", err.response || err);
    alert("Export failed");
  }
};

  /** Approve OR open reason popup **/
const updateStatus = async (id, status) => {
  if (status === "REJECTED") {
    setRejectId(id);
    setRejectOpen(true);
    return;
  }

  try {
    setActionLoadingId(id);
    await api.patch(`/reimbursement/${id}/status`, { status });
    loadAll();
  } finally {
    setActionLoadingId(null);
  }
};

  /** DELETE POPUP **/
  const deleteItem = (id) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/reimbursement/admin/${deleteId}`);
      setConfirmOpen(false);
      setDeleteId(null);
      loadAll();
    } catch (err) {
      console.error(err);
    }
  };

  /** REJECT WITH REASON **/
const submitReject = async (reason)=>{
  try{
    setRejectLoadingId(rejectId);   // this row waiting
    await api.patch(`/reimbursement/${rejectId}/status`,{
      status:"REJECTED",
      reason
    });

    setRejectOpen(false);
    setRejectId(null);
    loadAll();                     // refresh list
  }finally{
    setRejectLoadingId(null);
  }
}

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold dark:text-white">
          Reimbursement Requests
        </h1>

        {/* EXPORT BUTTONS */}
        <div className="flex gap-2">
          <button
            onClick={() => exportData("csv")}
            className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportData("xlsx")}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border dark:border-gray-700">
        {loading ? (
          <p className="text-center text-gray-500 dark:text-gray-400">
            Loading...
          </p>
        ) : list.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400">
            No requests
          </p>
        ) : (
          <div className="space-y-5">
            {list.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl border shadow dark:border-gray-700 dark:bg-gray-800 relative"
              >
                {/* DELETE BUTTON */}
                <button
                  onClick={() => deleteItem(r.id)}
                  className="absolute top-3 right-3 text-red-600 hover:text-red-800 font-bold text-xl"
                >
                  ✕
                </button>

                {/* HEADER */}
                <div className="flex justify-between items-center pr-8">
                  <div>
                    <h3 className="font-bold dark:text-white">{r.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {r.user?.firstName} ({r.user?.email})
                    </p>
                  </div>

                  <span className={`font-bold ${statusColor[r.status]}`}>
                    {r.status}
                  </span>
                </div>

                <p className="text-sm dark:text-gray-300 mt-1">
                  Total Amount: ₹{r.totalAmount}
                </p>

                {/* BILLS */}
                <div className="mt-3 space-y-1">
                  {r.bills.map((b) => (
                    <a
                      key={b.id}
                      href={b.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline text-sm block"
                    >
                      ₹{b.amount} — {b.note || "Bill"}
                    </a>
                  ))}
                </div>

                {/* REJECT REASON */}
                {r.status === "REJECTED" && r.rejectReason && (
                  <p className="text-red-500 text-xs mt-2">
                    <b>Rejected Because:</b> {r.rejectReason}
                  </p>
                )}

                <p className="text-xs text-gray-500 mt-3">
                  {new Date(r.createdAt).toLocaleString()}
                </p>

                {/* ACTIONS */}
{/* ACTIONS */}
{r.status === "PENDING" && (
  <div className="flex gap-3 mt-4">

    {/* APPROVE BUTTON */}
    <button
      onClick={()=>{
        setActionLoadingId(r.id);
        updateStatus(r.id,"APPROVED");
      }}
      disabled={actionLoadingId === r.id}
      className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
    >
      {actionLoadingId === r.id ? "Please wait..." : "Approve"}
    </button>

    {/* REJECT BUTTON - popup first */}
    <button
      onClick={()=>{
        setRejectId(r.id);
        setRejectOpen(true);
      }}
      disabled={rejectLoadingId === r.id}
      className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
    >
      {rejectLoadingId === r.id ? "Processing..." : "Reject"}
    </button>

  </div>
)}

                {r.status !== "PENDING" && (
                  <div className="mt-3">
                    <span
                      className={`px-4 py-1 rounded-full text-white text-sm font-medium ${
                        r.status === "APPROVED"
                          ? "bg-green-600"
                          : "bg-red-600"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DELETE POPUP */}
      {confirmOpen && (
        <ConfirmDelPopup
          title="Delete Reimbursement?"
          message="Are you sure you want to delete this reimbursement?"
          onCancel={() => {
            setConfirmOpen(false);
            setDeleteId(null);
          }}
          onConfirm={confirmDelete}
        />
      )}

      {/* REJECT POPUP */}
      {rejectOpen && (
        <ConfirmRejectPopup
          onCancel={() => setRejectOpen(false)}
          onConfirm={submitReject}
        />
      )}
    </div>
  );
}