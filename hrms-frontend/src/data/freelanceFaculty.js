import api from "../api/axios.js";

// to get all the freelance faculty managers 
export async function getFreelanceManagers(){
  try{
    const res=await api.get("/freelance/listFacultyMangers");
    const data=res?.data;
    if(data?.success && Array.isArray(data.managers)){
      return {managers:data.managers,error:null};
    }
    return {managers:[],error:null};
  }catch(err){    
    console.log("Failed getFreelanceManager:",err);
    return {managers:[],error:err?.message ?? "Failed to load managers."};
  }
}

// to get all the freelance faculties under a faculty managaer 
export const getFacultiesByManagerId = async (managerId) =>{
  try{
    const res=await api.post("/freelance/listFacultiesUnderManager",{managerId});
    const data=res?.data;
    if(data?.success && Array.isArray(data.faculties)){
      return {data:data.faculties,error:null};
    }
    return {data:[],error:null};
  }catch(err){
    console.log("getFacultiesByManagerId:",err.message);
    return {data:[],error:err?.message ?? "Failed to load faculties."}
  }
}

// to create new freelance faculty manager
export const createNewFacultyManager=async (employeeId)=>{
  try{
    const res=await api.post("/freelance/create",{employeeId});
    const data=res?.data;
    if(data.success){
      alert("Faculty manager created successfully.");
      return {error:null};
    }
    return {error:null};
  }catch(err){
    console.log("Failed creating new faculty manager (frontend)",err);
    return {error:err?.message ?? "Failed to create faculty manager."}
  }
}

// ==========assign new faculties to a faculty manager============================
export const assignFreelanceFacultyToManager = async (payload) => {
  try {
    // Backend expects managerId, name, subjects, preferredDaysOfWeek at the root level
    const res = await api.post("/freelance/assign", payload);
    return { data: res.data, error: null };
  } catch (err) {
    console.log("assignFreelanceFacultyToManager:", err);
    return {
      data: null,
      error:
        err?.response?.data?.message ??
        err?.message ??
        "Failed to assign freelance faculty.",
    };
  }
};

// ============update faculty status=========================================
export const updateFacultyStatus=async ({facultyId,status})=>{
  try{
    const res=await api.post("/freelance/updateStatus",{facultyId,status});
    if(res.success){
      alert("Faculty status updated.");
    }
    return {error:null};
  }catch(error){
    console.log("Failed updateFacultyStatus:",error);
    return {
      error:error?.message ?? "Status update failed."
    }
  }
}

// ================change faculty manager====================================
export const changeFacultyManager=async ({facultyId,newManagerId})=>{
  try{
    const res=await api.post("/freelance/updateManager",{facultyId,newManagerId});
    const data=res?.data;
    if(data.success){
      return {
        message:"Manager changed.",
        error:null
      }
    }
    return {
      message: data?.message ?? "Failed to change manager.",
      error: null,
    };
  }catch(error){
    console.log(error?.message ?? "Something went wrong while updating manager.");
    return {
      message: null,
      error:error
    }
  }
}

// list faculties for manager lyf_employee only
export const listFacultiesForManager=async (managerId)=>{
  try{
    const res=await api.post("/freelance/managerFaculties",{managerId});
    const data=res?.data;
    if(data.success){
      return {
        faculties:data.faculties,
        error:null
      }
    }
    return {
      error:null
    }
  }catch(err){
    console.log(err);
    return {error:err};
  }
}