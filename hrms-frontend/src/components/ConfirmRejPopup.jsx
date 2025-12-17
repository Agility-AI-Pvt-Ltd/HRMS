import React from "react";

export default function ConfirmRejPopup({ onCancel, onConfirm }) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError("Rejection reason is required");
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg max-w-sm w-full">
        
        <h3 className="text-xl font-semibold mb-4">Reject Leave</h3>

        <p className="text-gray-700 dark:text-gray-300 mb-3">
          Enter rejection message (visible to employee):
        </p>

        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError("");
          }}
          className={`w-full p-2 rounded-lg border dark:bg-gray-800 dark:text-white ${
            error ? "border-red-500" : "border-gray-300 dark:border-gray-600"
          }`}
          rows={4}
          placeholder="Enter reason..."
        />

        {error && (
          <p className="text-red-600 text-sm mt-1">{error}</p>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={!reason.trim()}
            className={`px-4 py-2 rounded-lg text-white ${
              reason.trim()
                ? "bg-red-600 hover:bg-red-700"
                : "bg-red-400 cursor-not-allowed"
            }`}
          >
            Reject Leave
          </button>
        </div>
      </div>
    </div>
  );
}
