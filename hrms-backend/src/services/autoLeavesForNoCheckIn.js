import cron from "node-cron";
import prisma from "../prismaClient.js";

const toLocalISO = (date) => {
  const d = new Date(
    new Date(date).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

const toDateOnly = (dateISO) => {
  const d = new Date(dateISO);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export async function markAutoLeavesForDate(dateISO) {
  const dateOnly = toDateOnly(dateISO);

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { not: "ADMIN" },
    },
    select: { id: true },
  });

  console.log(`[AUTO-LEAVE] Running for ${dateISO}, users: ${users.length}`);

  const userIds = users.map((u) => u.id);

  // ✅ FETCH ALL DATA IN PARALLEL
  const [holidays, weeklyOffs, existingLeaves, earnedCompOffs, attendances] =
    await Promise.all([
      // 1️⃣ Check for holidays
      prisma.holiday.findMany({
        where: { date: dateOnly },
        select: { id: true },
      }),

      // 2️⃣ Get weekly offs for this date
      prisma.weeklyOff.findMany({
        where: {
          userId: { in: userIds },
          OR: [
            {
              isFixed: true,
              offDay: new Date(dateOnly).toLocaleDateString("en-US", {
                weekday: "long",
                timeZone: "Asia/Kolkata",
              }),
            },
            {
              isFixed: false,
              offDate: dateOnly,
            },
          ],
        },
        select: { userId: true },
      }),

      // 3️⃣ Get ALL approved leaves covering this date
      // ✅ INCLUDING COMP_OFF, WFH, UNPAID - sab types
      prisma.leave.findMany({
        where: {
          userId: { in: userIds },
          status: "APPROVED",
          startDate: { lte: dateOnly },
          endDate: { gte: dateOnly },
          isAdminDeleted: false,
          isEmployeeDeleted: false,
        },
        select: { userId: true, type: true },
      }),

      // 4️⃣ Get earned COMP_OFF from CompOff table (weekend work)
      prisma.compOff.findMany({
        where: {
          userId: { in: userIds },
          status: "APPROVED",
          workDate: dateOnly,
        },
        select: { userId: true },
      }),

      // 5️⃣ Get attendance records for this date
      prisma.attendance.findMany({
        where: {
          userId: { in: userIds },
          date: dateOnly,
        },
        select: { userId: true },
      }),
    ]);

  // ✅ CREATE LOOKUP SETS
  const holidayExists = holidays.length > 0;
  const weeklyOffUserIds = new Set(weeklyOffs.map((w) => w.userId));
  const leavedUserIds = new Set(existingLeaves.map((l) => l.userId)); // ✅ Includes COMP_OFF, WFH, etc
  const earnedCompOffUserIds = new Set(earnedCompOffs.map((c) => c.userId));
  const attendanceUserIds = new Set(attendances.map((a) => a.userId));

  // ✅ FILTER ELIGIBLE USERS
  const eligibleUserIds = userIds.filter(
    (userId) =>
      !holidayExists &&
      !weeklyOffUserIds.has(userId) &&
      !leavedUserIds.has(userId) && // ✅ Covers COMP_OFF leaves too
      !earnedCompOffUserIds.has(userId) &&
      !attendanceUserIds.has(userId)
  );

  console.log(`[AUTO-LEAVE] Eligible users for UNPAID leave: ${eligibleUserIds.length}`);

  if (eligibleUserIds.length === 0) {
    console.log(`[AUTO-LEAVE] Completed for ${dateISO} - No eligible users`);
    return;
  }

  // ✅ BATCH CREATE
  const leaveData = eligibleUserIds.map((userId) => ({
    userId,
    type: "UNPAID",
    startDate: dateOnly,
    endDate: dateOnly,
    status: "APPROVED",
    reason: "Auto-marked: no attendance recorded for this day",
  }));

  await prisma.leave.createMany({
    data: leaveData,
  });

  console.log(
    `[AUTO-LEAVE] Created ${eligibleUserIds.length} UNPAID leaves for ${dateISO}`
  );
  console.log(`[AUTO-LEAVE] Completed for ${dateISO}`);
}

cron.schedule(
  "21 17 * * *",
  async () => {
    console.log("[AUTO-LEAVE] Cron triggered at", new Date().toISOString());
    const now = new Date();
    const todayISO = toLocalISO(now);
    await markAutoLeavesForDate(todayISO);
  },
  {
    timezone: "Asia/Kolkata",
  },
);