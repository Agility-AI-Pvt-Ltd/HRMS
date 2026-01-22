// src/pages/EmployeeView.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import { FiMail, FiUser, FiBriefcase, FiCalendar,  FiClock, FiCreditCard,} from "react-icons/fi";

const getWeekOffLabel = (weekOff) => {
  if (!weekOff) return "Not Assigned";
  if (weekOff.isFixed && weekOff.offDay) {
    return `${weekOff.offDay}`;
  }
  if (!weekOff.isFixed && weekOff.offDate) {
    return new Date(weekOff.offDate).toLocaleDateString();
  }
  return "Not Assigned";
};

const formatTime = (v) => {
  if (!v) return "--";

  const d = new Date(v);

  // 🔥 subtract 5 hours 30 minutes
  d.setMinutes(d.getMinutes() - 330);

  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getLeaveLabel = (type) => {
  const map = {
    HALF_DAY: "Half Day",
    WFH: "WFH",
    COMP_OFF: "Comp-Off",
    PAID: "Leave",
    SICK: "Sick Leave",
    CASUAL: "Casual Leave",
    UNPAID: "Unpaid Leave",
  };
  return map[type] || "Leave";
};


export default function EmployeeView() {
  const { id } = useParams();
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("attendance");

  const [limit, setLimit] = useState(50); // load more handler

const load = async () => {
  try {
    const userRes = await api.get(`/users/${id}/details`);

    setEmp({
      ...userRes.data.user,
      stats: userRes.data.stats,
      weeklyOff: userRes.data.user.weeklyOff, // 👈 YAHIN SE AAYEGA
    });
  } catch (e) {
    console.error(e);
  }
  setLoading(false);
};

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!emp) return <div className="p-6">User not found</div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">

      {/* 🔵 TOP PROFILE HEADER */}
      <div className="bg-white/70 dark:bg-gray-800/50 p-6 rounded-2xl shadow-xl backdrop-blur flex flex-col md:flex-row gap-6 items-center">
        <img
          src={`https://ui-avatars.com/api/?name=${emp.firstName}+${emp.lastName}&size=160`}
          className="w-32 h-32 rounded-full shadow border"
        />

        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            {emp.firstName} {emp.lastName}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-1">
            <FiMail /> {emp.email}
          </p>

          {/* Quick Top Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <QuickInfo label="Role" value={emp.role} icon={<FiUser />} />
            <QuickInfo 
  label="Department" 
  value={
    emp.departments?.length 
      ? emp.departments.map(d => d.department?.name).join(", ") 
      : "Not Assigned"
  }
  icon={<FiBriefcase />} 
/>
            <QuickInfo label="Leave Balance" value={emp.leaveBalance ?? 0} icon={<FiCalendar />} />
            <QuickInfo
  label="Assigned Week Off"
  value={getWeekOffLabel(emp.weeklyOff)}
  icon={<FiCalendar />}
/>
            <QuickInfo label="Joined" value={new Date(emp.createdAt).toLocaleDateString()} icon={<FiCalendar />} />
            <QuickInfo label="Active" value={emp.isActive ? "Yes" : "No"} icon={<FiUser />} />
          </div>
          {/* 🔥 Resignation KPI – Latest Request */}
{emp.resignations?.length > 0 && (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
    <QuickInfo 
      label="Resignation Status"
      value={emp.resignations[0].status}
      icon={<FiBriefcase />}
    />
    <QuickInfo 
      label="Last Working Day"
      value={new Date(emp.resignations[0].lastWorking).toLocaleDateString()}
      icon={<FiCalendar />}
    />
    <QuickInfo 
      label="Notice Period"
      value={`${emp.resignations[0].noticePeriod ?? 0} Days`}
      icon={<FiClock />}
    />
  </div>
)}

        </div>
      </div>

      {/* 🔵 STICKY TAB HEADER */}
      <div className="flex gap-3 sticky top-0 bg-transparent pb-2 z-40">
        <TabButton label="Attendance" tab="attendance" activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton label="Leaves" tab="leaves" activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton label="Payroll" tab="payroll" activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* 🔵 TAB CONTENT */}
      {activeTab === "attendance" && <AttendanceSection emp={emp} limit={limit} setLimit={setLimit} />}
      {activeTab === "leaves" && <LeavesSection emp={emp} limit={limit} setLimit={setLimit} />}
      {activeTab === "payroll" && <PayrollSection emp={emp} limit={limit} setLimit={setLimit} />}
    </div>
  );
}

