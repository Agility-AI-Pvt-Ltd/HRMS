import React, { useState, useEffect } from "react";
import SidebarPremium from "./SidebarPremium";
import TopbarPremium from "./TopbarPremium";
import DarkModeToggle from "./DarkModeToggle";
import NotificationDropdown from "./NotificationDropdowns";
import ProfileMenu from "./ProfileMenu";
// import FAB from "./FABs";

export default function LayoutPremium({ children }) {
  const [isOpen, setIsOpen] = useState(true);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("hrms_theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("hrms_theme", next ? "dark" : "light");
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <SidebarPremium isOpen={isOpen} toggleSidebar={toggleSidebar} />
      <div className={`flex-1 transition-all duration-300 ${isOpen ? "md:ml-72" : "md:ml-20"}`}>
        <TopbarPremium toggleSidebar={toggleSidebar}>
          <div className="flex items-center gap-3">
            <DarkModeToggle dark={dark} toggleDark={toggleDark} />
            <NotificationDropdown />
            <ProfileMenu />
          </div>
        </TopbarPremium>

        <main className="p-6">
          {children}
        </main>
      </div>

      {/* <FAB /> */}
    </div>
  );
}
