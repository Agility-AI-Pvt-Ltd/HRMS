import React, { useEffect, useState } from "react";
import api from "../api/axios";
import ConfirmDelPopup from "../components/ConfirmDelPopup";

/* ----------------- STATUS COLORS ----------------- */
const statusColor = {
  PENDING: "text-yellow-600 dark:text-yellow-400",
  APPROVED: "text-green-600 dark:text-green-400",
  REJECTED: "text-red-600 dark:text-red-400",
};

/* ----------------- TOAST MESSAGE ----------------- */
/* ----------------- TOAST MESSAGE (FIXED) ----------------- */
const Toast = ({ msg, type = "success" }) => {
  const colorMap = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-blue-600",
    warn: "bg-yellow-500 text-black",
  };

  return (
    <div
      className={`
        ${colorMap[type]}
        text-white px-4 py-2 rounded-lg shadow
        text-sm mb-4
        animate-fadeIn
      `}
    >
      {msg}
    </div>
  );
};

export default function EmployeeReimbursement() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bills, setBills] = useState([]);
  const [list, setList] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  /* SHOW MESSAGE 2 SEC */
  const [toastType, setToastType] = useState("success");

  const showMsg = (msg, type = "success") => {
    setToastType(type);
    setMessage(msg);
    setTimeout(() => setMessage(""), 2000);
  };
  /* LOAD MY REIMBURSEMENTS */
