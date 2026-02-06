import api from "./axios"

export async function fetchIsFreelanceManager(){
    const res=await api.get("/freelance/facultyManager/me");
    return res.data.isFreelanceFacultyManager;
}