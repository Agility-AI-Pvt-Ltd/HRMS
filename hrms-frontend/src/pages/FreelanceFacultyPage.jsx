import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  listFacultiesForManager,
  getFacultyStats,
  getFacultyEntriesInRange,
  listBatches,
  createBatch,
  listSubjects,
  getFacultySubjects as getFacultySubjectsAPI,
  upsertDayEntry,
  addClassesToDayEntry,
  addYoutubeLecture,
  getYoutubeLecturesForFaculty,
  deleteDayEntry,
  updateClass,
  deleteClass,
} from "../data/freelanceFaculty";
import useAuthStore from "../stores/authstore";

const statusBadge = (status) => {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset";
  if (status === "ACTIVE")
    return `${base} bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800`;
  if (status === "ON_HOLD")
    return `${base} bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:ring-yellow-800`;
  return `${base} bg-gray-50 text-gray-700 ring-gray-200 dark:bg-gray-900/30 dark:text-gray-200 dark:ring-gray-800`;
};

const formatDate = (d) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const FreelanceFacultyPage = () => {
  const { facultyId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const managerId = user?.id;

  const [faculty, setFaculty] = useState(null);
  const [stats, setStats] = useState(null);
  const [entries, setEntries] = useState([]);
  const [batches, setBatches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [facultySubjects, setFacultySubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statsScope, setStatsScope] = useState("ALL"); // ALL | THIS_MONTH
  const [statsLoading, setStatsLoading] = useState(false);
  const [addBatchModalOpen, setAddBatchModalOpen] = useState(false);
  const [addBatchForm, setAddBatchForm] = useState({
    name: "",
    code: "",
    description: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  });
  const [addBatchError, setAddBatchError] = useState(null);
  const [addBatchSubmitting, setAddBatchSubmitting] = useState(false);
  const [addEntryModalOpen, setAddEntryModalOpen] = useState(false);
  const [addEntryForm, setAddEntryForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    isPresent: true,
    remarks: "",
    batchId: "",
    subjectId: "",
    topic: "",
    startTime: "",
    endTime: "",
    notes: "",
  });
  const [addEntryError, setAddEntryError] = useState(null);
  const [addEntrySubmitting, setAddEntrySubmitting] = useState(false);
  const [addEntryOpening, setAddEntryOpening] = useState(false);

  // YouTube lecture state
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);
  const [youtubeDate, setYoutubeDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeDescription, setYoutubeDescription] = useState("");
  const [youtubeError, setYoutubeError] = useState(null);
  const [youtubeSubmitting, setYoutubeSubmitting] = useState(false);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeLectures, setYoutubeLectures] = useState([]);
  const [youtubeScope, setYoutubeScope] = useState("THIS_MONTH"); // THIS_MONTH | ALL
  const [youtubeCount, setYoutubeCount] = useState(0);

  // Delete entry state
  const [deleteEntryModalOpen, setDeleteEntryModalOpen] = useState(false);
  const [deleteEntryDate, setDeleteEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [deleteEntryList, setDeleteEntryList] = useState([]);
  const [deleteEntryLoading, setDeleteEntryLoading] = useState(false);
  const [deleteEntryError, setDeleteEntryError] = useState(null);
  const [deletingEntryId, setDeletingEntryId] = useState(null);

  // Edit entry state
  const [editEntryModalOpen, setEditEntryModalOpen] = useState(false);
  const [editEntryForm, setEditEntryForm] = useState({
    entryId: null,
    date: new Date().toISOString().slice(0, 10),
    isPresent: true,
    remarks: "",
    classes: [], // Array of class objects with id, batchId, subjectId, topic, startTime, endTime, notes
  });
  const [editEntryError, setEditEntryError] = useState(null);
  const [editEntrySubmitting, setEditEntrySubmitting] = useState(false);
  const [editEntryLoading, setEditEntryLoading] = useState(false);

  const buildYoutubeRangeForScope = (scope) => {
    if (scope !== "THIS_MONTH") {
      return { from: undefined, to: undefined };
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Use local date parts so timezone doesn't shift the calendar day (e.g. IST would make Feb 1 → "2025-01-31" with toISOString)
    const fmtLocal = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    return {
      from: fmtLocal(firstDay),
      to: fmtLocal(lastDay),
    };
  };

  const buildStatsRangeForScope = (scope) => {
    if (scope !== "THIS_MONTH") {
      return { from: undefined, to: undefined };
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Use local date parts so timezone doesn't shift the calendar day
    const fmtLocal = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    return {
      from: fmtLocal(firstDay),
      to: fmtLocal(lastDay),
    };
  };

  const fetchDetails = useCallback(async () => {
    if (!managerId || !facultyId) return;

    setLoading(true);
    setError(null);

    try {
      const { faculties: list = [], error: listError } =
        await listFacultiesForManager(managerId);
      if (listError) {
        setError(listError);
        setFaculty(null);
        setLoading(false);
        return;
      }

      const found = Array.isArray(list) ? list.find((f) => String(f.id) === String(facultyId)) : null;
      if (!found) {
        setError("Faculty not found or you don't have access.");
        setFaculty(null);
        setStats(null);
        setEntries([]);
        setLoading(false);
        return;
      }

      setFaculty(found);

      const entriesRes = await getFacultyEntriesInRange(facultyId, {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
      });

      if (entriesRes.entries) setEntries(entriesRes.entries);
      if (entriesRes.error && !entriesRes.entries?.length) setEntries([]);

      const [batchesRes, subjectsRes, facultySubjectsRes] = await Promise.all([
        listBatches(),
        listSubjects(),
        getFacultySubjectsAPI(facultyId),
      ]);
      if (batchesRes.batches) setBatches(batchesRes.batches);
      if (subjectsRes.subjects) {
        setSubjects(subjectsRes.subjects);
        
      } else if (subjectsRes.error) {
        console.error("Failed to load subjects:", subjectsRes.error);
      }
      if (facultySubjectsRes.subjects) {
        setFacultySubjects(facultySubjectsRes.subjects);
      } else if (facultySubjectsRes.error) {
        console.error("Failed to load faculty subjects:", facultySubjectsRes.error);
      }
    } catch (err) {
      console.error("FreelanceFacultyPage fetch:", err);
      setError(err?.message ?? "Failed to load faculty details.");
    } finally {
      setLoading(false);
    }
  }, [managerId, facultyId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const loadStats = useCallback(
    async (scope) => {
      if (!facultyId) return;

      const { from, to } = buildStatsRangeForScope(scope);

      setStatsLoading(true);
      try {
        const { stats: statsData, error: statsError } = await getFacultyStats(facultyId, {
          from,
          to,
        });

        if (statsError) {
          console.error("Failed to load stats:", statsError);
          setStats(null);
          return;
        }

        if (statsData) {
          setStats(statsData);
        }
      } catch (err) {
        console.error("loadStats:", err);
        setStats(null);
      } finally {
        setStatsLoading(false);
      }
    },
    [facultyId]
  );

  useEffect(() => {
    if (facultyId) {
      setStatsScope("ALL");
      loadStats("ALL");
    }
  }, [facultyId, loadStats]);

  const loadYoutubeLectures = useCallback(
    async (scope) => {
      if (!facultyId) return;

      const { from, to } = buildYoutubeRangeForScope(scope);

      setYoutubeLoading(true);
      setYoutubeError(null);

      try {
        const { data, error } = await getYoutubeLecturesForFaculty(
          facultyId,
          { from, to }
        );

        if (error || !data?.success) {
          setYoutubeLectures([]);
          setYoutubeCount(0);
          setYoutubeError(
            error?.response?.data?.message ??
              error?.message ??
              data?.message ??
              "Failed to load YouTube lectures."
          );
          return;
        }

        const lectures = Array.isArray(data.lectures)
          ? data.lectures
          : [];
        setYoutubeLectures(lectures);
        setYoutubeCount(
          typeof data.count === "number" ? data.count : lectures.length
        );
      } catch (err) {
        console.error("loadYoutubeLectures:", err);
        setYoutubeLectures([]);
        setYoutubeCount(0);
        setYoutubeError(
          err?.response?.data?.message ??
            err?.message ??
            "Failed to load YouTube lectures."
        );
      } finally {
        setYoutubeLoading(false);
      }
    },
    [facultyId]
  );

  useEffect(() => {
    if (facultyId) {
      setYoutubeScope("THIS_MONTH");
      loadYoutubeLectures("THIS_MONTH");
    }
  }, [facultyId, loadYoutubeLectures]);

  const loadEntriesForDate = useCallback(async (date) => {
    if (!facultyId || !date) return;
    
    setDeleteEntryLoading(true);
    setDeleteEntryError(null);
    
    try {
      const { entries, error } = await getFacultyEntriesInRange(facultyId, {
        from: date,
        to: date,
      });
      
      if (error) {
        setDeleteEntryError(error);
        setDeleteEntryList([]);
        return;
      }
      
      setDeleteEntryList(entries || []);
    } catch (err) {
      console.error("loadEntriesForDate:", err);
      setDeleteEntryError(err?.message ?? "Failed to load entries");
      setDeleteEntryList([]);
    } finally {
      setDeleteEntryLoading(false);
    }
  }, [facultyId]);

  const handleDeleteEntry = async (entryId) => {
    if (!facultyId || !entryId) return;
    
    setDeletingEntryId(entryId);
    setDeleteEntryError(null);
    
    try {
      const { success, error } = await deleteDayEntry(facultyId, entryId);
      
      if (error || !success) {
        setDeleteEntryError(error ?? "Failed to delete entry");
        return;
      }
      
      // Refresh the list for the selected date
      await loadEntriesForDate(deleteEntryDate);
      
      // Refresh stats and entries list
      await loadStats(statsScope);
      await fetchDetails();
    } catch (err) {
      console.error("handleDeleteEntry:", err);
      setDeleteEntryError(err?.message ?? "Failed to delete entry");
    } finally {
      setDeletingEntryId(null);
    }
  };

  // Helper function to open edit entry modal
  const openEditEntryModal = async (entry) => {
    if (!entry || !facultyId) return;
    
    setEditEntryError(null);
    setEditEntryLoading(true);
    
    try {
      // Refresh faculty subjects when opening modal
      const { subjects: refreshedSubjects } = await getFacultySubjectsAPI(facultyId);
      if (refreshedSubjects) {
        setFacultySubjects(refreshedSubjects);
      }

      // Format classes for editing
      const formattedClasses = entry.classes?.map((c) => ({
        id: c.id,
        batchId: c.batchId || c.batch?.id || "",
        subjectId: c.subjectId || c.subject?.id || "",
        topic: c.topic || "",
        startTime: c.startTime ? new Date(c.startTime).toTimeString().slice(0, 5) : "",
        endTime: c.endTime ? new Date(c.endTime).toTimeString().slice(0, 5) : "",
        notes: c.notes || "",
      })) || [];

      const isPresent = entry.isPresent !== undefined ? entry.isPresent : true;
      
      setEditEntryForm({
        entryId: entry.id,
        date: entry.date ? (typeof entry.date === "string" ? entry.date.slice(0, 10) : new Date(entry.date).toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10),
        isPresent,
        remarks: entry.remarks || "",
        classes: isPresent && formattedClasses.length > 0 
          ? formattedClasses 
          : isPresent 
            ? [{ id: null, batchId: batches.length > 0 ? batches[0].id : "", subjectId: refreshedSubjects?.length > 0 ? refreshedSubjects[0].id : "", topic: "", startTime: "", endTime: "", notes: "" }]
            : [],
      });
      
      setEditEntryModalOpen(true);
    } catch (err) {
      console.error("openEditEntryModal:", err);
      setEditEntryError(err?.message ?? "Failed to load entry data");
    } finally {
      setEditEntryLoading(false);
    }
  };

  // Helper function/controller to handle editing entries
  const handleEditEntry = async (e) => {
    e.preventDefault();
    setEditEntryError(null);

    if (!editEntryForm.entryId || !editEntryForm.date) {
      setEditEntryError("Entry ID and date are required.");
      return;
    }

    if (editEntryForm.isPresent) {
      // Validate classes if present
      const validClasses = editEntryForm.classes.filter(
        (c) => c.batchId && c.subjectId && c.topic.trim() && c.startTime && c.endTime
      );
      
      if (validClasses.length === 0) {
        setEditEntryError("At least one valid class is required when present.");
        return;
      }

      // Validate time ranges
      for (const cls of validClasses) {
        const duration = calculateDuration(cls.startTime, cls.endTime);
        if (duration <= 0) {
          setEditEntryError(`End time must be after start time for class: ${cls.topic || "Untitled"}`);
          return;
        }
      }
    }

    setEditEntrySubmitting(true);
    
    try {
      // Step 1: Update the day entry itself
      const entryPayload = {
        date: editEntryForm.date,
        isPresent: editEntryForm.isPresent,
        remarks: editEntryForm.remarks.trim() || null,
      };

      const { entry: updatedEntry, error: entryError } = await upsertDayEntry(facultyId, entryPayload);
      if (entryError || !updatedEntry) {
        setEditEntryError(entryError ?? "Failed to update entry");
        return;
      }

      // Step 2: Handle classes if present
      if (editEntryForm.isPresent && updatedEntry) {
        const existingClassIds = editEntryForm.classes
          .filter((c) => c.id !== null)
          .map((c) => c.id);
        
        // Get current classes from the entry (use updatedEntry.id since entry might have been recreated)
        const currentEntryRes = await getFacultyEntriesInRange(facultyId, {
          from: editEntryForm.date,
          to: editEntryForm.date,
        });
        const currentEntry = currentEntryRes.entries?.find((e) => e.id === updatedEntry.id);
        const currentClassIds = currentEntry?.classes?.map((c) => c.id) || [];
        
        // Delete classes that are no longer in the form
        const classesToDelete = currentClassIds.filter((id) => !existingClassIds.includes(id));
        for (const classId of classesToDelete) {
          await deleteClass(classId);
        }

        // Update or add classes
        const validClasses = editEntryForm.classes.filter(
          (c) => c.batchId && c.subjectId && c.topic.trim() && c.startTime && c.endTime
        );

        for (const cls of validClasses) {
          const dateStr = editEntryForm.date;
          const startDateTime = new Date(`${dateStr}T${cls.startTime}`);
          const endDateTime = new Date(`${dateStr}T${cls.endTime}`);
          const duration = calculateDuration(cls.startTime, cls.endTime);

          if (cls.id && existingClassIds.includes(cls.id)) {
            // Update existing class
            await updateClass(cls.id, {
              topic: cls.topic.trim(),
              startTime: startDateTime.toISOString(),
              endTime: endDateTime.toISOString(),
              duration,
              notes: cls.notes.trim() || null,
            });
          } else if (!cls.id) {
            // Add new class
            await addClassesToDayEntry(updatedEntry.id, [{
              batchId: cls.batchId,
              subjectId: cls.subjectId,
              topic: cls.topic.trim(),
              startTime: startDateTime.toISOString(),
              endTime: endDateTime.toISOString(),
              duration,
              notes: cls.notes.trim() || null,
            }]);
          }
        }
      } else if (!editEntryForm.isPresent) {
        // If changing to absent, delete all classes
        const currentEntryRes = await getFacultyEntriesInRange(facultyId, {
          from: editEntryForm.date,
          to: editEntryForm.date,
        });
        const currentEntry = currentEntryRes.entries?.find((e) => e.id === updatedEntry.id);
        const currentClassIds = currentEntry?.classes?.map((c) => c.id) || [];
        for (const classId of currentClassIds) {
          await deleteClass(classId);
        }
      }

      setEditEntryModalOpen(false);
      await fetchDetails();
      await loadStats(statsScope);
    } catch (err) {
      console.error("handleEditEntry:", err);
      setEditEntryError(err?.message ?? "Failed to update entry");
    } finally {
      setEditEntrySubmitting(false);
    }
  };

  const fetchBatches = useCallback(async () => {
    const res = await listBatches();
    if (res.batches) setBatches(res.batches);
  }, []);

  const openAddBatchModal = () => {
    setAddBatchError(null);
    setAddBatchForm({
      name: "",
      code: "",
      description: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
    });
    setAddBatchModalOpen(true);
  };

  const handleAddBatchSubmit = async (e) => {
    e.preventDefault();
    setAddBatchError(null);
    if (!addBatchForm.name.trim() || !addBatchForm.startDate) {
      setAddBatchError("Name and start date are required.");
      return;
    }
    setAddBatchSubmitting(true);
    try {
      const payload = {
        name: addBatchForm.name.trim(),
        startDate: addBatchForm.startDate,
      };
      if (addBatchForm.code.trim()) payload.code = addBatchForm.code.trim();
      if (addBatchForm.description.trim()) payload.description = addBatchForm.description.trim();
      if (addBatchForm.endDate) payload.endDate = addBatchForm.endDate;

      const { batch, error: createError } = await createBatch(payload);
      if (createError) {
        setAddBatchError(createError);
        return;
      }
      setAddBatchModalOpen(false);
      await fetchBatches();
    } finally {
      setAddBatchSubmitting(false);
    }
  };

  const getFacultySubjectsForDropdown = useCallback(() => {
    // Use facultySubjects which are fetched from the API and guaranteed to exist
    if (facultySubjects && Array.isArray(facultySubjects) && facultySubjects.length > 0) {
      return facultySubjects;
    }
    return [];
  }, [facultySubjects]);

  const openAddEntryModal = async () => {
    setAddEntryError(null);
    setAddEntryOpening(true);
    try {
      // Refresh faculty subjects when opening modal to ensure they exist
      if (facultyId) {
        const { subjects: refreshedSubjects } = await getFacultySubjectsAPI(facultyId);
        if (refreshedSubjects) {
          setFacultySubjects(refreshedSubjects);
        }
      }
      const facultySubjectsList = getFacultySubjectsForDropdown();
      setAddEntryForm({
        date: new Date().toISOString().slice(0, 10),
        isPresent: true,
        remarks: "",
        batchId: batches.length > 0 ? batches[0].id : "",
        subjectId: facultySubjectsList.length > 0 ? facultySubjectsList[0].id : "",
        topic: "",
        startTime: "",
        endTime: "",
        notes: "",
      });
      setAddEntryModalOpen(true);
    } finally {
      setAddEntryOpening(false);
    }
  };

  const openYoutubeModal = () => {
    setYoutubeError(null);
    setYoutubeDate(new Date().toISOString().slice(0, 10));
    setYoutubeUrl("");
    setYoutubeTitle("");
    setYoutubeDescription("");
    setYoutubeModalOpen(true);
  };

  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    setYoutubeError(null);

    if (!youtubeDate || !youtubeUrl.trim()) {
      setYoutubeError("Date and YouTube URL are required.");
      return;
    }

    setYoutubeSubmitting(true);
    try {
      const { data, error } = await addYoutubeLecture({
        facultyId,
        date: youtubeDate,
        youtubeUrl: youtubeUrl.trim(),
        title: youtubeTitle.trim() || undefined,
        description: youtubeDescription.trim() || undefined,
      });

      if (error || !data?.success) {
        setYoutubeError(
          error?.response?.data?.message ??
            error?.message ??
            data?.message ??
            "Failed to add YouTube lecture."
        );
        return;
      }

      // Refresh list for current scope
      await loadYoutubeLectures(youtubeScope);

      // Keep modal open for adding multiple, but reset fields (except date)
      setYoutubeUrl("");
      setYoutubeTitle("");
      setYoutubeDescription("");
    } catch (err) {
      console.error("handleYoutubeSubmit:", err);
      setYoutubeError(
        err?.response?.data?.message ??
          err?.message ??
          "Failed to add YouTube lecture."
      );
    } finally {
      setYoutubeSubmitting(false);
    }
  };


  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    if (end < start) return 0;
    return Math.round((end - start) / 60000); // minutes
  };

  const handleAddEntrySubmit = async (e) => {
    e.preventDefault();
    setAddEntryError(null);

    if (!addEntryForm.date) {
      setAddEntryError("Date is required.");
      return;
    }

    if (addEntryForm.isPresent) {
      if (!addEntryForm.batchId || !addEntryForm.subjectId || !addEntryForm.topic.trim()) {
        setAddEntryError("Batch, subject, and topic are required when present.");
        return;
      }
      if (!addEntryForm.startTime || !addEntryForm.endTime) {
        setAddEntryError("Start time and end time are required when present.");
        return;
      }
      const duration = calculateDuration(addEntryForm.startTime, addEntryForm.endTime);
      if (duration <= 0) {
        setAddEntryError("End time must be after start time.");
        return;
      }
    }

    setAddEntrySubmitting(true);
    try {
      const entryPayload = {
        date: addEntryForm.date,
        isPresent: addEntryForm.isPresent,
        remarks: addEntryForm.remarks.trim() || null,
      };

      const { entry, error: entryError } = await upsertDayEntry(facultyId, entryPayload);
      if (entryError) {
        setAddEntryError(entryError);
        return;
      }

      if (addEntryForm.isPresent && entry) {
        const dateStr = addEntryForm.date;
        const startDateTime = new Date(`${dateStr}T${addEntryForm.startTime}`);
        const endDateTime = new Date(`${dateStr}T${addEntryForm.endTime}`);
        const duration = calculateDuration(addEntryForm.startTime, addEntryForm.endTime);

        const classPayload = {
          batchId: addEntryForm.batchId,
          subjectId: addEntryForm.subjectId,
          topic: addEntryForm.topic.trim(),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          duration,
          notes: addEntryForm.notes.trim() || null,
        };

        const { error: classError } = await addClassesToDayEntry(entry.id, [classPayload]);
        if (classError) {
          setAddEntryError(classError);
          return;
        }
      }

      setAddEntryModalOpen(false);
      await fetchDetails();
      // Refresh stats with current scope
      await loadStats(statsScope);
    } finally {
      setAddEntrySubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
          <span>Loading faculty details...</span>
        </div>
      </div>
    );
  }

  if (error && !faculty) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate("/freelance")}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← Back to faculties
        </button>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      </div>
    );
  }

  const managerName = faculty?.manager
    ? [faculty.manager.firstName, faculty.manager.lastName].filter(Boolean).join(" ") || faculty.manager.email
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/freelance")}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← Back to faculties
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {faculty?.name ?? "Faculty"}
        </h1>
        {faculty?.status && (
          <span className={statusBadge(faculty.status)}>{faculty.status}</span>
        )}
      </div>

      {/* Profile / details card */}
      <div className="rounded-2xl border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Profile
          </h2>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Name
            </div>
            <div className="mt-1 text-gray-900 dark:text-gray-100">{faculty?.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Email
            </div>
            <div className="mt-1 text-gray-900 dark:text-gray-100">
              {faculty?.email ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Phone
            </div>
            <div className="mt-1 text-gray-900 dark:text-gray-100">
              {faculty?.phone ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Joining date
            </div>
            <div className="mt-1 text-gray-900 dark:text-gray-100">
              {formatDate(faculty?.joiningDate)}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Manager
            </div>
            <div className="mt-1 text-gray-900 dark:text-gray-100">{managerName}</div>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Subjects
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {faculty?.subjects?.length
                ? faculty.subjects.map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800"
                    >
                      {s}
                    </span>
                  ))
                : "—"}
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Preferred days
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {faculty?.preferredDaysOfWeek?.length
                ? faculty.preferredDaysOfWeek.map((day, i) => (
                    <span
                      key={i}
                      className="inline-flex rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-700/10 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
                    >
                      {day}
                    </span>
                  ))
                : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Statistics
          </h2>
          <select
            value={statsScope}
            onChange={async (e) => {
              const nextScope = e.target.value;
              setStatsScope(nextScope);
              await loadStats(nextScope);
            }}
            disabled={statsLoading}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="ALL">All time</option>
            <option value="THIS_MONTH">This month</option>
          </select>
        </div>
        <div className="p-6">
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
                <span>Loading stats…</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              <div className="rounded-2xl border bg-gray-50/50 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Total entries
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.totalDayEntries ?? faculty?.totalEntries ?? 0}
                </div>
              </div>
              <div className="rounded-2xl border bg-gray-50/50 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Total classes
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.totalClasses ?? faculty?.totalClasses ?? 0}
                </div>
              </div>
              <div className="rounded-2xl border bg-gray-50/50 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Total hours
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.totalDurationMinutes != null
                    ? (stats.totalDurationMinutes / 60).toFixed(1)
                    : faculty?.totalHours ?? 0}
                </div>
              </div>
              <div className="rounded-2xl border bg-gray-50/50 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Present days
                </div>
                <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats?.presentDays ?? "—"}
                </div>
              </div>
              <div className="rounded-2xl border bg-gray-50/50 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Absent days
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.absentDays ?? "—"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* YouTube lectures */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              YouTube lectures
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {youtubeScope === "THIS_MONTH" ? "This month" : "All time"} •{" "}
              {youtubeCount} video{youtubeCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={youtubeScope}
              onChange={async (e) => {
                const nextScope = e.target.value;
                setYoutubeScope(nextScope);
                await loadYoutubeLectures(nextScope);
              }}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="THIS_MONTH">This month</option>
              <option value="ALL">All time</option>
            </select>
            <button
              type="button"
              onClick={openYoutubeModal}
              className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              Add YouTube lecture
            </button>
          </div>
        </div>
        <div className="p-6">
          {youtubeLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
              <span>Loading lectures…</span>
            </div>
          ) : youtubeError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {youtubeError}
            </div>
          ) : youtubeLectures.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No YouTube lectures in this period.
            </p>
          ) : (
            <div className="max-h-[150px] overflow-y-auto pr-2">
              <ul className="space-y-2">
                {youtubeLectures.map((lec) => (
                  <li
                    key={lec.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <a
                          href={lec.youtubeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                        >
                          {lec.title || "YouTube lecture"}
                        </a>
                        <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(lec.date)}
                        </span>
                      </div>
                      {lec.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                          {lec.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Batches */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Batches
          </h2>
          <button
            type="button"
            onClick={openAddBatchModal}
            className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Add batch
          </button>
        </div>
        <div className="p-6">
          {batches.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No batches yet. Add a batch to use when logging classes.
            </p>
          ) : (
            <ul className="space-y-2">
              {batches.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50/50 py-2 px-3 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">{b.name}</span>
                  {b.code && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{b.code}</span>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(b.startDate)}
                    {b.endDate ? ` – ${formatDate(b.endDate)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Add batch modal */}
      {addBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Add batch
              </h3>
            </div>
            <form onSubmit={handleAddBatchSubmit} className="space-y-4 p-6">
              {addBatchError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {addBatchError}
                </div>
              )}
              <div>
                <label htmlFor="batch-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="batch-name"
                  type="text"
                  value={addBatchForm.name}
                  onChange={(e) => setAddBatchForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="e.g. Batch 2024"
                  required
                />
              </div>
              <div>
                <label htmlFor="batch-code" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Code
                </label>
                <input
                  id="batch-code"
                  type="text"
                  value={addBatchForm.code}
                  onChange={(e) => setAddBatchForm((f) => ({ ...f, code: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="e.g. B2024"
                />
              </div>
              <div>
                <label htmlFor="batch-description" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  id="batch-description"
                  value={addBatchForm.description}
                  onChange={(e) => setAddBatchForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Optional"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="batch-start" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Start date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="batch-start"
                    type="date"
                    value={addBatchForm.startDate}
                    onChange={(e) => setAddBatchForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="batch-end" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    End date
                  </label>
                  <input
                    id="batch-end"
                    type="date"
                    value={addBatchForm.endDate}
                    onChange={(e) => setAddBatchForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setAddBatchModalOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addBatchSubmitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  {addBatchSubmitting ? "Creating…" : "Create batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add entry modal */}
      {addEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-full max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Add day entry
              </h3>
            </div>
            <form onSubmit={handleAddEntrySubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {addEntryError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {addEntryError}
                </div>
              )}
              <div>
                <label htmlFor="entry-date" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="entry-date"
                  type="date"
                  value={addEntryForm.date}
                  onChange={(e) => setAddEntryForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={addEntryForm.isPresent === true}
                      onChange={() => setAddEntryForm((f) => ({ ...f, isPresent: true }))}
                      className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Present</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={addEntryForm.isPresent === false}
                      onChange={() => setAddEntryForm((f) => ({ ...f, isPresent: false }))}
                      className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Absent</span>
                  </label>
                </div>
              </div>
              {addEntryForm.isPresent && (
                <>
                  <div>
                    <label htmlFor="entry-batch" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Batch <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="entry-batch"
                      value={addEntryForm.batchId}
                      onChange={(e) => setAddEntryForm((f) => ({ ...f, batchId: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      required
                    >
                      <option value="">Select batch</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.code ? `(${b.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="entry-subject" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="entry-subject"
                      value={addEntryForm.subjectId}
                      onChange={(e) => setAddEntryForm((f) => ({ ...f, subjectId: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      required
                    >
                      <option value="">Select subject</option>
                      {getFacultySubjectsForDropdown().length === 0 ? (
                        <option value="" disabled>
                          No subjects found. Please ensure subjects are created and assigned to this faculty.
                        </option>
                      ) : (
                        getFacultySubjectsForDropdown().map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.code ? `(${s.code})` : ""}
                          </option>
                        ))
                      )}
                    </select>
                    {getFacultySubjectsForDropdown().length === 0 && faculty?.subjects && faculty.subjects.length > 0 && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        Faculty has subjects assigned: {faculty.subjects.join(", ")}. These subjects will be created automatically when you open this modal.
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="entry-topic" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Topic <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="entry-topic"
                      type="text"
                      value={addEntryForm.topic}
                      onChange={(e) => setAddEntryForm((f) => ({ ...f, topic: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      placeholder="e.g. Introduction to React"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="entry-start-time" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Start time <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="entry-start-time"
                        type="time"
                        value={addEntryForm.startTime}
                        onChange={(e) => setAddEntryForm((f) => ({ ...f, startTime: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="entry-end-time" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        End time <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="entry-end-time"
                        type="time"
                        value={addEntryForm.endTime}
                        onChange={(e) => setAddEntryForm((f) => ({ ...f, endTime: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        required
                      />
                    </div>
                  </div>
                  {addEntryForm.startTime && addEntryForm.endTime && (
                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      Duration: {calculateDuration(addEntryForm.startTime, addEntryForm.endTime)} minutes
                    </div>
                  )}
                  <div>
                    <label htmlFor="entry-notes" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Notes
                    </label>
                    <textarea
                      id="entry-notes"
                      value={addEntryForm.notes}
                      onChange={(e) => setAddEntryForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      placeholder="Optional notes about the class"
                    />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="entry-remarks" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Remarks
                </label>
                <textarea
                  id="entry-remarks"
                  value={addEntryForm.remarks}
                  onChange={(e) => setAddEntryForm((f) => ({ ...f, remarks: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Optional remarks about the day"
                />
              </div>
              </div>
              <div className="flex-shrink-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={() => setAddEntryModalOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addEntrySubmitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  {addEntrySubmitting ? "Creating…" : "Create entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add YouTube lecture modal */}
      {youtubeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Add YouTube lecture
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                For {faculty?.name ?? "faculty"}
              </p>
            </div>
            <form onSubmit={handleYoutubeSubmit} className="space-y-4 p-6">
              {youtubeError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {youtubeError}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={youtubeDate}
                  onChange={(e) => setYoutubeDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  YouTube URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Title
                </label>
                <input
                  type="text"
                  value={youtubeTitle}
                  onChange={(e) => setYoutubeTitle(e.target.value)}
                  placeholder="Optional title for the lecture"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={youtubeDescription}
                  onChange={(e) => setYoutubeDescription(e.target.value)}
                  placeholder="Optional short description"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div className="mt-2 flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setYoutubeModalOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  disabled={youtubeSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={youtubeSubmitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  {youtubeSubmitting ? "Saving…" : "Add lecture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recent entries */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Recent entries (last 30 days)
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const currentDate = new Date().toISOString().slice(0, 10);
                const { entries: dateEntries } = await getFacultyEntriesInRange(facultyId, {
                  from: currentDate,
                  to: currentDate,
                });
                if (dateEntries && dateEntries.length > 0) {
                  // If there's an entry for today, open edit modal with the first entry
                  await openEditEntryModal(dateEntries[0]);
                } else {
                  // If no entry exists, open add entry modal with today's date
                  await openAddEntryModal();
                }
              }}
              className="inline-flex items-center rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-indigo-600 dark:bg-gray-800 dark:text-indigo-400 dark:hover:bg-gray-700"
            >
              Edit entry
            </button>
            <button
              type="button"
              onClick={async () => {
                const currentDate = new Date().toISOString().slice(0, 10);
                setDeleteEntryModalOpen(true);
                setDeleteEntryDate(currentDate);
                setDeleteEntryList([]);
                setDeleteEntryError(null);
                // Load entries for the current date
                await loadEntriesForDate(currentDate);
              }}
              className="inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-red-600 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-gray-700"
            >
              Remove entry
            </button>
            <button
              type="button"
              onClick={openAddEntryModal}
              disabled={addEntryOpening}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 dark:focus:ring-offset-gray-900"
            >
              {addEntryOpening && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              <span>{addEntryOpening ? "Preparing…" : "Add entry"}</span>
            </button>
          </div>
        </div>
        {entries.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No day entries in this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-950/60">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Present
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Remarks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Classes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-950/40">
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(entry.date)}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={
                          entry.isPresent
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-gray-500 dark:text-gray-400"
                        }
                      >
                        {entry.isPresent ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {entry.remarks ?? "—"}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {entry.classes?.length
                          ? entry.classes.map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              >
                                {c.batch?.name ?? "Batch"} / {c.subject?.name ?? "Subject"}
                                {c.duration ? ` (${c.duration}m)` : ""}
                              </span>
                            ))
                          : "—"}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        type="button"
                        onClick={() => openEditEntryModal(entry)}
                        disabled={editEntryLoading}
                        className="inline-flex items-center rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:border-indigo-600 dark:bg-gray-800 dark:text-indigo-400 dark:hover:bg-gray-700"
                      >
                        {editEntryLoading ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                            <span className="ml-2">Loading...</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span className="ml-2">Edit</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Entry Modal */}
      {editEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-full max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Edit day entry
              </h3>
            </div>
            <form onSubmit={handleEditEntry} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {editEntryError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                    {editEntryError}
                  </div>
                )}
                <div>
                  <label htmlFor="edit-entry-date" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-entry-date"
                    type="date"
                    value={editEntryForm.date}
                    onChange={(e) => setEditEntryForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={editEntryForm.isPresent === true}
                        onChange={() => setEditEntryForm((f) => ({ ...f, isPresent: true }))}
                        className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Present</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={editEntryForm.isPresent === false}
                        onChange={() => setEditEntryForm((f) => ({ ...f, isPresent: false }))}
                        className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Absent</span>
                    </label>
                  </div>
                </div>
                {editEntryForm.isPresent && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Classes</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setEditEntryForm((f) => ({
                              ...f,
                              classes: [
                                ...f.classes,
                                { id: null, batchId: batches.length > 0 ? batches[0].id : "", subjectId: getFacultySubjectsForDropdown().length > 0 ? getFacultySubjectsForDropdown()[0].id : "", topic: "", startTime: "", endTime: "", notes: "" },
                              ],
                            }));
                          }}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                        >
                          + Add Class
                        </button>
                      </div>
                      {editEntryForm.classes.map((cls, index) => (
                        <div key={index} className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Class {index + 1}</span>
                            {editEntryForm.classes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditEntryForm((f) => ({
                                    ...f,
                                    classes: f.classes.filter((_, i) => i !== index),
                                  }));
                                }}
                                className="text-sm text-red-600 hover:text-red-500 dark:text-red-400"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                Batch <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={cls.batchId}
                                onChange={(e) => {
                                  const newClasses = [...editEntryForm.classes];
                                  newClasses[index].batchId = e.target.value;
                                  setEditEntryForm((f) => ({ ...f, classes: newClasses }));
                                }}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                required
                              >
                                <option value="">Select batch</option>
                                {batches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name} {b.code ? `(${b.code})` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                Subject <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={cls.subjectId}
                                onChange={(e) => {
                                  const newClasses = [...editEntryForm.classes];
                                  newClasses[index].subjectId = e.target.value;
                                  setEditEntryForm((f) => ({ ...f, classes: newClasses }));
                                }}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                required
                              >
                                <option value="">Select subject</option>
                                {getFacultySubjectsForDropdown().map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} {s.code ? `(${s.code})` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                Topic <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={cls.topic}
                                onChange={(e) => {
                                  const newClasses = [...editEntryForm.classes];
                                  newClasses[index].topic = e.target.value;
                                  setEditEntryForm((f) => ({ ...f, classes: newClasses }));
                                }}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                placeholder="e.g. Introduction to React"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                  Start time <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="time"
                                  value={cls.startTime}
                                  onChange={(e) => {
                                    const newClasses = [...editEntryForm.classes];
                                    newClasses[index].startTime = e.target.value;
                                    setEditEntryForm((f) => ({ ...f, classes: newClasses }));
                                  }}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                  required
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                  End time <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="time"
                                  value={cls.endTime}
                                  onChange={(e) => {
                                    const newClasses = [...editEntryForm.classes];
                                    newClasses[index].endTime = e.target.value;
                                    setEditEntryForm((f) => ({ ...f, classes: newClasses }));
                                  }}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                  required
                                />
                              </div>
                            </div>
                            {cls.startTime && cls.endTime && (
                              <div className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                Duration: {calculateDuration(cls.startTime, cls.endTime)} minutes
                              </div>
                            )}
                            <div>
                              <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                                Notes
                              </label>
                              <textarea
                                value={cls.notes}
                                onChange={(e) => {
                                  const newClasses = [...editEntryForm.classes];
                                  newClasses[index].notes = e.target.value;
                                  setEditEntryForm((f) => ({ ...f, classes: newClasses }));
                                }}
                                rows={2}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                placeholder="Optional notes about the class"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div>
                  <label htmlFor="edit-entry-remarks" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Remarks
                  </label>
                  <textarea
                    id="edit-entry-remarks"
                    value={editEntryForm.remarks}
                    onChange={(e) => setEditEntryForm((f) => ({ ...f, remarks: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="Optional remarks about the day"
                  />
                </div>
              </div>
              <div className="flex-shrink-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={() => {
                    setEditEntryModalOpen(false);
                    setEditEntryForm({
                      entryId: null,
                      date: new Date().toISOString().slice(0, 10),
                      isPresent: true,
                      remarks: "",
                      classes: [],
                    });
                    setEditEntryError(null);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editEntrySubmitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  {editEntrySubmitting ? "Updating…" : "Update entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Entry Modal */}
      {deleteEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Remove Entry
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Select a date to view and remove entries
              </p>
            </div>
            
            <div className="space-y-4 p-6">
              {deleteEntryError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {deleteEntryError}
                </div>
              )}
              
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={deleteEntryDate}
                  onChange={async (e) => {
                    const date = e.target.value;
                    setDeleteEntryDate(date);
                    await loadEntriesForDate(date);
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
              </div>
              
              {deleteEntryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
                    <span>Loading entries…</span>
                  </div>
                </div>
              ) : deleteEntryList.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No entries found for this date.
                </p>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Entries for {formatDate(deleteEntryDate)}
                  </h4>
                  <ul className="space-y-2">
                    {deleteEntryList.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${entry.isPresent ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              {entry.isPresent ? 'Present' : 'Absent'}
                            </span>
                            {entry.remarks && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                • {entry.remarks}
                              </span>
                            )}
                          </div>
                          {entry.classes?.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {entry.classes.map((c) => (
                                <span
                                  key={c.id}
                                  className="text-xs text-gray-600 dark:text-gray-400"
                                >
                                  {c.batch?.name} / {c.subject?.name} ({c.duration}m)
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(entry.id)}
                          disabled={deletingEntryId === entry.id}
                          className="flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-600 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-gray-700"
                        >
                          {deletingEntryId === entry.id ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
                              <span>Removing…</span>
                            </>
                          ) : (
                            <>
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Remove</span>
                            </>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setDeleteEntryModalOpen(false);
                  setDeleteEntryDate(new Date().toISOString().slice(0, 10));
                  setDeleteEntryList([]);
                  setDeleteEntryError(null);
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreelanceFacultyPage;
