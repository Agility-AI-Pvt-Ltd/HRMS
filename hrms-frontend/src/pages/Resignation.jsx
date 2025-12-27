import React from "react";
import useAuthStore from "../stores/authstore";

import ResignationEmployee from "./ResignationEmployee";
import ResignationAdmin from "./ResignationAdmin";

export default function Resignation() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  // ADMIN OR MANAGER = Admin Panel  || user?.managedDepartments?.length > 0
  if (user.role === "ADMIN" ) {

    return <ResignationAdmin />;
  }

  // Otherwise -> employee view
  return <ResignationEmployee />;
}
