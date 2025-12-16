import { create } from "zustand";
import { jwtDecode } from "jwt-decode";

const useAuthStore = create((set) => ({
  user: null,
  accessToken: localStorage.getItem("hrms_access") || null,
  loading: true,

  /* ---------------------------------------------------
     SET AUTH (LOGIN SUCCESS) — UPDATED (NO REFRESH TOKEN)
  ---------------------------------------------------- */
  setAuth: (user, accessToken) => {
    if (accessToken) localStorage.setItem("hrms_access", accessToken);

    set({
      user,
      accessToken,
      loading: false,
    });
  },

  /* ---------------------------------------------------
     FINISH INITIAL LOADING (for App.jsx)
  ---------------------------------------------------- */
  finishLoading: () => set({ loading: false }),

  /* ---------------------------------------------------
     AUTO DECODE USER FROM ACCESS TOKEN
     (ONLY accessToken stored)
  ---------------------------------------------------- */
  loadUserFromToken: () => {
    const token = localStorage.getItem("hrms_access");
    if (!token) return set({ loading: false });

    try {
      const decoded = jwtDecode(token);

      set({
        user: {
          id: decoded.id,       // backend uses id (not sub anymore)
          role: decoded.role,
        },
        accessToken: token,
        loading: false,
      });
    } catch (err) {
      console.error("Token decode failed:", err);
      set({ loading: false });
    }
  },

  /* ---------------------------------------------------
     LOGOUT — ONLY CLEARS ACCESS TOKEN
     Refresh token auto-clears (cookie) on backend
  ---------------------------------------------------- */
  logout: () => {
    localStorage.removeItem("hrms_access");

    set({
      user: null,
      accessToken: null,
      loading: false,
    });

    window.location.href = "/login";
  },
}));

export default useAuthStore;
