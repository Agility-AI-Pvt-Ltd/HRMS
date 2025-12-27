import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { FiEdit, FiTrash2, FiPlus, FiEye, FiEyeOff } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

/* =======================================================
      EMPLOYEES PAGE
======================================================= */
export default function Employees() {
  const [users, setUsers] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const navigate = useNavigate();

  // Global message
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");

  // Confirm delete modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // Form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);

  // Error
  const [errorMsg, setErrorMsg] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);      // for create/update
  const [deleteLoadingId, setDeleteLoadingId] = useState(null); // unique delete row wait

  // Form
  const emptyForm = {
    firstName: "",
    lastName: "",
    email: "",
    role: "AGILITY_EMPLOYEE",
    departmentId: "",
    departmentIds: [],
    password: "",
  };
  const [form, setForm] = useState(emptyForm);

  /* Auto-hide message */
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2000);
    return () => clearTimeout(t);
  }, [msg]);

  /* Load everything */
  const load = async () => {
    try {
      setLoading(true);

      const meRes = await api.get("/users/me");
      const usersRes = await api.get("/users");
      const deptRes = await api.get("/departments");

      setMe(meRes.data.user);
      setUsers(usersRes.data.users || []);
      setDepartments(deptRes.data.departments || []);
    } catch (err) {
      console.log(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  /* Create/Edit */
  const openCreate = () => {
    setEditUser(null);
    setForm(emptyForm);
    setErrorMsg("");
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      departmentId: u.departmentId || "",
      departmentIds: u.departments?.map(d => d.department.id) || [],
      password: "",
    });
    setErrorMsg("");
    setModalOpen(true);
  };

  /* Save user */
const submit = async (e) => {
  e.preventDefault();
  setErrorMsg("");
  setSaveLoading(true);     // 🔥 start loader

  try {
    await api[editUser ? "put" : "post"](
      editUser ? `/users/${editUser.id}` : "/users",
      form
    );

    setMsg(editUser ? "Employee updated successfully" : "Employee created successfully");
    setMsgType("success");
    setModalOpen(false);
    load();

  } catch (err) {
    setErrorMsg(err.response?.data?.message || "Error saving user");
  } finally {
    setSaveLoading(false);    // 🔥 stop loader
  }
};

  /* Ask for delete */
  const askDelete = (id) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  /* Delete after confirm */
  const handleDelete = async () => {
  try {
    setDeleteLoadingId(deleteId);   // start loader

    await api.delete(`/users/${deleteId}`);

    setMsg("Employee deleted successfully");
    setMsgType("success");
    setConfirmOpen(false);
    setDeleteId(null);
    load();

  } catch (err) {
    setMsg(err.response?.data?.message || "Error deleting");
    setMsgType("error");
  } finally {
    setDeleteLoadingId(null);       // stop loader
  }
};


  /* =======================================================
         UI
  ======================================================== */
  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-0">

      {msg && (
        <div
          className={
            `p-3 rounded-lg border text-sm sm:text-base ` +
            (msgType === "success"
              ? "bg-green-100 border-green-300 text-green-700"
              : "bg-red-100 border-red-300 text-red-700")
          }
        >
          {msg}
        </div>
      )}

      <PageTitle title="Employees" sub="Manage all employees" />

      <GlassCard>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
          <h3 className="text-lg sm:text-xl font-semibold">Employee List</h3>

          {me?.role === "ADMIN" && (
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 text-sm sm:text-base"
            >
              <FiPlus /> Add Employee
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-6">Loading...</div>
        ) : (
     <EmployeesTable
  users={users}
  askDelete={askDelete}
  openEdit={openEdit}
  me={me}
  departments={departments}
  navigate={navigate}

  deleteLoadingId={deleteLoadingId}   // ⬅ row loading support
/>
        )}
      </GlassCard>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <Modal>
        <UserForm
  form={form}
  setForm={setForm}
  submit={submit}
  close={() => setModalOpen(false)}
  editUser={editUser}
  errorMsg={errorMsg}
  me={me}
  departments={departments}
  saveLoading={saveLoading}     // 🔥 required
/>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-xl shadow-lg max-w-sm w-full">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Confirm Delete</h3>

            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-4 sm:mb-6">
              Are you sure you want to delete this employee?
            </p>

            <div className="flex justify-end gap-2 sm:gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-3 sm:px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg text-sm sm:text-base"
              >
                No
              </button>

           <button
  onClick={handleDelete}
  disabled={deleteLoadingId === deleteId}
  className="px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg text-sm sm:text-base disabled:opacity-50"
>
  {deleteLoadingId === deleteId ? "Deleting..." : "Yes, Delete"}
</button>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* =======================================================
      SUB COMPONENTS
======================================================= */
function PageTitle({ title, sub }) {
  return (
    <div className="mb-3 sm:mb-4">
      <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{sub}</p>
    </div>
  );
}
function GlassCard({ children }) {
  return (
    <div className="p-4 sm:p-6 rounded-2xl bg-white/70 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 backdrop-blur-xl shadow">
      {children}
    </div>
  );
}

function Modal({ children }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function EmployeesTable({ users, askDelete, openEdit, me, departments, navigate, deleteLoadingId }) {
  return (
    <>
      {/* ===== MOBILE CARD VIEW (xs, sm) ===== */}
      <div className="sm:hidden space-y-3">
        {users.map((u) => (
          <div
            key={u.id}
            onClick={() => navigate(`/employees/${u.id}`)}
            className="p-4 rounded-xl bg-white dark:bg-gray-800 border shadow cursor-pointer hover:bg-indigo-50 dark:hover:bg-gray-700 transition"
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-base font-semibold">
                {u.firstName} {u.lastName}
              </h3>

              <span className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700">
                {u.role}
              </span>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Email:</strong> {u.email}
            </p>

            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Department:</strong>{" "}
              {u.departments?.length
  ? u.departments.map(d => d.department.name).join(", ")
  : departments.find(dep => dep.id === u.departmentId)?.name || "-"}

            </p>

            {me?.role === "ADMIN" && (
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(u);
                  }}
                  className="p-2 rounded-lg bg-blue-500 text-white"
                >
                  <FiEdit size={16} />
                </button>

              <button
  onClick={(e) => {
    e.stopPropagation();
    askDelete(u.id);
  }}
  disabled={deleteLoadingId === u.id}
  className={`p-2 rounded-lg text-white ${
    deleteLoadingId === u.id ? "bg-gray-400" : "bg-red-500 hover:bg-red-600"
  } disabled:opacity-50`}
>
  {deleteLoadingId === u.id ? "..." : <FiTrash2 size={16} />}
</button>

              </div>
            )}
          </div>
        ))}
      </div>

      {/* ===== DESKTOP TABLE VIEW ===== */}
      <div className="hidden sm:block overflow-x-auto w-full rounded-xl">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
              <th className="p-3 text-sm">Name</th>
              <th className="p-3 text-sm">Email</th>
              <th className="p-3 text-sm">Role</th>
              <th className="p-3 text-sm">Department</th>
              {me?.role === "ADMIN" && (
                <th className="p-3 text-sm text-right">Actions</th>
              )}
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                onClick={() => navigate(`/employees/${u.id}`)}
                className="border-b dark:border-gray-800 hover:bg-indigo-100 dark:hover:bg-gray-700 cursor-pointer transition"
              >
                <td className="p-3 text-sm whitespace-nowrap">
                  {u.firstName} {u.lastName}
                </td>

                <td className="p-3 text-sm whitespace-nowrap">{u.email}</td>

                <td className="p-3 text-sm whitespace-nowrap">{u.role}</td>

                <td className="p-3 text-sm whitespace-nowrap">
                {u.departments?.length
  ? u.departments.map(d => d.department.name).join(", ")
  : departments.find(dep => dep.id === u.departmentId)?.name || "-"}

                </td>

                {me?.role === "ADMIN" && (
                  <td className="p-3 text-sm whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      {/* Edit */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(u);
                        }}
                        className="p-2 rounded-lg bg-blue-500 text-white"
                      >
                        <FiEdit size={16} />
                      </button>

                      {/* Delete */}
                <button
  onClick={(e) => {
    e.stopPropagation();
    askDelete(u.id);
  }}
  disabled={deleteLoadingId === u.id}
  className={`p-2 rounded-lg text-white ${
    deleteLoadingId === u.id ? "bg-gray-400" : "bg-red-500 hover:bg-red-600"
  } disabled:opacity-50`}
>
  {deleteLoadingId === u.id ? "..." : <FiTrash2 size={16} />}
</button>

                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UserForm({ form, setForm, submit, close, editUser, errorMsg, me, departments, saveLoading }){
  const [showPassword, setShowPassword] = useState(false);
  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <>
      <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">
        {editUser ? "Edit Employee" : "Add Employee"}
      </h3>

      {errorMsg && (
        <div className="p-3 mb-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="input"
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => update("firstName", e.target.value)}
          />
          <input
            className="input"
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => update("lastName", e.target.value)}
          />
        </div>

        <input
          className="input"
          placeholder="Email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          disabled={!!editUser}
        />

        {me?.role === "ADMIN" && (
          <select
            className="input"
            value={form.role}
            onChange={(e) => update("role", e.target.value)}
          >
            <option value="AGILITY_EMPLOYEE">Agility Employee</option>
            <option value="LYF_EMPLOYEE">Lyfshilp Employee</option>
            <option value="ADMIN">Admin</option>
          </select>
        )}

{form.role !== "ADMIN" && (
  <div className="space-y-2">
    <label className="text-sm text-gray-600 dark:text-gray-300">
      Departments
    </label>

    <div className="border rounded-lg p-3 max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-800">
      {departments.map((dep) => {
        const checked = form.departmentIds.includes(dep.id);

        return (
          <label
            key={dep.id}
            className="flex items-center gap-2 text-sm cursor-pointer py-1"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  departmentIds: e.target.checked
                    ? [...prev.departmentIds, dep.id]
                    : prev.departmentIds.filter((id) => id !== dep.id),
                }));
              }}
              className="accent-indigo-600"
            />

            <span>{dep.name}</span>
          </label>
        );
      })}

      {departments.length === 0 && (
        <p className="text-xs text-gray-500">No departments available</p>
      )}
    </div>
  </div>
)}

