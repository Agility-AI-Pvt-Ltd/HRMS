import React, { useEffect, useState } from "react";
import api from "../api/axios";
import ConfirmDelPopup from "../components/ConfirmDelPopup";
import ConfirmRejectPopup from "../components/ConfirmRejPopup";

const statusColor = {
  PENDING: "text-yellow-600 dark:text-yellow-400",
  APPROVED: "text-green-600 dark:text-green-400",
  REJECTED: "text-red-600 dark:text-red-400",
};

export default function ResignationAdmin() {

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState(null);

  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [rejectLoadingId, setRejectLoadingId] = useState(null);

  /* ================= LOAD ALL ================= */
  const loadAll = async () => {
    try {
      setLoading(true);
      const r = await api.get("/resignation/admin"); // UPDATED
      setList(r.data.list || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  /* ================= APPROVE ================= */
  const approveRequest = async (id) => {
    try {
      setActionLoadingId(id);
      await api.put(`/resignation/status/${id}`, { status: "APPROVED" }); // UPDATED
      loadAll();
    } finally {
      setActionLoadingId(null);
    }
  };

  /* ================= REJECT POPUP ================= */
  const rejectRequest = (id) => {
    setRejectId(id);
    setRejectOpen(true);
  };

  const submitReject = async (reason) => {
    try {
      setRejectLoadingId(rejectId);
      await api.put(`/resignation/status/${rejectId}`, { status: "REJECTED", reason }); // UPDATED
      loadAll();
    } finally {
      setRejectLoadingId(null);
      setRejectOpen(false);
      setRejectId(null);
    }
  };

  /* ================= DELETE ================= */
  const deleteRequest = (id) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/resignation/admin/${deleteId}`); // UPDATED
      loadAll();
    } finally {
      setConfirmOpen(false);
      setDeleteId(null);
    }
  };

  /* ================= EXPORT ================= */
  const exportCSV = () => window.open("/api/resignation/export?format=csv");
  const exportExcel = () => window.open("/api/resignation/export?format=excel");

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold dark:text-white">Resignation Requests</h1>

        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900"
          >
            Export CSV
          </button>

          <button
            onClick={exportExcel}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* DATA TABLE CARD */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border dark:border-gray-700">

        {loading ? (
          <p className="text-center py-10 text-gray-500 dark:text-gray-400">Loading...</p>
        ) : list.length === 0 ? (
          <p className="text-center py-10 text-gray-500 dark:text-gray-400">No Resignation Requests</p>
        ) : (
          <div className="space-y-5 max-h-[550px] overflow-y-auto pr-2 custom-scroll">

            {list.map((r) => (
              <div key={r.id} className="p-4 rounded-xl border shadow dark:border-gray-700 dark:bg-gray-800 relative">

                {/* DELETE BUTTON */}
                <button
                  onClick={() => deleteRequest(r.id)}
                  className="absolute top-3 right-3 text-red-600 hover:text-red-800 font-bold text-xl"
                >
                  ✕
                </button>

                {/* USER INFO */}
                <div className="flex justify-between items-center pr-8">
                  <div>
                    <h3 className="font-bold dark:text-white">{r.user.firstName} {r.user.lastName}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{r.user.email}</p>
                  </div>
                  <span className={`font-bold ${statusColor[r.status]}`}>{r.status}</span>
                </div>

                <p className="text-sm dark:text-gray-300 mt-1">
                  Last Working Day: {new Date(r.lastWorking).toLocaleDateString()}
                </p>

                {r.reason && <p className="italic text-xs opacity-80 mt-1 dark:text-gray-300">"{r.reason}"</p>}

                {/* ACTION BUTTONS */}
                {r.status === "PENDING" ? (
                  <div className="flex gap-3 mt-4">

                    <button
                      onClick={() => approveRequest(r.id)}
                      disabled={actionLoadingId === r.id}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
                    >
                      {actionLoadingId === r.id ? "Processing..." : "Approve"}
                    </button>

                    <button
                      onClick={() => rejectRequest(r.id)}
                      disabled={rejectLoadingId === r.id}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
                    >
                      {rejectLoadingId === r.id ? "Processing..." : "Reject"}
                    </button>
                  </div>
                ) : (
                  <span className={`mt-4 inline-block px-4 py-1 rounded-full text-white text-sm ${
                    r.status === "APPROVED" ? "bg-green-600" : "bg-red-600"
                  }`}>
                    {r.status}
                  </span>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
            ))}

          </div>
        )}
      </div>

      {/* POPUPS */}
      {confirmOpen && (
        <ConfirmDelPopup
          title="Delete Resignation?"
          message="Are you sure you want to remove this resignation request?"
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

      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 8px }
        .custom-scroll::-webkit-scrollbar-thumb { background:#6b7280;border-radius:10px }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background:#9ca3af }
      `}</style>

    </div>
  );
}
