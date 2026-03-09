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
// Optional date range: { from, to } as YYYY-MM-DD strings to filter entries by month
export const getFacultiesByManagerId = async (managerId, { from, to } = {}) =>{
  try{
    const res=await api.post("/freelance/listFacultiesUnderManager",{
      managerId,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
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

// get stats for a single faculty (ADMIN or manager of that faculty)
// Optional date range: { from, to } as YYYY-MM-DD strings
export const getFacultyStats = async (facultyId, { from, to } = {}) => {
  try {
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    
    const queryString = params.toString();
    const url = `/freelance/faculty/${facultyId}/stats${queryString ? `?${queryString}` : ""}`;
    
    const res = await api.get(url);
    const data = res?.data;
    if (data?.success && data?.stats) return { stats: data.stats, error: null };
    return { stats: null, error: data?.message ?? "Failed to load stats." };
  } catch (err) {
    console.log("getFacultyStats:", err);
    return {
      stats: null,
      error: err?.response?.data?.message ?? err?.message ?? "Failed to load faculty stats.",
    };
  }
};

// get day entries for a faculty in date range (query: from, to as YYYY-MM-DD)
export const getFacultyEntriesInRange = async (facultyId, { from, to } = {}) => {
  try {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    const url = `/freelance/faculty/${facultyId}/entries${qs ? `?${qs}` : ""}`;
    const res = await api.get(url);
    const data = res?.data;
    if (data?.success && Array.isArray(data.entries)) return { entries: data.entries, error: null };
    return { entries: [], error: data?.message ?? "Failed to load entries." };
  } catch (err) {
    console.log("getFacultyEntriesInRange:", err);
    return {
      entries: [],
      error: err?.response?.data?.message ?? err?.message ?? "Failed to load entries.",
    };
  }
};

// ---------- Batches ----------
export const listBatches = async () => {
  try {
    const res = await api.get("/freelance/batches");
    const data = res?.data;
    if (data?.success && Array.isArray(data.batches)) return { batches: data.batches, error: null };
    return { batches: [], error: data?.message ?? "Failed to load batches." };
  } catch (err) {
    console.log("listBatches:", err);
    return {
      batches: [],
      error: err?.response?.data?.message ?? err?.message ?? "Failed to load batches.",
    };
  }
};

export const createBatch = async (payload) => {
  try {
    const res = await api.post("/freelance/batches", payload);
    const data = res?.data;
    if (data?.success && data?.batch) return { batch: data.batch, error: null };
    return { batch: null, error: data?.message ?? "Failed to create batch." };
  } catch (err) {
    console.log("createBatch:", err);
    return {
      batch: null,
      error: err?.response?.data?.message ?? err?.message ?? "Failed to create batch.",
    };
  }
};

// ---------- Subjects ----------
export const listSubjects = async () => {
  try {
    const res = await api.get("/freelance/subjects");
    const data = res?.data;
    if (data?.success && Array.isArray(data.subjects)) return { subjects: data.subjects, error: null };
    return { subjects: [], error: data?.message ?? "Failed to load subjects." };
  } catch (err) {
    console.log("listSubjects:", err);
    return {
      subjects: [],
      error: err?.response?.data?.message ?? err?.message ?? "Failed to load subjects.",
    };
  }
};

// Get subjects for a specific faculty (ensures subjects from faculty.subjects exist in Subject table)
export const getFacultySubjects = async (facultyId) => {
  try {
    const res = await api.get(`/freelance/faculty/${facultyId}/subjects`);
    const data = res?.data;
    if (data?.success && Array.isArray(data.subjects)) return { subjects: data.subjects, error: null };
    return { subjects: [], error: data?.message ?? "Failed to load faculty subjects." };
  } catch (err) {
    console.log("getFacultySubjects:", err);
    return {
      subjects: [],
      error: err?.response?.data?.message ?? err?.message ?? "Failed to load faculty subjects.",
    };
  }
};

// ---------- Day Entries ----------
export const upsertDayEntry = async (facultyId, payload) => {
  try {
    const res = await api.post(`/freelance/faculty/${facultyId}/entry`, payload);
    const data = res?.data;
    if (data?.success && data?.entry) return { entry: data.entry, error: null };
    return { entry: null, error: data?.message ?? "Failed to create/update entry." };
  } catch (err) {
    console.log("upsertDayEntry:", err);
    return {
      entry: null,
      error: err?.response?.data?.message ?? err?.message ?? "Failed to create/update entry.",
    };
  }
};

export const addClassesToDayEntry = async (dayEntryId, classes) => {
  try {
    const res = await api.post(`/freelance/day-entry/${dayEntryId}/classes`, { classes });
    const data = res?.data;
    if (data?.success && data?.classes) return { classes: data.classes, error: null };
    return { classes: null, error: data?.message ?? "Failed to add classes." };
  } catch (err) {
    console.log("addClassesToDayEntry:", err);
    return {
      classes: null,
      error: err?.response?.data?.message ?? err?.message ?? "Failed to add classes.",
    };
  }
};

// Update a class within a day entry
export const updateClass = async (classId, payload) => {
  try {
    const res = await api.patch(`/freelance/classes/${classId}`, payload);
    const data = res?.data;
    if (data?.success && data?.class) return { class: data.class, error: null };
    return { class: null, error: data?.message ?? "Failed to update class." };
  } catch (err) {
    console.log("updateClass:", err);
    return {
      class: null,
      error: err?.response?.data?.message ?? err?.message ?? "Failed to update class.",
    };
  }
};

// Delete a class from a day entry
export const deleteClass = async (classId) => {
  try {
    const res = await api.delete(`/freelance/classes/${classId}`);
    const data = res?.data;
    if (data?.success) return { success: true, error: null };
    return { success: false, error: data?.message ?? "Failed to delete class." };
  } catch (err) {
    console.log("deleteClass:", err);
    return {
      success: false,
      error: err?.response?.data?.message ?? err?.message ?? "Failed to delete class.",
    };
  }
};

// ---------------- Youtube Lectures ------------------
export const addYoutubeLecture=async({ facultyId, date, youtubeUrl, title, description })=>{
  try{
    const res=await api.post(`/freelance/freelance-faculty/${facultyId}/youtube-lectures`,{ date, youtubeUrl, title, description });
    return {data:res.data,error:null};
  }catch(error){
    return {
      data:null,
      error
    }
  }
}

export const getYoutubeLecturesForFaculty=async (facultyId, { from, to } = {})=>{
  try{
    const res=await api.get( `/freelance/freelance-faculty/${facultyId}/youtube-lectures`,
      { params: { from, to } } );
    return {
      data:res.data,
      error:null
    }
  }catch(error){
    return {data:null,error}
  }
}


// --------------------Delete Faculty Day Entry--------------------
export const deleteDayEntry = async (facultyId, dayEntryId) => {
  try {
    const res = await api.delete(`/freelance/faculty/${facultyId}/entry/${dayEntryId}`);
    const data = res?.data;
    if (data?.success) return { success: true, error: null };
    return { success: false, error: data?.message ?? "Failed to delete entry." };
  } catch (err) {
    console.log("deleteDayEntry:", err);
    return {
      success: false,
      error: err?.response?.data?.message ?? err?.message ?? "Failed to delete entry.",
    };
  }
};