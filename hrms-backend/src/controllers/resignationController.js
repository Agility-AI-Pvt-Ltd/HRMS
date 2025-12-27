import prisma from "../prismaClient.js";
import { sendRequestNotificationMail, sendResignationStatusMail } from "../utils/sendMail.js"; // <-- IMPORTANT
import { getAdminAndManagers } from "../utils/getApprovers.js";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";

/* =====================================================
   🔹 HELPERS
===================================================== */

const validateOwner = async (id, userId) => {
  const record = await prisma.resignation.findFirst({ where: { id, userId } });
  if (!record) throw new Error("Unauthorized access");
  return record;
};

const validateManagerResignationAccess = async (resignationId, managerId) => {
  const record = await prisma.resignation.findFirst({
    where: {
      id: resignationId,
      user: { departments: { some: { department: { managers: { some: { id: managerId } } } } } }
    }
  });
  if (!record) throw new Error("No access to this resignation request");
  return record;
};

const updateStatus = async ({ id, status, reason = null }) => {
  return prisma.resignation.update({
    where: { id },
    data: { status, rejectReason: status === "REJECTED" ? reason || "" : null },
    include: { user: true }
  });
};

/* =====================================================
   👤 EMPLOYEE — APPLY RESIGNATION
===================================================== */

export const applyResignation = async (req, res) => {
  try {
    const { lastWorking, reasonType, reason, noticePeriod, handoverDetail, declaration } = req.body;

    if (!lastWorking || !declaration)
      return res.status(400).json({ success: false, message: "Last working & declaration required" });

    const resignation = await prisma.resignation.create({
      data: {
        userId: req.user.id,
        lastWorking: new Date(lastWorking),
        reasonType,
        reason,
        noticePeriod: noticePeriod ? Number(noticePeriod) : null,
        handoverDetail,
        declaration,
      }
    });

    /* -------- MAIL TO Manager + Admin -------- */
    try {
      const approverEmails = await getAdminAndManagers(req.user.id);

      if (approverEmails.length > 0) {
        await sendRequestNotificationMail({
          to: approverEmails,
          subject: "New Resignation Submitted",
          title: "Resignation Request",
          employeeName: `${req.user.firstName} ${req.user.lastName}`,
          details: [
            `Last Working: ${new Date(lastWorking).toDateString()}`,
            reasonType && `Reason Type: ${reasonType}`,
            reason && `Reason: ${reason}`,
            noticePeriod && `Notice Period: ${noticePeriod} days`,
          ].filter(Boolean),
        });
      }
    } catch (err) { console.log("Mail error:", err.message); }

    res.json({ success: true, message: "Resignation submitted", resignation });

  } catch (e) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/* =====================================================
   👤 EMPLOYEE — LIST
===================================================== */

export const myResignations = async (req, res) => {
  try {
    const list = await prisma.resignation.findMany({
      where: { userId: req.user.id, isEmployeeDeleted: false },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, list });

  } catch (e) {
    res.status(500).json({ success: false, message: "Failed" });
  }
};

/* =====================================================
   👤 EMPLOYEE — SOFT DELETE
===================================================== */

export const employeeDeleteResignation = async (req, res) => {
  try {
    await validateOwner(req.params.id, req.user.id);

    await prisma.resignation.update({
      where: { id: req.params.id },
      data: { isEmployeeDeleted: true }
    });

    res.json({ success: true, message: "Removed successfully" });

  } catch (e) {
    res.status(403).json({ success: false, message: e.message });
  }
};

/* =====================================================
   👑 MANAGER — VIEW DEPARTMENT REQUESTS
===================================================== */

export const getManagerResignations = async (req, res) => {
  try {
    const list = await prisma.resignation.findMany({
      where: {
        user: {
          departments: { some: { department: { managers: { some: { id: req.user.id } } } } }
        }
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, position: true } }},
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, list });

  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =====================================================
   👑 ADMIN — ALL LIST
===================================================== */

export const getAllResignations = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ success: false, message: "Admin only" });

    const list = await prisma.resignation.findMany({
      where: { isAdminDeleted: false },
      include: { user: true },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, list });

  } catch (e) {
    res.status(500).json({ success: false, message: "Failed" });
  }
};

