import prisma from "../prismaClient.js";

/* =====================================================
   CHECK: USER IS MANAGER OR NOT
===================================================== */
export const isManager = async (userId) => {
  const count = await prisma.department.count({
    where: {
      managers: {
        some: { id: userId }
      }
    }
  });

  return count > 0;
};
export const isDepartmentManager = async (userId) => {
  const count = await prisma.department.count({
    where: {
      managers: {
        some: { id: userId }
      }
    }
  });

  return count > 0;
};

/* =====================================================
   CHECK: MANAGER → EMPLOYEE SAME DEPARTMENT
===================================================== */
export const isManagerOfEmployee = async (managerId, employeeId) => {
  const dept = await prisma.department.findFirst({
    where: {
      managers: {
        some: { id: managerId }
      },
      members: {
        some: { userId: employeeId }
      }
    }
  });

  return !!dept;
};
