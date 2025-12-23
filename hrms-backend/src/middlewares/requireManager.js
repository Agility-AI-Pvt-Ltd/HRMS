import prisma from "../prismaClient.js";

export const requireManager = async (req, res, next) => {
  console.log("REQ USER:", req.user);

  // ✅ ADMIN always allowed
  if (req.user.role === "ADMIN") return next();

  // ✅ Manager = anyone who manages at least one department
  const isManager = await prisma.department.findFirst({
    where: {
      managers: {
        some: { id: req.user.id },
      },
    },
  });

  console.log("IS MANAGER RESULT:", isManager);

  if (!isManager) {
    return res.status(403).json({
      success: false,
      message: "Manager access required",
    });
  }

  // 🔥 IMPORTANT: attach flag for downstream usage
  req.isManager = true;
  next();
};
