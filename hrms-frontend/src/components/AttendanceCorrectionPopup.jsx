import { useState } from "react";

export default function AttendanceCorrectionPopup({ date, onClose, onSuccess }) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 dark:bg-black/70 flex justify-center items-center">
      <div className="
        w-full max-w-md rounded-xl p-6
        bg-white dark:bg-gray-900
        border border-gray-200 dark:border-[#2a2c33]
        shadow-xl
      ">
        <h3 className="font-bold mb-3 text-gray-900 dark:text-white">
          Request Present for <span className="text-indigo-600 dark:text-indigo-400">{date}</span>
        </h3>

        <textarea
          className="
            w-full rounded-lg p-3 text-sm
            border border-gray-300 dark:border-[#2a2c33]
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-indigo-500
          "
          rows={4}
          placeholder="Enter reason..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="
              px-4 py-2 rounded-lg text-sm
              bg-gray-200 hover:bg-gray-300
              dark:bg-gray-700 dark:hover:bg-gray-600
              text-gray-800 dark:text-gray-200
            "
          >
            Cancel
          </button>

          <button
            onClick={() => onSuccess(reason)}
            className="
              px-4 py-2 rounded-lg text-sm font-semibold
              bg-green-600 hover:bg-green-700
              text-white
            "
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