{me?.role === "ADMIN" && (
  <div className="relative">
    <input
      className="input pr-10"
      type={showPassword ? "text" : "password"}
      placeholder={editUser ? "New password (optional)" : "Password"}
      value={form.password}
      onChange={(e) => update("password", e.target.value)}
    />

    <button
      type="button"
      onClick={() => setShowPassword((p) => !p)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-300"
    >
      {showPassword ? <FiEye size={18} /> : <FiEyeOff size={18} />}
    </button>
  </div>
)}

        <div className="flex justify-end gap-2 sm:gap-3 pt-3">
          <button
            type="button"
            onClick={close}
            className="px-3 sm:px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 text-sm sm:text-base"
          >
            Cancel
          </button>

   <button
  disabled={saveLoading}
  className="px-3 sm:px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm sm:text-base disabled:opacity-50"
>
  {saveLoading ? "Please wait..." : editUser ? "Update" : "Create"}
</button>

        </div>
      </form>

      <style>{`
        .input {
          width: 100%;
          padding: 8px 10px;
          border-radius: 10px;
          background: #f7f7f7;
          border: 1px solid #ddd;
          font-size: 14px;
        }
        @media (min-width: 640px) {
          .input {
            padding: 10px;
            font-size: 16px;
          }
        }
        .dark .input {
          background: #1f2937;
          border-color: #374151;
          color: white;
        }
      `}</style>
    </>
  );
}