const loadMy = async () => {
  setLoading(true); // 🔥 START LOADING
  try {
    const res = await api.get("/reimbursement/me");
    setList(res.data.list);
  } finally {
    setLoading(false); // 🔥 END LOADING
  }
};

  useEffect(() => {
    loadMy();
  }, []);

  /* ======================================================
         UPLOAD BILL FILES
  ====================================================== */
  const handleUpload = async (e) => {
    try {
      const files = e.target.files;
      if (!files.length) return;

      setUploading(true);

      const form = new FormData();
      [...files].forEach((f) => form.append("files", f));

      const res = await api.post("/reimbursement/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const uploaded = res.data.files.map((f) => ({
        fileUrl: f.fileUrl,
        amount: "",
        note: "",
      }));

      setBills((prev) => [...prev, ...uploaded]);
      showMsg("Files uploaded!", "success");
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    await api.delete(`/reimbursement/me/${selectedId}`);
    setShowDelete(false);
    setSelectedId(null);
    loadMy();
    showMsg("Request deleted", "success");
  };

  /* ======================================================
         SUBMIT FORM
  ====================================================== */
  const submitForm = async () => {
    if (!title.trim()) return showMsg("Title is required", "error");
    if (bills.length === 0) return showMsg("Upload at least 1 bill", "error");

    const invalidBill = bills.find((b) => !b.fileUrl || !b.amount);
    if (invalidBill) return showMsg("Each bill must have amount", "error");

    try {
      setSubmitting(true);
      setList([]);
      await api.post("/reimbursement/create", {
        title,
        description,
        bills,
      });

      setTitle("");
      setDescription("");
      setBills([]);
      showMsg("Reimbursement submitted!", "success");
      await loadMy();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4">
      {message && <Toast msg={message} type={toastType} />}

      {/* FORM CARD */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-5 dark:text-white">
          Submit Reimbursement
        </h2>

        <div className="grid gap-4">
          <input
            type="text"
            placeholder="Reimbursement Title"
            className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            placeholder="Description (optional)"
            rows="3"
            className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          ></textarea>

          {/* Upload */}
          <div className="space-y-2">
            <label className="font-semibold dark:text-white">
              You Can Upload Multiple Bills (PDF / Images):
            </label>

            <input
              type="file"
              multiple
              accept="application/pdf,image/*"
              onChange={handleUpload}
              className="mt-1 block"
            />

            {uploading && (
              <p className="text-blue-600 animate-pulse">Uploading...</p>
            )}
          </div>

          {/* Bill List */}
          {bills.length > 0 && (
            <div className="space-y-3 mt-2">
              {bills.map((b, i) => (
                <div
                  key={i}
                  className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                >
                  <div className="flex justify-between">
                    <a
                      href={b.fileUrl}
                      target="_blank"
                      className="text-blue-600 underline break-all"
                    >
                      {b.fileUrl.split("/").pop()}
                    </a>

                    <button
                      onClick={() =>
                        setBills((prev) => prev.filter((_, x) => x !== i))
                      }
                      className="text-red-600 font-semibold"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <input
                      type="number"
                      placeholder="Amount"
                      className="px-2 py-1 border rounded dark:bg-gray-700 dark:text-white"
                      value={b.amount}
                      onChange={(e) =>
                        setBills((prev) => {
                          const copy = [...prev];
                          copy[i].amount = e.target.value;
                          return copy;
                        })
                      }
                    />

                    <input
                      type="text"
                      placeholder="Note"
                      className="px-2 py-1 border rounded dark:bg-gray-700 dark:text-white"
                      value={b.note}
                      onChange={(e) =>
                        setBills((prev) => {
                          const copy = [...prev];
                          copy[i].note = e.target.value;
                          return copy;
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            disabled={submitting}
            onClick={submitForm}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow font-semibold"
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>

      {/* LIST */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 dark:text-white">My Requests</h2>

        { loading ? (
        <div className="text-center py-8 text-blue-600 dark:text-blue-400 animate-pulse text-lg font-semibold">
          Loading...
        </div>   
        ) : list.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">You Will See Your Reimbursement Request After Submit....</p>
        ) : (
          <div className="space-y-4 max-h-[450px] overflow-y-scroll pr-2 custom-scroll">
            {list.map((r) => (
              <div
                key={r.id}
                className="relative p-4 border rounded-xl bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
              >
                {/* DELETE BUTTON FOR PENDING & REJECTED (EMPLOYEE ONLY) */}
                {["PENDING", "REJECTED"].includes(r.status) && (
                  <button
                    onClick={() => {
                      setSelectedId(r.id);
                      setShowDelete(true);
                    }}
                    className="absolute top-3 right-3 text-red-600 hover:text-red-800 font-bold"
                  >
                    ✕
                  </button>
                )}

                <div className="flex justify-between pr-6">
                  <h3 className="font-bold dark:text-white">{r.title}</h3>
                  <span className={`font-bold ${statusColor[r.status]}`}>
                    {r.status}
                  </span>
                </div>

                <p className="text-sm mt-1 dark:text-gray-300">
                  Total: ₹{r.totalAmount}
                </p>

                <div className="mt-2 space-y-1">
                  {r.bills.map((b) => (
                    <a
                      key={b.id}
                      href={b.fileUrl}
                      target="_blank"
                      className="text-blue-600 underline text-sm block"
                    >
                      Bill • ₹{b.amount} — {b.note}
                    </a>
                  ))}
                </div>

                {/* ⭐ SHOW REJECTED REASON TO EMPLOYEE */}
                {r.status === "REJECTED" && r.rejectReason && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                    <b>Rejected Reason:</b> {r.rejectReason}
                  </p>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
        {showDelete && (
          <ConfirmDelPopup
            title="Delete Reimbursement?"
            message="Are you sure you want to delete this reimbursement request? This action cannot be undone."
            onConfirm={confirmDelete}
            onCancel={() => {
              setShowDelete(false);
              setSelectedId(null);
            }}
          />
        )}
      </div>

      {/* Scrollbar */}
      <style>
        {`
.custom-scroll {
  overflow-y: scroll !important;
  scrollbar-gutter: stable both-edges !important;
}

/* WebKit */
.custom-scroll::-webkit-scrollbar {
  width: 10px !important;
  background: #1f2937;
}

.custom-scroll::-webkit-scrollbar-thumb {
  background: #6b7280 !important;
  border-radius: 10px;
}

.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: #9ca3af !important;
}

/* Firefox */
.custom-scroll {
  scrollbar-width: thin;
  scrollbar-color: #6b7280 #1f2937;
}
`}
      </style>
    </div>
  );
}
