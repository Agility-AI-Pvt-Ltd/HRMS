import { useState, useEffect } from "react";
import api from "../api/axios";
import { FiEdit2, FiTrash2, FiPlus } from "react-icons/fi";
import EmployeeSelector from "../components/EmployeeSelector"; // must be at top

export default function WeeklyOff() {
  const [users, setUsers] = useState([]);
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ userId:"", offDay:"", offDate:"", isFixed:true });
  const [edit, setEdit] = useState(null);
  const [loading, setLoading] = useState(false);

  // fetch data
  const fetchData = async () => {
    try {
      const u = await api.get("/users");
      setUsers(u.data.users || []);

      const w = await api.get("/weekly-off/all");
      setList(w.data.data || []);
    } catch (e) {
      // Fetch failed; list remains empty
    }
  };

  useEffect(() => { fetchData(); }, []);

  // create weekly off
const submit = async () => {
  if (!form.userId) return alert("Select employee");

  const payload = { ...form };

  if (form.isFixed) {
    if (!form.offDay) return alert("Remove Weekly Reapeat ? ");
    payload.offDate = null;
  } else {
    if (!form.offDate) return alert("Select one-time off date");
    payload.offDay = null;
  }

  setLoading(true);
  await api.post("/weekly-off/assign", payload);
  setLoading(false);

  fetchData();
  setForm({ userId:"", offDay:"", offDate:"", isFixed:true });
};

  // update weekly off
  const update = async () => {
    if (!edit.offDay && !edit.offDate) return alert("Enter at least day or date");

    setLoading(true);
 const payload = { ...edit };

if (edit.isFixed) {
  if (!edit.offDay) return alert("Select weekly off day");
  payload.offDate = null;
} else {
  if (!edit.offDate) return alert("Select one-time off date");
  payload.offDay = null;
}

await api.put(`/weekly-off/update/${edit.id}`, payload);

    setLoading(false);

    setEdit(null);
    fetchData();
  };

  // delete weekly off
  const remove = async (id) => {
    if (!confirm("Delete weekly off?")) return;
    await api.delete(`/weekly-off/remove/${id}`);
    fetchData();
  };

  return (
    <div className="p-6 text-gray-800 dark:text-gray-200">

      <h1 className="text-2xl font-bold mb-5">Weekly Off Management</h1>

      {/* ASSIGN FORM */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-md max-w-lg space-y-4">

        {/* Employee Dropdown (custom) */}
        <label className="block text-sm">Select Employee</label>
        <EmployeeSelector
          users={users}
          value={form.userId}
          onChange={(v)=>setForm({...form,userId:v})}
        />

        {/* Weekly off */}
        <label className="block text-sm">Weekly Off (Day)</label>
        <select
          className="w-full p-2 rounded border dark:bg-gray-900"
          value={form.offDay}
          onChange={(e)=>setForm({...form,offDay:e.target.value})}
        >
          <option value="">No Weekly Day</option>
          {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
            .map(d=>(<option key={d} value={d}>{d}</option>))}
        </select>

        {/* One time date */}
        <label className="block text-sm">One-Time Off Date(optional)</label>
        <input
          type="date"
          className="w-full p-2 rounded border dark:bg-gray-900"
          value={form.offDate}
          onChange={(e)=>setForm({...form,offDate:e.target.value})}
        />

        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={form.isFixed}
            onChange={()=>setForm({...form,isFixed:!form.isFixed})}
          />
          Weekly Repeat?
        </label>

        <button
          onClick={submit}
          disabled={loading}
          className="w-full p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-indigo-400"
        >
          {loading ? "Saving..." : "Assign Weekly Off"}
        </button>
      </div>

      {/* LIST */}
      <h2 className="text-xl mt-8 mb-3 font-semibold flex items-center gap-2">
        <FiPlus /> Assigned List
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full bg-white dark:bg-gray-900 rounded shadow">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-left">Day</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-center">Fixed?</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {list.map(i=>(
              <tr key={i.id} className="border-b dark:border-gray-700">
                <td className="p-3">{i.user.firstName} {i.user.lastName}</td>
                <td className="p-3">{i.offDay || "-"}</td>
                <td className="p-3">{i.offDate?.slice(0,10) || "-"}</td>
                <td className="p-3 text-center">{i.isFixed?"Yes":"No"}</td>
                <td className="p-3 flex gap-3 justify-center">
                  <button onClick={()=>setEdit(i)} className="text-indigo-500 hover:text-indigo-700">
                    <FiEdit2 size={18}/>
                  </button>
                  <button onClick={()=>remove(i.id)} className="text-red-500 hover:text-red-700">
                    <FiTrash2 size={18}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* EDIT MODAL (unchanged) */}
      {edit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow w-96">
            <h3 className="text-xl font-bold mb-3">Edit Weekly Off</h3>

            <select
              className="w-full p-2 rounded border dark:bg-gray-900"
              value={edit.offDay || ""}
              onChange={(e)=>setEdit({...edit,offDay:e.target.value})}
            >
              <option value="">None</option>
              {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
                .map(d=>(<option key={d}>{d}</option>))}
            </select>

            <input
              type="date"
              className="w-full p-2 rounded border dark:bg-gray-900 mt-3"
              value={edit.offDate?.slice(0,10) || ""}
              onChange={(e)=>setEdit({...edit,offDate:e.target.value})}
            />

            <label className="flex gap-2 mt-3 items-center">
<input
  type="checkbox"
  checked={form.isFixed}
  onChange={()=>{
    setForm(f=>({
      ...f,
      isFixed: !f.isFixed,
      offDay: f.isFixed ? "" : f.offDay,
      offDate: f.isFixed ? f.offDate : ""
    }))
  }}
/>

              Weekly Repeat?
            </label>

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={()=>setEdit(null)}
                className="px-4 py-2 bg-gray-400 dark:bg-gray-600 text-white rounded">
                Cancel
              </button>
              <button onClick={update}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
