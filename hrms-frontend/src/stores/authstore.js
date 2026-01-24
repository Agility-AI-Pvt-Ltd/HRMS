import { create } from "zustand";
import { jwtDecode } from "jwt-decode";
import api from "../api/axios";

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: localStorage.getItem("hrms_access") || null,
  loading: true,

  /* ---------------------------------------------------
     SET AUTH (LOGIN SUCCESS)
  ---------------------------------------------------- */
  setAuth: (user, accessToken, refreshToken) => {
    if (accessToken) localStorage.setItem("hrms_access", accessToken);
    if (refreshToken) localStorage.setItem("hrms_refresh", refreshToken);

    set({
      user,
      accessToken,
      loading: false,
    });
  },

  /* ---------------------------------------------------
     SET USER (for balance updates)
  ---------------------------------------------------- */
  setUser: (userData) => {
    set((state) => ({
      user: {
        ...state.user,
        ...userData
      }
    }));
  },

  /* ---------------------------------------------------
     FINISH INITIAL LOADING
  ---------------------------------------------------- */
  finishLoading: () => set({ loading: false }),

  /* ---------------------------------------------------
     AUTO LOAD USER FROM ACCESS TOKEN + FETCH FULL DATA
  ---------------------------------------------------- */
  loadUserFromToken: async () => {
    const token = localStorage.getItem("hrms_access");
    
    if (!token) {
      set({ loading: false, user: null, accessToken: null });
      return;
    }

    try {
      // ✅ Decode token first
      const decoded = jwtDecode(token);

      // ✅ Set basic user + token
      set({
        user: {
          id: decoded.sub || decoded.id,
          role: decoded.role,
        },
        accessToken: token,
        loading: true, // keep loading until we fetch full data
      });

      // ✅ Fetch full user data from backend (includes leaveBalance)
      try {
        const res = await api.get("/users/me");
        
        if (res.data.success) {
          set({
            user: res.data.user,
            loading: false,
          });
        } else {
          set({ loading: false });
        }
      } catch (apiErr) {
        console.error("Failed to fetch user data:", apiErr);
        
        // ❌ If API fails, clear everything
        localStorage.removeItem("hrms_access");
        localStorage.removeItem("hrms_refresh");
        
        set({
          user: null,
          accessToken: null,
          loading: false,
        });
      }

    } catch (err) {
      console.error("Token decode failed:", err);
      
      // ❌ Invalid token, clear everything
      localStorage.removeItem("hrms_access");
      localStorage.removeItem("hrms_refresh");
      
      set({
        user: null,
        accessToken: null,
        loading: false,
      });
    }
  },

  /* ---------------------------------------------------
     LOGOUT
  ---------------------------------------------------- */
  logout: () => {
    localStorage.removeItem("hrms_access");
    localStorage.removeItem("hrms_refresh");

    set({
      user: null,
      accessToken: null,
      loading: false,
    });

    window.location.href = "/login";
  },
  
  /* ---------------------------------------------------
     REFRESH USER (for manual updates)
  ---------------------------------------------------- */
  refreshUser: async () => {
    try {
      const res = await api.get("/users/me");

      if (res.data.success) {
        set((state) => ({
          user: {
            ...state.user,
            ...res.data.user,
          },
        }));
      }
    } catch (err) {
      console.error("Failed to refresh user", err);
    }
  },

}));

export default useAuthStore;