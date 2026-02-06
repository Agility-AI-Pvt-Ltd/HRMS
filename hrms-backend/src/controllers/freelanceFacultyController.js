import prisma from "../prismaClient.js"

const VALID_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// ===================== create an employee a freelance faculty manager================
// =============ADMIN ONLY==================================
export const createFreelanceFacultyManager=async (req,res)=>{
    try{
        const { employeeId } = req.body;
        console.log(employeeId);
        if (!employeeId) {
          return res.status(400).json({
            success: false,
            message: "Employee ID is required"
          });
        }
    
        // Check if employee exists and is active
        const employee = await prisma.user.findUnique({
          where: { id: employeeId }
        });
    
        if (!employee) {
          return res.status(404).json({
            success: false,
            message: "Employee not found"
          });
        }

        if (!employee.isActive) {
            return res.status(400).json({
              success: false,
              message: "Employee account is inactive"
            });
          }
      
          //  Does FreelanceFacultyManager record already exist?
          const existingManager = await prisma.freelanceFacultyManager.findUnique({
            where: { employeeId }
          });
      
          if (existingManager) {
            return res.status(400).json({
              success: false,
              message: "Employee is already a freelance faculty manager"
            });
          }

          
    //  Just create FreelanceFacultyManager record (NO role change)
    const managerRecord = await prisma.freelanceFacultyManager.create({
        data: { employeeId },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          },
          faculties: {
            select: { id: true }
          }
        }
      });

      return res.status(201).json({
        success: true,
        message: "Freelance faculty manager created successfully",
        manager: {
          id: managerRecord.employee.id,
          firstName: managerRecord.employee.firstName,
          lastName: managerRecord.employee.lastName,
          email: managerRecord.employee.email,
          role: managerRecord.employee.role, // Still AGILITY_EMPLOYEE or LYF_EMPLOYEE
          isFreelanceFacultyManager: true,
          facultiesCount: managerRecord.faculties.length
        }
      });

    }catch(error){
        console.log("Something went wrong while creating faculty manager:",error);
        return res.status(500).json({
          success:false,
          message:"Something went wrong while creating faculty manager!"
        })
    }
}

// ========get list of faculty managers======================
// =============ADMIN ONLY==================================

export const listFacultyManagers=async (req,res)=>{
  try{
    const managerRecords=await prisma.freelanceFacultyManager.findMany({
      include:{
        employee:{
          select:{
            id:true,
            firstName:true,
            lastName:true,
            email:true,
            role:true,
            isActive:true
          }
        },
        faculties:{
          select:{
            id:true  //select id's of the faculties under this manager
          }
        }
      },
      orderBy:{
        createdAt:"desc"
      }
    });

    // formatting response
    const managers=managerRecords.map((record)=>({
      id:record.employee.id,
      firstName:record.employee.firstName,
      lastName:record.employee.lastName,
      email:record.employee.email,
      role:record.employee.role,
      status:(record.employee.isActive ? "ACTIVE":"INACTIVE"),
      isFreelanceFacultyManager:true,
      facultiesCount:record.faculties.length
    }))

    return res.status(200).json({
      success:true,
      managers
    })

  }catch(err){
    console.log("something went wrong while fetching freelance faculty managers list:",err);
    return res.status(500).json({
      success:false,
      message:"Failed to load freelance faculty managers!"
    })
  }
}

//=====================assign freelance faculty to a faculty manager===================
// =================ADMIN ONLY======================

export const assignFreelanceFaculty=async (req,res)=>{
  try{
      const {managerId,name,subjects,preferredDaysOfWeek}=req.body;

      // Validation: Required fields
    if (!managerId || !name || !subjects || !preferredDaysOfWeek) {
      return res.status(400).json({
        success: false,
        message: "Manager ID, name, subjects, and preferred days are required"
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Faculty name must be at least 2 characters"
      });
    }

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one subject is required"
      });
    }

    if (!Array.isArray(preferredDaysOfWeek) || preferredDaysOfWeek.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one preferred day is required"
      });
    }

    const invalidDays=preferredDaysOfWeek.filter(day=>!VALID_DAYS.includes(day));
    
    if(invalidDays.length > 0){
      return res.status(400).json({
        success: false,
        message: `Invalid days: ${invalidDays.join(", ")}. Valid days are: ${VALID_DAYS.join(", ")}`
      });
    }

    //check whether manager have a freelanceFacultyManager record or not
    const managerRecord=await prisma.freelanceFacultyManager.findUnique({
      where:{
        employeeId:managerId
      },
      include:{
        employee:{
          select:{
            id:true,
            firstName:true,
            lastName:true,
            email:true,
            isActive:true
          }
        }
      }
    })

    if(!managerRecord){
      return res.status(400).json({
        success: false,
        message: "Selected employee is not a freelance faculty manager"
      });
    }

    if(!managerRecord.employee.isActive){
      return res.status(400).json({
        success: false,
        message: "Manager account is inactive"
      });
    }

    const faculty=await prisma.freelanceFaculty.create({
      data:{
        managerId,
        freelanceFacultyManagerId:managerRecord.id,
        name:trimmedName,
        subjects:subjects.map(s=>s.trim()),
        preferredDaysOfWeek:[...new Set(preferredDaysOfWeek)],
        status:"ACTIVE"
      },
      include:{
        manager:{
          select:{
            id:true,
            firstName:true,
            lastName:true,
            email:true
          }
        }
      }
    })

    return res.status(201).json({
      success: true,
      message: "Freelance faculty created successfully",
      faculty
    });

  }catch(err){
    console.log("something went wrong while assigning the faculty:",err);
    return res.status(500).json({
      success:false,
      message:"Failed to assign freelance faculty!"
    })
  }
}

