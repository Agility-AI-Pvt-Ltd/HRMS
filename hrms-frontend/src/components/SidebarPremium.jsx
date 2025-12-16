import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  FiHome, FiUsers, FiGrid, FiClock, FiBookOpen, FiCreditCard, FiBell,
  FiLogOut, FiChevronDown, FiChevronRight, FiChevronLeft, FiSettings,
  FiFileText, FiMenu, FiX
} from "react-icons/fi";
import useAuthStore from "../stores/authstore";

export default function SidebarPremium({ isOpen, toggleSidebar }) {
  const [openMenu, setOpenMenu] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const toggleMenu = (name) => setOpenMenu(openMenu === name ? null : name);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar on mobile when clicking outside
  useEffect(() => {
    if (!isMobile || !isOpen) return;

    const handleClickOutside = (e) => {
      const sidebar = document.getElementById('sidebar-premium');
      if (sidebar && !sidebar.contains(e.target)) {
        toggleSidebar();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobile, toggleSidebar]);

  const menus = [
    { title: "Dashboard", icon: <FiHome />, path: "/" },
    { title: "Employees", icon: <FiUsers />, path: "/employees", adminOnly: true },
    { title: "Departments", icon: <FiGrid />, path: "/departments", adminOnly: true },
    { title: "Attendance", icon: <FiClock />, path: "/attendance" },
    { title: "Leaves/WFH", icon: <FiBookOpen />, path: "/leaves" },
    { title: "Reimbursement", icon: <FiFileText />, path: "/reimbursements" },
    { title: "Payroll", icon: <FiCreditCard />, path: "/payroll", adminOnly: true },
    { title: "Notifications", icon: <FiBell />, path: "/notifications" },
    { title: "Settings", icon: <FiSettings />, children: [{ title: "Profile", path: "/profile" }] },
  ];

  return (
    <>
      {/* MOBILE OVERLAY */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* SIDEBAR */}
      <aside
        id="sidebar-premium"
        className={`fixed top-0 left-0 h-full z-50 transition-all duration-300
        backdrop-blur-xl bg-white/95 dark:bg-gray-800/95 border-r shadow-xl
        ${isMobile 
          ? (isOpen ? "w-72 translate-x-0" : "-translate-x-full") 
          : (isOpen ? "w-72" : "w-20")
        }`}
      >
        {/* DESKTOP TOGGLE BUTTON */}
        {!isMobile && (
          <button
            onClick={toggleSidebar}
            className="absolute -right-3 top-6 bg-white dark:bg-gray-700 border 
            shadow-lg rounded-full p-1.5 z-50 hover:scale-110 transition-transform"
          >
            {isOpen ? <FiChevronLeft size={18} /> : <FiChevronRight size={18} />}
          </button>
        )}

        {/* MOBILE CLOSE BUTTON */}
        {isMobile && isOpen && (
          <button
            onClick={toggleSidebar}
            className="absolute right-4 top-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 
            rounded-lg transition-colors"
          >
            <FiX size={24} />
          </button>
        )}

        {/* HEADER */}
        <div className={`flex items-center justify-between p-4 border-b ${!isOpen && !isMobile ? 'justify-center' : ''}`}>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-600
              flex items-center justify-center text-white font-bold"
            >
              H
            </div>

            {(isOpen || isMobile) && (
              <h1
                className="text-3xl font-extrabold text-transparent bg-clip-text 
                bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                HRMS
              </h1>
            )}
          </div>
        </div>

        {/* MENU ITEMS */}
        <nav className="mt-4 px-2 space-y-2 overflow-y-auto overflow-x-hidden h-[calc(100vh-120px)] 
        scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {menus.map((m, idx) => {
            if (m.adminOnly && user.role !== "ADMIN") return null;

            // Normal menu item
            if (!m.children) {
              return (
                <NavLink
                  key={idx}
                  to={m.path}
                  onClick={() => isMobile && toggleSidebar()}
                  className={({ isActive }) =>
                    `flex items-center gap-4 p-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    }`
                  }
                >
                  <span className="text-xl flex-shrink-0">{m.icon}</span>
                  {(isOpen || isMobile) && <span className="flex-1">{m.title}</span>}
                </NavLink>
              );
            }

            // Dropdown menu
            return (
              <div key={idx}>
                <button
                  onClick={() => toggleMenu(m.title)}
                  className="flex items-center gap-4 p-3 w-full rounded-xl
                  text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700
                  transition-all"
                >
                  <span className="text-xl flex-shrink-0">{m.icon}</span>
                  {(isOpen || isMobile) && <span className="flex-1">{m.title}</span>}
                  {(isOpen || isMobile) && (openMenu === m.title ? <FiChevronDown /> : <FiChevronRight />)}
                </button>

                {openMenu === m.title && (isOpen || isMobile) && (
                  <div className="ml-10 mt-2 space-y-2">
                    {m.children.map((c, i) => (
                      <NavLink
                        key={i}
                        to={c.path}
                        onClick={() => isMobile && toggleSidebar()}
                        className={({ isActive }) =>
                          `block p-2 rounded-lg text-sm transition-all ${
                            isActive
                              ? "bg-blue-600 text-white"
                              : "text-gray-600 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700"
                          }`
                        }
                      >
                        {c.title}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* LOGOUT */}
          <div className="mt-6 pb-4">
            <button
              onClick={logout}
              className="flex items-center gap-3 p-3 rounded-xl w-full
              text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
            >
              <FiLogOut className="text-xl flex-shrink-0" />
              {(isOpen || isMobile) && "Logout"}
            </button>
          </div>
        </nav>
      </aside>

      {/* MOBILE MENU BUTTON - Fixed at top left when sidebar is closed */}
      {isMobile && !isOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-40 p-3 bg-white dark:bg-gray-800 
          rounded-lg shadow-lg border border-gray-200 dark:border-gray-700
          hover:scale-110 transition-transform"
        >
          <FiMenu size={24} />
        </button>
      )}
    </>
  );
}