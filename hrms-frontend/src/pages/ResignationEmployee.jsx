import React, { useState, useEffect } from "react";
import { FiCalendar} from "react-icons/fi";
import api from "../api/axios";

export default function ResignationEmployee() {

  const [list, setList] = useState([]);

  // FORM FIELDS (new prisma fields added)
  const [lastWorking, setLastWorking] = useState("");
  const [reasonType, setReasonType] = useState("Other");
  const [reason, setReason] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [handoverDetail, setHandoverDetail] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // LOAD MY RESIGNATIONS
  const load = async () => {
    const r = await api.get("/resignation/my");   // UPDATED
    setList(r.data.list || []);
  };
  useEffect(() => { load(); }, []);

  // SUBMIT REQUEST
const submit = async () => {
  if (!lastWorking) return alert("Select Last Working Date");
  if (!declaration) return alert("You must accept the declaration");

  try {
    setSubmitLoading(true);   // <-- start loading

    await api.post("/resignation/apply", {
      lastWorking,
      reasonType,
      reason,
      noticePeriod,
      handoverDetail,
      declaration,
    });

    // RESET FIELDS
    setLastWorking("");
    setReason("");
    setNoticePeriod("");
    setHandoverDetail("");
    setDeclaration(false);

    load();

  } finally {
    setSubmitLoading(false);  // <-- stop loading
  }
};

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4">

      {/* FORM CARD */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border dark:border-gray-700 space-y-5">
        <h2 className="text-xl font-semibold dark:text-white">Submit Resignation</h2>

        {/* Last Working */}
        <div className="space-y-2">
          <label className="text-sm dark:text-gray-300">Last Working Day *</label>
          <input
            type="date"
            value={lastWorking}
            onChange={(e)=>{
                  const date = e.target.value;
                  const year = date.split("-")[0];
                  if (year.length > 4) return; 
                  setLastWorking(date);
                }}
            className="p-3 w-full rounded-lg border bg-gray-100 dark:bg-gray-800"
          />
        </div>

        {/* Reason Type */}
        <div className="space-y-2">
          <label className="text-sm dark:text-gray-300">Reason Type *</label>
          <select
            value={reasonType}
            onChange={(e)=>setReasonType(e.target.value)}
            className="p-3 w-full rounded-lg border bg-gray-100 dark:bg-gray-800"
          >
            <option>Personal</option>
            <option>Health</option>
            <option>Better Opportunity</option>
            <option>Career Change</option>
            <option>Relocation</option>
            <option>Other</option>
          </select>
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <label className="text-sm dark:text-gray-300">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e)=>setReason(e.target.value)}
            className="p-3 w-full rounded-lg border min-h-[90px] bg-gray-100 dark:bg-gray-800"
            placeholder="Write a short reason..."
          />
        </div>

        {/* Notice Period */}
        <div className="space-y-2">
          <label className="text-sm dark:text-gray-300">Notice Period (days)</label>
          <input
            type="number"
            min="0"
            value={noticePeriod}
            onChange={(e)=>setNoticePeriod(e.target.value)}
            className="p-3 w-full rounded-lg border bg-gray-100 dark:bg-gray-800"
          />
        </div>

        {/* Handover Details */}
        <div className="space-y-2">
          <label className="text-sm dark:text-gray-300">Handover Detail (optional)</label>
          <textarea
            value={handoverDetail}
            onChange={(e)=>setHandoverDetail(e.target.value)}
            className="p-3 w-full rounded-lg border min-h-[90px] bg-gray-100 dark:bg-gray-800"
            placeholder="Pending work, documents or tasks..."
          />
        </div>

        {/* Declaration */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={declaration}
            onChange={() => setDeclaration((p)=>!p)}
          />
          <p className="text-sm dark:text-gray-300">
            I confirm that all information provided is true.
          </p>
        </div>

<button
  onClick={submit}
  disabled={submitLoading}
  className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-semibold text-white
    ${submitLoading ? "bg-gray-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"}
  `}
>
  {submitLoading ? (
    <span className="flex items-center gap-2">
      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      Processing...
    </span>
  ) : (
    <>
     Submit Resignation
    </>
  )}
</button>

      </div>


      {/* HISTORY LIST */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border dark:border-gray-700 space-y-4">
        <h2 className="text-xl font-semibold dark:text-white">History</h2>

        {list.length === 0 ? (
          <p className="text-sm opacity-70 dark:text-gray-300">No resignation records found</p>
        ) : (
          <div className="space-y-3">
            {list.map((r)=>(
              <div key={r.id} className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 border dark:border-gray-700">

                <p className="font-semibold flex items-center gap-2 dark:text-white"><FiCalendar/>
                  Last Working: {new Date(r.lastWorking).toLocaleDateString()}
                </p>

                {r.reason && (
                  <p className="text-sm italics opacity-80 mt-1 dark:text-gray-300">"{r.reason}"</p>
                )}

                <p className="text-xs opacity-70 dark:text-gray-400 mt-1">
                  Applied On: {new Date(r.createdAt).toLocaleDateString()}
                </p>

                {/* NEW DETAILS VIEW */}
                <div className="mt-2 text-xs space-y-1 dark:text-gray-300">
                  <p><b>Reason Type:</b> {r.reasonType}</p>
                  {r.noticePeriod && <p><b>Notice Period:</b> {r.noticePeriod} days</p>}
                  {r.handoverDetail && <p><b>Handover:</b> {r.handoverDetail}</p>}
                </div>

                <span className={`inline-block mt-3 px-3 py-1 rounded-md text-sm font-semibold
                  ${r.status==="APPROVED" && "bg-green-200 text-green-800"}
                  ${r.status==="REJECTED" && "bg-red-200 text-red-800"}
                  ${r.status==="PENDING" && "bg-yellow-200 text-yellow-800"}
                `}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