/* -------------------------------- QUICK INFO -------------------------------- */
function QuickInfo({ label, value, icon }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-100 dark:bg-gray-700">
      <div className="text-lg">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

/* -------------------------------- TAB BUTTON -------------------------------- */
function TabButton({ label, tab, activeTab, setActiveTab }) {
  return (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 rounded-xl font-semibold transition 
      ${activeTab === tab
        ? "bg-indigo-600 text-white shadow"
        : "bg-white/70 dark:bg-gray-800/50 border text-gray-700 dark:text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

/* -------------------------------- SECTIONS -------------------------------- */

function AttendanceSection({ emp, limit, setLimit }) {
  const list = emp.attendances
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);

  return (
    <Section title="Attendance Summary">
      <div className="grid sm:grid-cols-2 gap-4">
        <InfoCard label="Total Records" value={emp.attendances.length} icon={<FiClock />} />
        <InfoCard label="Present Days" value={emp.attendances.filter( a => a.status === "PRESENT").length} icon={<FiClock />} />
      </div>

      <ListContainer>
        {list.map(a => (
          <ListItem
            key={a.id}
            left={new Date(a.date).toLocaleDateString()}
            right={`In: ${formatTime(a.checkIn)} | Out: ${formatTime(a.checkOut)}`}
          />
        ))}
      </ListContainer>

      {limit < emp.attendances.length && (
        <LoadMoreButton onClick={() => setLimit(limit + 50)} />
      )}
    </Section>
  );
}

function LeavesSection({ emp, limit, setLimit }) {
  const leaves = emp.leaves || [];
  const stats = emp.stats || {};

  return (
    <Section title="Leave Summary (Yearly)">
      
      {/* 🔥 KPI CARDS — SAME AS DASHBOARD */}
      <div className="grid sm:grid-cols-4 gap-4">
        <InfoCard
          label="Applied Leaves"
          value={stats.totalLeaves ?? 0}
          icon={<FiCalendar />}
        />
        <InfoCard
          label="Approved Leaves"
          value={stats.approvedLeaves ?? 0}
          icon={<FiCalendar />}
        />
        <InfoCard
          label="WFH Days"
          value={stats.wfhDays ?? 0}
          icon={<FiClock />}
        />
        <InfoCard
  label="Available Balance"
  value={emp.leaveBalance ?? 0}
  icon={<FiCalendar />}
/>
<InfoCard
  label="Available CompOff Leaves"
  value={emp.compOffBalance ?? 0}
  icon={<FiCalendar />}
/>
        <InfoCard
          label="Remaining Leaves"
          value={`${stats.remainingLeaves ?? 0} / ${stats.yearlyQuota}`}
          icon={<FiCalendar />}
        />

      </div>

      {/* 🔥 LEAVE HISTORY */}
      <ListContainer>
        {leaves
          .slice(0, limit)
          .map((l) => (
            <ListItem
              key={l.id}
              left={
                <div className="flex flex-col">
<span className="font-semibold">
  {getLeaveLabel(l.type)}
</span>
                  <span className="text-xs text-gray-500">
                    {new Date(l.startDate).toLocaleDateString()}{" "}
                    {l.endDate &&
                      `→ ${new Date(l.endDate).toLocaleDateString()}`}
                  </span>
                </div>
              }
              right={
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    l.status === "APPROVED"
                      ? "bg-green-200 text-green-800"
                      : l.status === "REJECTED"
                      ? "bg-red-200 text-red-800"
                      : "bg-yellow-200 text-yellow-800"
                  }`}
                >
                  {l.status}
                </span>
              }
            />
          ))}
      </ListContainer>

      {limit < leaves.length && (
        <LoadMoreButton onClick={() => setLimit(limit + 50)} />
      )}
    </Section>
  );
}

function PayrollSection({ emp, limit, setLimit }) {
  return (
    <Section title="Payroll History">
      <InfoCard label="Total Payroll Records" value={emp.payrolls.length} icon={<FiCreditCard />} />

      <ListContainer>
        {emp.payrolls
          .sort((a, b) => new Date(b.salaryMonth) - new Date(a.salaryMonth))
          .slice(0, limit)
          .map(p => (
            <ListItem
              key={p.id}
              left={new Date(p.salaryMonth).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              right={`₹${p.netSalary}`}
            />
          ))}
      </ListContainer>

      {limit < emp.payrolls.length && (
        <LoadMoreButton onClick={() => setLimit(limit + 50)} />
      )}
    </Section>
  );
}

/* -------------------------------- REUSABLES -------------------------------- */

function Section({ title, children }) {
  return (
    <div className="bg-white/70 dark:bg-gray-800/50 p-6 rounded-2xl shadow-xl backdrop-blur space-y-4">
      <h2 className="text-2xl font-bold">{title}</h2>
      {children}
    </div>
  );
}

function InfoCard({ label, value, icon }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-gray-700">
      <div className="text-xl">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function ListContainer({ children }) {
  return <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2">{children}</div>;
}

function ListItem({ left, right }) {
  return (
    <div className="flex justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm">
      <span>{left}</span>
      <span className="font-semibold">{right}</span>
    </div>
  );
}

function LoadMoreButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2 mt-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
    >
      Load More
    </button>
  );
}
