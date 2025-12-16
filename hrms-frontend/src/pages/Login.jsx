// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import api from "../api/axios";
import useAuthStore from "../stores/authstore";
import { useNavigate } from "react-router-dom";
import { FiMoon, FiSun } from "react-icons/fi";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginType, setLoginType] = useState("ADMIN");
  const [errMsg, setErrMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );

  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  // Theme mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const toggleTheme = () => setDarkMode((prev) => !prev);

  // ============================
  // LOGIN SUBMIT — UPDATED
  // ============================
  const submit = async (e) => {
    e.preventDefault();
    setErrMsg("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password, loginType });
      const { accessToken, user } = res.data; // ⬅️ refreshToken removed

      // Save only access token
      localStorage.setItem("hrms_access", accessToken);

      // Set default header
      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      // Updated setAuth (no refreshToken)
      setAuth(user, accessToken);

      // Redirect
      if (user.role === "ADMIN") navigate("/dashboard");
      else navigate("/attendance");

    } catch (err) {
      setErrMsg(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-6 overflow-hidden
      bg-gradient-to-br from-indigo-600/40 via-white/10 to-pink-500/40 
      dark:from-[#070B19] dark:via-[#090C1D] dark:to-black">

      {/* WAVES BACKGROUND */}
      <div className="absolute inset-0 -z-20 pointer-events-none">
        {/* TOP WAVE */}
        <svg
          className="absolute top-0 left-0 w-[200%] h-full animate-waveSlow opacity-60"
          viewBox="0 0 500 250"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="wave1" x1="0" x2="1">
              <stop offset="0%" stopColor={darkMode ? "#8b5cf6" : "#6366F1"} />
              <stop offset="50%" stopColor={darkMode ? "#f472b6" : "#EC4899"} />
              <stop offset="100%" stopColor={darkMode ? "#60a5fa" : "#6366F1"} />
            </linearGradient>
          </defs>
          <path
            d="M0,70 C150,160 350,-20 500,70 L500,250 L0,250 Z"
            fill="url(#wave1)"
          />
        </svg>

        {/* BOTTOM WAVE */}
        <svg
          className="absolute bottom-0 left-0 w-[200%] h-full animate-waveFast opacity-50"
          viewBox="0 0 500 250"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="wave2" x1="0" x2="1">
              <stop offset="0%" stopColor={darkMode ? "#60a5fa" : "#EC4899"} />
              <stop offset="50%" stopColor={darkMode ? "#f472b6" : "#6366F1"} />
              <stop offset="100%" stopColor={darkMode ? "#8b5cf6" : "#6366F1"} />
            </linearGradient>
          </defs>
          <path
            d="M0,160 C200,60 300,260 500,160 L500,250 L0,250 Z"
            fill="url(#wave2)"
          />
        </svg>
      </div>

      {/* FLOATING PARTICLES */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {[...Array(25)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 bg-white/80 dark:bg-pink-400 rounded-full animate-floatParticle"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${4 + Math.random() * 6}s`,
            }}
          />
        ))}
      </div>

      {/* BRANDING */}
      <header className="absolute top-6 left-1/2 -translate-x-1/2 text-center z-20">
        <div className="px-4 py-1 rounded-full bg-white/70 dark:bg-gray-900/70 
          backdrop-blur border border-white/40 dark:border-gray-700 shadow">
          <span className="font-semibold text-gray-900 dark:text-white">
            Lyfshilp Academy
          </span>
          <span className="mx-2 text-gray-500">•</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            Agility AI
          </span>
        </div>
      </header>

      {/* THEME TOGGLE */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-20 p-2 rounded-full bg-white/70 dark:bg-gray-800/70 
          border border-gray-200 dark:border-gray-700 shadow-lg hover:scale-110 transition"
      >
        {darkMode ? <FiSun className="text-yellow-400" /> : <FiMoon />}
      </button>

      {/* LOGIN CARD */}
      <div className="relative mx-auto w-full max-w-md p-[2px] rounded-3xl 
        bg-gradient-to-r from-indigo-500 via-pink-500 to-purple-500 shadow-xl">

        <div className="rounded-3xl p-8 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl 
          border border-white/30 dark:border-gray-700">

          {/* LOGO */}
          <div className="flex justify-center -mt-14 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-white/80 dark:bg-gray-800/80 border
              border-white/40 dark:border-gray-700 backdrop-blur shadow-lg
              flex items-center justify-center animate-floatMini">
              <svg width="42" height="42" viewBox="0 0 48 48">
                <defs>
                  <linearGradient id="lgLogo" x1="0" x2="1">
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#EC4899" />
                  </linearGradient>
                </defs>
                <rect x="4" y="4" width="40" height="40" rx="10" fill="url(#lgLogo)" />
                <circle cx="16" cy="16" r="5" fill="white" />
                <rect x="22" y="15" width="14" height="5" rx="2.5" fill="white" />
              </svg>
            </div>
          </div>

          <h2 className="text-3xl font-extrabold text-center text-gray-900 dark:text-white">
            Sign In
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
            Use your company credentials
          </p>

          {/* ROLE SELECTOR */}
          <div className="flex justify-center gap-2 mb-6">
            {[
              { label: "Admin", value: "ADMIN" },
              { label: "Agility AI", value: "AGILITY" },
              { label: "Lyfshilp", value: "LYFSHILP" },
            ].map((r) => (
              <button
                key={r.value}
                onClick={() => setLoginType(r.value)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition border
                  ${
                    loginType === r.value
                      ? "bg-gradient-to-r from-indigo-600 to-pink-500 text-white shadow border-transparent"
                      : "bg-white/70 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700"
                  }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {errMsg && <p className="text-red-500 text-center text-sm mb-3">{errMsg}</p>}

          {/* FORM */}
          <form onSubmit={submit} className="space-y-4">

            {/* EMAIL */}
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 rounded-xl border bg-white/90 dark:bg-gray-900/70 
              text-gray-800 dark:text-gray-100 placeholder-gray-400  
              border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-indigo-400 transition"
            />

            {/* PASSWORD */}
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border bg-white/90 dark:bg-gray-900/70 
                text-gray-800 dark:text-gray-100 placeholder-gray-400 
                border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-indigo-400 transition"
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 
                text-gray-600 dark:text-gray-300 cursor-pointer"
              >
                {showPassword ? <FiEye size={20} /> : <FiEyeOff size={20} />}
              </button>
            </div>

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold 
              bg-gradient-to-r from-indigo-600 to-pink-500 
              hover:from-indigo-700 hover:to-pink-600 shadow-lg 
              transition disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} HRMS — Agility AI & Lyfshilp Academy
          </p>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes floatMini {
          0% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0); }
        }
        .animate-floatMini { animation: floatMini 4s ease-in-out infinite; }

        @keyframes floatParticle {
          0% { transform: translateY(0) scale(1); opacity: 0.7; }
          50% { transform: translateY(-20px) scale(1.3); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 0.7; }
        }
        .animate-floatParticle { animation: floatParticle linear infinite; }

        @keyframes waveSlow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-waveSlow { animation: waveSlow 22s linear infinite; }

        @keyframes waveFast {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-waveFast { animation: waveFast 14s linear infinite; }
      `}</style>
    </div>
  );
}
