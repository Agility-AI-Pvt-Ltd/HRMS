import React, { useState } from "react";

export default function ConfirmDelPopup({ title, message, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false); // 🔥 loading state

  const handleDelete = async () => {
    try {
      setLoading(true);
      await onConfirm();             // wait API response
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg max-w-sm w-full">

        <h3 className="text-xl font-semibold mb-4">{title}</h3>

        <p className="text-gray-700 dark:text-gray-300 mb-6">
          {message}
        </p>

        <div className="flex justify-end gap-3">

          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Deleting..." : "Yes, Delete"} {/* 🔥 loader text */}
          </button>

        </div>

      </div>
    </div>
  );
}
