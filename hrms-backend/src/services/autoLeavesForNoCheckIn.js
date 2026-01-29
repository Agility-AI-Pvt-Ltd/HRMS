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

const startOfDay = (dateISO) => {
  const d = new Date(dateISO);
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfDay = (dateISO) => {
  const d = new Date(dateISO);
  d.setHours(23, 59, 59, 999);
  return d;
};

export async function markAutoLeavesForDate(dateISO) {
  const dateStart = startOfDay(dateISO);
  const dateEnd = endOfDay(dateISO);

  console.log("start date:", dateStart);
  console.log("end date:", dateEnd);

  //  All active, non-admin users
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { not: "ADMIN" },
    },
    select: { id: true },
  });

  console.log(`[AUTO-LEAVE] Running for ${dateISO}, users: ${users.length}`);

  for (const user of users) {
    //  Skip if holiday (match by whole day range, not exact timestamp)
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
    });
    if (holiday) continue;

    // Skip if weekly off for this user (fixed or roster)
    const dayName = new Date(dateStart).toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "Asia/Kolkata",
    });

    const weeklyOff = await prisma.weeklyOff.findFirst({
      where: {
        userId: user.id,
        OR: [
          {
            // Fixed weekly off, e.g. every Sunday
            isFixed: true,
            offDay: dayName,
          },
          {
            // Roster / one-time off on a specific date
            isFixed: false,
            offDate: {
              gte: dateStart,
              lte: dateEnd,
            },
          },
        ],
      },
    });

    if (weeklyOff) continue;

    // Skip if already has APPROVED leave that covers this date
    const existingLeave = await prisma.leave.findFirst({
      where: {
        userId: user.id,
        status: "APPROVED",
        startDate: { lte: dateStart },
        endDate: { gte: dateEnd },
        isAdminDeleted: false,
        isEmployeeDeleted: false,
      },
    });
    if (existingLeave) continue;

    // Skip if there is any attendance row for this date
    const attendance = await prisma.attendance.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
    });
    if (attendance) continue;

    // UNPAID leave for that date
    await prisma.leave.create({
      data: {
        userId: user.id,
        type: "UNPAID",
        startDate: dateStart,
        endDate: dateEnd,
        status: "APPROVED",
        reason: "Auto-marked: no attendance recorded for this day",
      },
    });

    console.log(
      `[AUTO-LEAVE] UNPAID leave created for user=${user.id} on ${dateISO}`,
    );
  }

  console.log(`[AUTO-LEAVE] Completed for ${dateISO}`);
}

cron.schedule(
  "5 19 * * *",
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
