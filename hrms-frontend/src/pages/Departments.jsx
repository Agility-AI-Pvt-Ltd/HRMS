import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { FiEdit, FiTrash2, FiPlus } from "react-icons/fi";

export default function Departments() {
  const [deps, setDeps] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // GLOBAL MSG
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");

  // DELETE CONFIRM
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // MODAL
  const [modalOpen, setModalOpen] = useState(false);
  const [editDep, setEditDep] = useState(null);

  const [saveLoading, setSaveLoading] = useState(false);   // for create/update
  const [deleteLoadingId, setDeleteLoadingId] = useState(null); // row-wise delete waiting

const [form, setForm] = useState({
  name: "",
  managerIds: [],
});

  const getFullName = (u) => `${u.firstName} ${u.lastName || ""}`.trim();

  /* ---- AUTO HIDE MESSAGE ---- */
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2000);
    return () => clearTimeout(t);
  }, [msg]);

  /* ---- LOAD DATA ---- */
  const load = async () => {
    try {
      setLoading(true);

      const r = await api.get("/departments");
      setDeps(r.data.departments || []);

      const u = await api.get("/users");
      setUsers(u.data.users || []);
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to load data");
      setMsgType("error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  /* ---- CREATE MODAL ---- */
const openCreate = () => {
  setEditDep(null);
  setForm({ name: "", managerIds: [] }); // ✅ correct
  setModalOpen(true);
};

  /* ---- EDIT MODAL ---- */
  const openEdit = (d) => {
    setEditDep(d);
setForm({
  name: d.name,
  managerIds: d.managers?.map((m) => m.id) || [],
});
    setModalOpen(true);
  };

  /* ---- CREATE OR UPDATE ---- */
const submit = async (e) => {
  e.preventDefault();
  try {
    setSaveLoading(true);

    if (editDep) {
      await api.put(`/departments/${editDep.id}`, {
        name: form.name,
        managerIds: form.managerIds,
      });
      setMsg("Department updated successfully");
    } else {
      await api.post("/departments", {
        name: form.name,
        managerIds: form.managerIds,
      });
      setMsg("Department created successfully");
    }

    setMsgType("success");
    setModalOpen(false);
    load();
  } catch (err) {
    setMsg(err.response?.data?.message || "Error saving department");
    setMsgType("error");
  } finally {
    setSaveLoading(false);
  }
};

  /* ---- DELETE OPEN CONFIRM ---- */
  const askDelete = (id) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  /* ---- DELETE AFTER CONFIRM ---- */
const handleDelete = async () => {
  try {
    setDeleteLoadingId(deleteId);

    await api.delete(`/departments/${deleteId}`);

    setMsg("Department deleted successfully");
    setMsgType("success");
    setConfirmOpen(false);
    setDeleteId(null);
    load();

  } catch (err) {
    setMsg(err.response?.data?.message || "Error deleting department");
    setMsgType("error");
  } finally {
    setDeleteLoadingId(null);
  }
};

  /* ---- UI ---- */
  return (
    <div className="space-y-8">

      {/* GLOBAL MESSAGE */}
      {msg && (
        <div
          className={
            `p-3 rounded-lg border mb-2 ` +
            (msgType === "success"
              ? "bg-green-100 border-green-300 text-green-700"
              : "bg-red-100 border-red-300 text-red-700")
          }
        >
          {msg}
        </div>
      )}

      <PageTitle title="Departments" sub="Manage company departments" />

      <GlassCard>
        <div className="flex justify-between mb-4 items-center">
          <h3 className="text-xl font-semibold">Departments</h3>

          <button
            onClick={openCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl flex items-center gap-2 hover:bg-indigo-700"
          >
            <FiPlus /> Add
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6">Loading...</div>
        ) : (
          <ul className="space-y-2">
            {deps.map((d) => (
              <li
                key={d.id}
                className="p-4 rounded-xl bg-gray-100 dark:bg-gray-700 flex justify-between items-center"
              >
                <div>
                  <p className="text-lg font-semibold">{d.name}</p>

                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Manager:{" "}
{d.managers && d.managers.length > 0
  ? d.managers.map((m) => getFullName(m)).join(", ")
  : "—"}

                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => openEdit(d)}
                    className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    <FiEdit />
                  </button>

                  <button
                    onClick={() => askDelete(d.id)}
                    className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {/* ADD/EDIT MODAL */}
      {modalOpen && (
        <Modal>
        <DepartmentForm
  submit={submit}
  close={() => setModalOpen(false)}
  form={form}
  setForm={setForm}
  editDep={editDep}
  users={users}
  getFullName={getFullName}
  saveLoading={saveLoading}       // ⬅ added
/>
        </Modal>
      )}

      {/* DELETE CONFIRM MODAL */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg max-w-sm w-full">
            <h3 className="text-xl font-semibold mb-4">Confirm Delete</h3>

            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete this department?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg"
              >
                No
              </button>

             <button
  onClick={handleDelete}
  disabled={deleteLoadingId === deleteId}
  className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
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

/* ---- COMPONENTS ---- */
function PageTitle({ title, sub }) {
  return (
    <div>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-gray-500 dark:text-gray-400">{sub}</p>
    </div>
  );
}

function GlassCard({ children }) {
  return (
    <div className="p-6 rounded-2xl bg-white/70 dark:bg-gray-800/50 shadow border border-gray-200 dark:border-gray-700 backdrop-blur-md">
      {children}
    </div>
  );
}

function Modal({ children }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl w-full max-w-lg shadow-xl">
        {children}
      </div>
    </div>
  );
}

function DepartmentForm({ submit, close, form, setForm, editDep, users, getFullName, saveLoading }) {
  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <>
      <h3 className="text-2xl font-semibold mb-4">
        {editDep ? "Edit Department" : "Add Department"}
      </h3>

      <form onSubmit={submit} className="space-y-4">
        <input
          className="input"
          placeholder="Department name"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />

    <select
  multiple
  className="input"
  value={form.managerIds}
  onChange={(e) =>
    setForm((prev) => ({
      ...prev,
      managerIds: Array.from(e.target.selectedOptions).map(
        (o) => o.value
      ),
    }))
  }
>
  {users.map((u) => (
    <option key={u.id} value={u.id}>
      {getFullName(u)} ({u.role})
    </option>
  ))}
</select>

        <div className="flex justify-end gap-3 pt-3">
          <button
            type="button"
            onClick={close}
            className="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700"
          >
            Cancel
          </button>

<button className="px-4 py-2 rounded-lg bg-indigo-600 text-white" disabled={saveLoading}>
  {saveLoading ? "Please wait..." : editDep ? "Update" : "Create"}
</button>

        </div>
      </form>

      <style>{`
        .input {
          width: 100%;
          padding: 10px;
          border-radius: 10px;
          background: #f7f7f7;
          border: 1px solid #ddd;
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
