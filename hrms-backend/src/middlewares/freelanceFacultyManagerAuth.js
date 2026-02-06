import prisma from "../prismaClient";

export const requireFreelanceFacultyManager=async (req,res,next)=>{
    try{
        if(req.user.role === "ADMIN") return next();

        const managerRecord=await prisma.freelanceFacultyManager.findUnique({
            where:{
                employeeId:req.user.id
            }
        });

        if(!managerRecord){
            return res.status(403).json({
                success:false,
                message:"Freelance faculty manager access required."
            })
        }

        next();
    }catch(err){
        console.log("requireFreelanceFacultyManager Error:",err);
        return res.status(500).json({
            success:false,
            message:"Freelance faculty manager authorization failed !"
        })
    }
}