/* =====================================================
   APPROVE / REJECT
===================================================== */

export const updateResignationStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const id = req.params.id;

    if (!["APPROVED","REJECTED"].includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });

    const record = await prisma.resignation.findUnique({ where: { id }, select: { userId:true }});
    if (!record) return res.status(404).json({ success:false,message:"Not found" });

    if (record.userId === req.user.id)
      return res.status(403).json({ success:false,message:"Self approval not allowed" });

    if (req.user.role !== "ADMIN")
      await validateManagerResignationAccess(id, req.user.id);

    const resignation = await updateStatus({ id, status, reason });

    /* ------ MAIL TO EMPLOYEE ON STATUS CHANGE ------ */
    try {
      await sendResignationStatusMail({
        to: resignation.user.email,
        employeeName: `${resignation.user.firstName} ${resignation.user.lastName}`,
        status,
        reason
      });
    } catch(err) { console.log("Mail Fail:", err.message) }

    res.json({ success:true,message:`Resignation ${status}`,resignation });

  } catch (e) {
    res.status(403).json({ success:false,message:e.message });
  }
};

/* =====================================================
   👑 ADMIN — SOFT DELETE
===================================================== */

export const adminDeleteResignation = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ success:false,message:"Admin only" });

    await prisma.resignation.update({
      where:{id:req.params.id},
      data:{isAdminDeleted:true}
    });

    res.json({success:true,message:"Removed successfully"});

  } catch(e){
    res.status(500).json({success:false,message:"Failed"});
  }
};

/* =====================================================
   EXPORT CSV/EXCEL
===================================================== */

export const exportResignations = async (req,res)=>{
  try{
    const user=req.user;
    let {start,end,userId,departmentId,format}=req.query;
    if(!format) format="csv";

    const where={isAdminDeleted:false};

    if(user.role!=="ADMIN") where.userId=user.id;
    else if(userId) where.userId=userId;

    if(start&&end) where.createdAt={gte:new Date(start),lte:new Date(end)};
    if(departmentId) where.user={departments:{some:{departmentId}}};

    const rows=await prisma.resignation.findMany({
      where,include:{user:true},orderBy:{createdAt:"desc"}
    });

    // CSV
    if(format==="csv"){
      const parser=new Parser({fields:["employee","lastWorking","reasonType","reason","noticePeriod","status","createdAt"]});
      const csv=parser.parse(rows.map(r=>({
        employee:`${r.user.firstName} ${r.user.lastName}`,
        lastWorking:r.lastWorking.toISOString().split("T")[0],
        reasonType:r.reasonType,
        reason:r.reason||"",
        noticePeriod:r.noticePeriod||"",
        status:r.status,
        createdAt:r.createdAt.toISOString().split("T")[0]
      })));
      res.header("Content-Type","text/csv");
      res.attachment("resignations.csv");
      return res.send(csv);
    }

    // Excel
    const workbook=new ExcelJS.Workbook();
    const sheet=workbook.addWorksheet("Resignations");
    sheet.columns=[
      {header:"Employee",key:"employee",width:25},
      {header:"Last Working",key:"lw",width:15},
      {header:"Reason Type",key:"rtype",width:20},
      {header:"Reason",key:"reason",width:35},
      {header:"Notice",key:"np",width:12},
      {header:"Status",key:"status",width:15},
      {header:"Date",key:"date",width:15}
    ];

    rows.forEach(r=>{
      sheet.addRow({
        employee:`${r.user.firstName} ${r.user.lastName}`,
        lw:r.lastWorking.toISOString().split("T")[0],
        rtype:r.reasonType,
        reason:r.reason||"-",
        np:r.noticePeriod||"-",
        status:r.status,
        date:r.createdAt.toISOString().split("T")[0]
      });
    });

    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition","attachment; filename=resignations.xlsx");
    await workbook.xlsx.write(res);
    res.end();

  }catch(err){
    res.status(500).json({success:false,message:"Export failed"});
  }
};
