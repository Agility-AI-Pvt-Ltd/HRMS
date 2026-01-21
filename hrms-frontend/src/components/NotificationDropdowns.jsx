import React, { useState, useEffect, useCallback } from "react";
import { FiBell } from "react-icons/fi";
import api from "../api/axios";
import useAuthStore from "../stores/authstore";
import { useSocket } from "../contexts/SocketContext";

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const user = useAuthStore((s) => s.user);
  const { socket, isConnected } = useSocket();

  const loadNotes = useCallback(async () => {
    try {
      const r = await api.get("/notifications");
      let all = r.data.notifications || [];

      // ---------------------------
      // 1️⃣ ADMIN sees ALL notifications
      // ---------------------------
      if (user?.role === "ADMIN") {
        setNotes(all);
        // Count unread for admin (notifications not read by anyone)
        setUnreadCount(all.filter(n => !n.isRead || (n.readByIds && n.readByIds.length === 0)).length);
        return;
      }

      // ---------------------------
      // 2️⃣ EMPLOYEE sees only their own notifications
      // ---------------------------
      const filtered = all.filter((n) => n.userId === user?.id);

      setNotes(filtered);
      // Count unread for employee
      setUnreadCount(filtered.filter(n => !n.isRead || !(n.readByIds && n.readByIds.includes(user?.id))).length);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      loadNotes();
    }
  }, [user?.id, user?.role, loadNotes]);

  // Listen for real-time notifications
  useEffect(() => {
    if (!socket || !isConnected || !user?.id) return;

    // Listen for new leave request (for admins/managers)
    const handleNewLeaveRequest = () => {
      // Reload notifications to get the latest from database
      loadNotes();
    };

    // Listen for leave status update (for employees)
    const handleLeaveStatusUpdate = () => {
      // Reload notifications to get the latest from database
      loadNotes();
    };

    socket.on("new_leave_request", handleNewLeaveRequest);
    socket.on("leave_status_update", handleLeaveStatusUpdate);

    return () => {
      if (socket) {
        socket.off("new_leave_request", handleNewLeaveRequest);
        socket.off("leave_status_update", handleLeaveStatusUpdate);
      }
    };
  }, [socket, isConnected, user?.id, loadNotes]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 relative"
      >
        <FiBell />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-3 z-50">
          <h4 className="font-semibold mb-2">Notifications</h4>

          <div className="max-h-56 overflow-auto space-y-3">
            {notes.length === 0 ? (
              <p className="text-sm text-gray-500">No notifications</p>
            ) : (
              notes.map((n) => (
                <div
                  key={n.id}
                  className="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="text-sm font-bold">{n.title}</div>
                  <div className="text-xs text-gray-400">{n.body}</div>

                  <div className="text-[10px] text-gray-500 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
