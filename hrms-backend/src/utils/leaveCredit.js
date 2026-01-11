export const creditMonthlyLeaveIfNeeded = async (user, prisma) => {
  const MONTHLY_CREDIT = 1.75;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // 🔥 First time user
  if (!user.lastLeaveCredit) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        leaveBalance: MONTHLY_CREDIT,
        lastLeaveCredit: new Date(year, month, 1)
      }
    });
    return MONTHLY_CREDIT;
  }

  const last = new Date(user.lastLeaveCredit);

  // 🔴 NEW YEAR → RESET
  if (last.getFullYear() < year) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        leaveBalance: MONTHLY_CREDIT, // ❗ reset + Jan credit
        lastLeaveCredit: new Date(year, month, 1)
      }
    });
    return MONTHLY_CREDIT;
  }

  // 🟢 SAME YEAR → MONTH DIFF
  const diffMonths =
    (year - last.getFullYear()) * 12 +
    (month - last.getMonth());

  if (diffMonths <= 0) return 0;

  const credit = diffMonths * MONTHLY_CREDIT;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      leaveBalance: { increment: credit },
      lastLeaveCredit: new Date(year, month, 1)
    }
  });

  return credit;
};
