import { useEffect, useState } from "react";
import {Navigate} from "react-router-dom";
// import {AuthContext } from '../contexts/AuthContext';
import { fetchIsFreelanceManager } from "../api/freelanceFaculty";
import useAuthStore from "../stores/authstore";


const FreelanceFAcultyManagerRoute = ({children}) => {
    const user=useAuthStore((s)=>s.user);
    const [checking, setChecking] = useState(true);
    const [isManager, setIsManager] = useState(false);
    const [error, setError] = useState(null);  
    const isLyfEmployee = user?.role ===  "LYF_EMPLOYEE";

    useEffect(() => {
        if (!user || !isLyfEmployee) {
          setChecking(false);
          setIsManager(false);
          return;
        }
    
        let cancelled = false;
        setChecking(true);
    
        fetchIsFreelanceManager()
          .then((res) => {
            if (!cancelled) {
              setIsManager(res);
              setChecking(false);
            }
          })
          .catch((err) => {
            if (!cancelled) {
              setError(err);
              setChecking(false);
            }
          });
    
        return () => {
          cancelled = true;
        };
      }, [user, isLyfEmployee]);
  
  
      if ( checking) {
        return <div>Loading...</div>; // your spinner
      }
    
      // Optional: show error page
      if (error) {
        return <Navigate to="/error" replace />;
      }
    
      const allowed = isLyfEmployee && isManager;
    
      return allowed ? children : <Navigate to="/unauthorized" replace />;
}    

export default FreelanceFAcultyManagerRoute;