// =============ADMIN ONLY==================================
// ==============make freelance faculty inactive==================================
export const updateFreelanceFacultyStatus=async (req,res)=>{
  try{
    const {facultyId,status} = req.body;

    console.log(facultyId,status);
    if(!facultyId || !status){
      return res.status(400).json({
        success:false,
        message:"FacultyId and status are required."
      });
    }

    const allowedStatuses=["ACTIVE","INACTIVE"];
    if(!allowedStatuses.includes(status)){
      return res.status(400).json({
        success:false,
        message:"Invalid status provided."
      })
    }

    const existingFaculty=await prisma.freelanceFaculty.findUnique({
      where:{id:facultyId}
    });

    if(!existingFaculty){
      return res.status(400).json({
        success:false,
        message:"Faculty not found!"
      });
    }

    const updateFacultyStatus=await prisma.freelanceFaculty.update({
      where:{id:facultyId},
      data:{status},
    })

    return res.status(200).json({
      success:true,
      message:"Faculty status updated successfully."
    })
  }catch(err){
    console.log("removeFreelanceFaculty error:",err);
    return res.status(500).json({
      message:"Something went wrong while removing faculty!",
      error:err
    })
  }
}

// =============ADMIN ONLY==================================
// ================change faculty manager====================================
export const changeFacultyManager=async (req,res)=>{
  try{
    const {facultyId,newManagerId}=req.body;

    if (!facultyId || !newManagerId) {
      return res.status(400).json({
        success:false,
        message:"facultyId and newManagerId are required."
      });
    }

    const existingFaculty=await prisma.freelanceFaculty.findUnique({
      where:{id:facultyId},
      select:{
        id:true,
        managerId:true,
        freelanceFacultyManagerId:true,
      }      
    })

    if(!existingFaculty){
      return res.status(404).json({
        success:false,
        message:"No faculty found with this ID."
      })
    }

    if(existingFaculty.managerId === newManagerId){
      return res.status(400).json({
        success:false,
        message:"New managerId is same as current managerId."
      })
    }

    // New manager must have a FreelanceFacultyManager record
    const newManagerRecord = await prisma.freelanceFacultyManager.findUnique({
      where: {
        employeeId: newManagerId
      },
      include: {
        employee: {
          select: {
            isActive: true
          }
        }
      }
    });

    if (!newManagerRecord) {
      return res.status(400).json({
        success:false,
        message:"Selected employee is not a freelance faculty manager."
      });
    }

    if (!newManagerRecord.employee.isActive) {
      return res.status(400).json({
        success:false,
        message:"New manager account is inactive."
      });
    }

    const updatedFaculty=await prisma.freelanceFaculty.update({
      where:{id:facultyId},
      data:{
        managerId:newManagerId,
        // keep relation in sync with the manager's FreelanceFacultyManager record
        freelanceFacultyManagerId:newManagerRecord.id
      }
    })

    return res.status(200).json({
      success:true,
      data:updatedFaculty,
      message:"Manager changed successfully."
    })

  }catch(err){
    console.log(err);
    return res.status(500).json({
      success:false,
      message:"Something went wrong while switching manager. Please try again later!"
    })
  }
}



// ===================================MANAGER ONLY ENDPOINTS ================================
export const checkFreelanceFacultyManager=async (req,res)=>{
  try{
    const userId=req.user.id;

    const record = await prisma.freelanceFacultyManager.findUnique({
      where: { employeeId:userId },
    });

    const isFreelanceFacultyManager = !!record;

    return res.json({ isFreelanceFacultyManager });
  }catch(err){
    console.log(err);
    return res.status(500).json({
      message:err?.message ?? "Something went wrong while checking user a manager or not!"
    })
  }
}

// ============list freelance faculties under a manager=========================
export const listFreelanceFaculties=async (req,res)=>{
  try{
    const {managerId}=req.body;

    if(!managerId){
      return res.status(400).json({
        message:"Manager ID is required"
      })
    }

    const faculties=await prisma.freelanceFaculty.findMany({
      where:{managerId:managerId},
      include:{
        manager:{
          select:{
            id:true,
            firstName:true,
            lastName:true,
            email:true
          }
        },
        dayEntries:{
          select:{
            id:true,
            date:true,
            classesCount:true,
            totalHours:true
          },
          orderBy:{
            date:"desc"
          },
          take:10
        },
        _count:{
          select:{
            dayEntries:true
          }
        }
      },
      orderBy:{
        createdAt:"desc"
      }
    });



    const facultyStats=faculties.map((faculty)=>{
      const totalClasses=faculty.dayEntries.reduce((sum,entry)=>sum+entry.classesCount,0) || 0;
      const totalHours=faculty.dayEntries.reduce((sum,entry)=>sum+entry.totalHours,0) || 0;

      return{
        id:faculty.id,
        name:faculty.name,
        subjects: faculty.subjects,
        preferredDaysOfWeek: faculty.preferredDaysOfWeek,
        status: faculty.status,
        manager: faculty.manager,
        totalEntries: faculty._count.dayEntries,
        totalClasses,
        totalHours,
        createdAt: faculty.createdAt,
        updatedAt: faculty.updatedAt
      };
    });

    return res.status(200).json({
      success:true,
      faculties:facultyStats
    })
  }catch(err){
    console.log("Something went wrong while fetching all the faculties list:",err);
    return res.status(500).json({
      success:false,
      message:"Failed to load freelance faculties"
    })
  }
}




