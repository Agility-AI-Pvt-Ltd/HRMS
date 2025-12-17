import React from "react";
import useAuthStore from "../stores/authstore";

import LeavesEmployee from "./LeavesEmployee.jsx";
import LeavesAdmin from "./LeavesAdmin.jsx";

export default function Reimbursement() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  return user.role === "ADMIN"
    ? <LeavesAdmin />
    : <LeavesEmployee />;
}
