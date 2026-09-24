import React, { useState, useMemo } from "react";
import {
  Users,
  Edit3,
  X,
  Check,
  CheckCircle2,
  RotateCcw,
  Search,
  Sparkles,
  ArrowRight,
  FolderSync,
  Type,
  AlertTriangle,
  GraduationCap,
  Save,
  Plus,
  Trash2,
  FileSpreadsheet,
  CheckSquare,
  Square,
  MinusCircle,
  HelpCircle,
} from "lucide-react";
import { Student } from "../types";
import { generateUniqueStudentToken } from "../utils/barcodeUtils";

interface BulkEditStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  selectedStudentIds?: string[];
  currentFilteredClass?: string;
  availableClasses: string[];
  onSave: (payload: {
    updates: Array<{ id: string } & Partial<Student>>;
    newStudents: Array<Omit<Student, "id"> & { id?: string }>;
    deletedStudentIds: string[];
  }) => Promise<void> | void;
}

interface StudentEditDraft {
  id: string;
  isNew?: boolean;
  originalName: string;
  originalClassName: string;
  originalNisn: string;
  originalUsername: string;
  name: string;
  className: string;
  nisn: string;
  username: string;
  tokenPreview: string;
}

// Convert string to Title Case (Setiap kata berawalan huruf besar)
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const BulkEditStudentsModal: React.FC<BulkEditStudentsModalProps> = ({
  isOpen,
  onClose,
  students,
  selectedStudentIds = [],
  currentFilteredClass,
  availableClasses,
  onSave,
}) => {
  // Determine initial scope
  const [scope, setScope] = useState<"selected" | "class" | "all">(() => {
    if (selectedStudentIds.length > 0) return "selected";
    if (currentFilteredClass && currentFilteredClass !== "ALL") return "class";
    return "all";
  });

  // Students included based on scope
  const targetStudents = useMemo(() => {
    if (scope === "selected" && selectedStudentIds.length > 0) {
      const idSet = new Set(selectedStudentIds);
      return students.filter((s) => idSet.has(s.id));
    }
    if (scope === "class" && currentFilteredClass && currentFilteredClass !== "ALL") {
      const normalizedClass = (currentFilteredClass || "").trim().toLowerCase();
      return students.filter(
        (s) => (s.className || "").trim().toLowerCase() === normalizedClass
      );
    }
    return students;
  }, [students, scope, selectedStudentIds, currentFilteredClass]);

  // Working drafts of students being edited
  const [drafts, setDrafts] = useState<Record<string, StudentEditDraft>>({});
  // Track IDs marked for deletion in this session
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  // Track newly added student IDs
  const [newStudentIds, setNewStudentIds] = useState<string[]>([]);
  // Row selection inside this modal (for bulk action on rows, e.g. mass delete)
  const [modalSelectedRowIds, setModalSelectedRowIds] = useState<Set<string>>(new Set());

  // Quick Multi-Student Insert Drawer / Text Area
  const [showQuickAddDrawer, setShowQuickAddDrawer] = useState(false);
  const [quickAddClass, setQuickAddClass] = useState(
    currentFilteredClass && currentFilteredClass !== "ALL"
      ? currentFilteredClass
      : availableClasses[0] || "X"
  );
  const [quickAddText, setQuickAddText] = useState("");

  // Initialize drafts when targetStudents changes or modal opens
  React.useEffect(() => {
    const initialDrafts: Record<string, StudentEditDraft> = {};
    targetStudents.forEach((s) => {
      initialDrafts[s.id] = {
        id: s.id,
        isNew: false,
        originalName: s.name,
        originalClassName: s.className,
        originalNisn: s.nisn,
        originalUsername: s.username,
        name: s.name,
        className: s.className,
        nisn: s.nisn,
        username: s.username,
        tokenPreview: s.startBarcodeToken || generateUniqueStudentToken(s.className, s.nisn, s.id),
      };
    });
    setDrafts(initialDrafts);
    setDeletedIds(new Set());
    setNewStudentIds([]);
    setModalSelectedRowIds(new Set());
  }, [targetStudents, isOpen]);

  // Search & Filter state inside modal
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyShowModified, setOnlyShowModified] = useState(false);

  // Batch class change tool state
  const [batchTargetClass, setBatchTargetClass] = useState("");
  const [customTargetClass, setCustomTargetClass] = useState("");
  const [isCustomClassMode, setIsCustomClassMode] = useState(false);

  // Find & Replace tool state
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findReplaceField, setFindReplaceField] = useState<"name" | "className">("name");

  // Saving state & error
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Active drafts (excluding deleted ones)
  const activeDraftList = Object.values(drafts).filter((d) => !deletedIds.has(d.id));

  // Compute modified count (existing students modified + new students added + deleted)
  const modifiedExistingDraftList = activeDraftList.filter(
    (d) =>
      !d.isNew &&
      (d.name !== d.originalName ||
        d.className !== d.originalClassName ||
        d.nisn !== d.originalNisn ||
        d.username !== d.originalUsername)
  );

  const newDraftList = activeDraftList.filter((d) => d.isNew);
  const totalChangesCount =
    modifiedExistingDraftList.length + newDraftList.length + deletedIds.size;

  // Filtered list for display in table
  const displayedDrafts = activeDraftList.filter((d) => {
    const isModified =
      d.isNew ||
      d.name !== d.originalName ||
      d.className !== d.originalClassName ||
      d.nisn !== d.originalNisn ||
      d.username !== d.originalUsername;

    if (onlyShowModified && !isModified) return false;

    if (!(searchTerm || "").trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (d.name || "").toLowerCase().includes(term) ||
      (d.className || "").toLowerCase().includes(term) ||
      (d.nisn || "").toLowerCase().includes(term) ||
      (d.username || "").toLowerCase().includes(term)
    );
  });

  // Handler for single row edit
  const handleUpdateRow = (id: string, updates: Partial<StudentEditDraft>) => {
    setDrafts((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const updated = { ...current, ...updates };

      // Update token preview if class or nisn changed
      if (updates.className !== undefined || updates.nisn !== undefined) {
        updated.tokenPreview = generateUniqueStudentToken(
          updated.className,
          updated.nisn,
          updated.id
        );
      }

      return {
        ...prev,
        [id]: updated,
      };
    });
  };

  // Revert a single row to original
  const handleRevertRow = (id: string) => {
    setDrafts((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return {
        ...prev,
        [id]: {
          ...current,
          name: current.originalName,
          className: current.originalClassName,
          nisn: current.originalNisn,
          username: current.originalUsername,
          tokenPreview: generateUniqueStudentToken(
            current.originalClassName,
            current.originalNisn,
            current.id
          ),
        },
      };
    });
  };

  // Delete single row from draft
  const handleDeleteRow = (id: string) => {
    const draft = drafts[id];
    if (!draft) return;

    if (draft.isNew) {
      // Remove newly created draft entirely
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setNewStudentIds((prev) => prev.filter((i) => i !== id));
    } else {
      // Mark existing student for deletion
      setDeletedIds((prev) => new Set([...prev, id]));
    }

    setModalSelectedRowIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Bulk delete selected rows in modal
  const handleBulkDeleteInModal = () => {
    if (modalSelectedRowIds.size === 0) return;

    const idsToDelete = Array.from(modalSelectedRowIds);
    setDeletedIds((prev) => {
      const next = new Set(prev);
      idsToDelete.forEach((id) => {
        if (!drafts[id]?.isNew) {
          next.add(id);
        }
      });
      return next;
    });

    setDrafts((prev) => {
      const next = { ...prev };
      idsToDelete.forEach((id) => {
        if (next[id]?.isNew) {
          delete next[id];
        }
      });
      return next;
    });

    setNewStudentIds((prev) => prev.filter((id) => !modalSelectedRowIds.has(id)));
    setModalSelectedRowIds(new Set());
  };

  // Undo delete for a student
  const handleRestoreDeletedRow = (id: string) => {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Add a single new row directly to table
  const handleAddNewSingleRow = () => {
    const newId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const defaultClass =
      currentFilteredClass && currentFilteredClass !== "ALL"
        ? currentFilteredClass
        : availableClasses[0] || "X";
    const defaultNisn = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const newDraft: StudentEditDraft = {
      id: newId,
      isNew: true,
      originalName: "",
      originalClassName: defaultClass,
      originalNisn: defaultNisn,
      originalUsername: defaultNisn,
      name: "",
      className: defaultClass,
      nisn: defaultNisn,
      username: defaultNisn,
      tokenPreview: generateUniqueStudentToken(defaultClass, defaultNisn, newId),
    };

    setDrafts((prev) => ({
      ...prev,
      [newId]: newDraft,
    }));
    setNewStudentIds((prev) => [...prev, newId]);
  };

  // Quick Bulk Add Students via multi-line text (Nama or Nama,NISN)
  const handleApplyQuickAdd = () => {
    const lines = quickAddText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setErrorMessage("Silakan masukkan minimal 1 baris nama siswa untuk ditambahkan.");
      return;
    }

    const targetClass = quickAddClass.trim() || "X";
    const addedIds: string[] = [];
    const newDraftsToAdd: Record<string, StudentEditDraft> = {};

    lines.forEach((line, index) => {
      const newId = `temp_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`;
      let parsedName = line;
      let parsedNisn = "";

      // Support comma or tab separated format: Nama, NISN or NISN, Nama
      if (line.includes(",") || line.includes("\t")) {
        const parts = line.split(/[,\t]+/).map((p) => p.trim());
        if (parts.length >= 2) {
          if (/^\d{5,}$/.test(parts[0])) {
            parsedNisn = parts[0];
            parsedName = parts[1];
          } else {
            parsedName = parts[0];
            parsedNisn = parts[1];
          }
        }
      }

      if (!parsedNisn) {
        parsedNisn = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      }

      newDraftsToAdd[newId] = {
        id: newId,
        isNew: true,
        originalName: "",
        originalClassName: targetClass,
        originalNisn: parsedNisn,
        originalUsername: parsedNisn,
        name: parsedName,
        className: targetClass,
        nisn: parsedNisn,
        username: parsedNisn,
        tokenPreview: generateUniqueStudentToken(targetClass, parsedNisn, newId),
      };
      addedIds.push(newId);
    });

    setDrafts((prev) => ({
      ...prev,
      ...newDraftsToAdd,
    }));
    setNewStudentIds((prev) => [...prev, ...addedIds]);
    setQuickAddText("");
    setShowQuickAddDrawer(false);
    setErrorMessage(null);
  };

  // Toggle select row in table
  const handleToggleSelectRow = (id: string) => {
    setModalSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle select all visible rows in table
  const handleToggleSelectAllVisible = () => {
    if (modalSelectedRowIds.size === displayedDrafts.length && displayedDrafts.length > 0) {
      setModalSelectedRowIds(new Set());
    } else {
      setModalSelectedRowIds(new Set(displayedDrafts.map((d) => d.id)));
    }
  };

  // Reset all drafts to original
  const handleResetAll = () => {
    const resetDrafts: Record<string, StudentEditDraft> = {};
    targetStudents.forEach((s) => {
      resetDrafts[s.id] = {
        id: s.id,
        isNew: false,
        originalName: s.name,
        originalClassName: s.className,
        originalNisn: s.nisn,
        originalUsername: s.username,
        name: s.name,
        className: s.className,
        nisn: s.nisn,
        username: s.username,
        tokenPreview: s.startBarcodeToken || generateUniqueStudentToken(s.className, s.nisn, s.id),
      };
    });
    setDrafts(resetDrafts);
    setDeletedIds(new Set());
    setNewStudentIds([]);
    setModalSelectedRowIds(new Set());
    setErrorMessage(null);
  };

  // Apply batch class change to all active students in scope (or selected rows)
  const handleApplyBatchClass = () => {
    const finalClass = (isCustomClassMode ? customTargetClass : batchTargetClass).trim();
    if (!finalClass) {
      setErrorMessage("Silakan pilih atau masukkan nama kelas tujuan yang valid.");
      return;
    }
    setErrorMessage(null);

    setDrafts((prev) => {
      const next = { ...prev };
      const targetIds =
        modalSelectedRowIds.size > 0
          ? Array.from(modalSelectedRowIds)
          : Object.keys(next).filter((id) => !deletedIds.has(id));

      targetIds.forEach((id) => {
        if (next[id]) {
          next[id] = {
            ...next[id],
            className: finalClass,
            tokenPreview: generateUniqueStudentToken(finalClass, next[id].nisn, id),
          };
        }
      });
      return next;
    });
  };

  // Transform names (Uppercase, Title Case, Trim Spaces)
  const handleFormatNames = (type: "uppercase" | "titlecase" | "trim") => {
    setDrafts((prev) => {
      const next = { ...prev };
      const targetIds =
        modalSelectedRowIds.size > 0
          ? Array.from(modalSelectedRowIds)
          : Object.keys(next).filter((id) => !deletedIds.has(id));

      targetIds.forEach((id) => {
        if (!next[id]) return;
        let newName = next[id].name;
        if (type === "uppercase") {
          newName = newName.toUpperCase();
        } else if (type === "titlecase") {
          newName = toTitleCase(newName);
        } else if (type === "trim") {
          newName = newName.replace(/\s+/g, " ").trim();
        }
        next[id] = {
          ...next[id],
          name: newName,
        };
      });
      return next;
    });
  };

  // Find & Replace in names or classes
  const handleApplyFindReplace = () => {
    if (!findText) return;
    setDrafts((prev) => {
      const next = { ...prev };
      const targetIds =
        modalSelectedRowIds.size > 0
          ? Array.from(modalSelectedRowIds)
          : Object.keys(next).filter((id) => !deletedIds.has(id));

      targetIds.forEach((id) => {
        if (!next[id]) return;
        if (findReplaceField === "name") {
          const newName = next[id].name.split(findText).join(replaceText);
          next[id] = { ...next[id], name: newName };
        } else {
          const newClass = (next[id].className || "").split(findText).join(replaceText).trim();
          next[id] = {
            ...next[id],
            className: newClass,
            tokenPreview: generateUniqueStudentToken(newClass, next[id].nisn, id),
          };
        }
      });
      return next;
    });
  };

  // Submit all modifications
  const handleSave = async () => {
    setErrorMessage(null);

    // Validate: no empty names or classes among active drafts
    for (const d of activeDraftList) {
      if (!(d.name || "").trim()) {
        setErrorMessage(`Nama siswa tidak boleh kosong (NISN: ${d.nisn || "-"}).`);
        return;
      }
      if (!(d.className || "").trim()) {
        setErrorMessage(`Nama kelas tidak boleh kosong untuk siswa "${d.name}".`);
        return;
      }
    }

    if (totalChangesCount === 0) {
      onClose();
      return;
    }

    const updates = modifiedExistingDraftList.map((d) => ({
      id: d.id,
      name: (d.name || "").trim(),
      className: (d.className || "").trim(),
      nisn: (d.nisn || "").trim(),
      username: (d.username || "").trim(),
      startBarcodeToken: d.tokenPreview,
    }));

    const newStudents: Array<Omit<Student, "id"> & { id?: string }> = newDraftList.map((d) => {
      const cleanNisn = (d.nisn || "").trim();
      const cleanUser = (d.username || "").trim();
      return {
        name: (d.name || "").trim(),
        className: (d.className || "").trim(),
        nisn: cleanNisn,
        username: cleanUser || cleanNisn,
        password: cleanNisn.slice(-6) || "123456",
        role: "siswa" as const,
        loginCount: 0,
        isLocked: false,
        examStatus: "not_started" as const,
        startBarcodeToken: d.tokenPreview,
        mcqScore: 0,
        essayScore: 0,
        totalScore: 0,
        answers: {},
        violationsCount: 0,
        violationsLog: [],
      };
    });

    const deletedStudentIds = Array.from(deletedIds);

    try {
      setIsSaving(true);
      await onSave({
        updates,
        newStudents,
        deletedStudentIds,
      });
      setIsSaving(false);
      onClose();
    } catch (err) {
      setIsSaving(false);
      setErrorMessage("Terjadi kesalahan saat menyimpan perubahan. Silakan coba kembali.");
    }
  };

  return (
    <div
      id="bulk-edit-students-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Edit, Tambah &amp; Hapus Massal Siswa
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {activeDraftList.length} Siswa Aktif
                </span>
                {newDraftList.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    +{newDraftList.length} Tambahan Baru
                  </span>
                )}
                {deletedIds.size > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    -{deletedIds.size} Akan Dihapus
                  </span>
                )}
                {modifiedExistingDraftList.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                    {modifiedExistingDraftList.length} Diubah
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Kelola nama, pindahkan kelas serentak, tambah rombel baru, atau hapus data siswa dalam spreadsheet cepat.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-bulk-edit-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Subheader / Scope Selection */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-semibold">Cakupan Siswa:</span>
            <div className="inline-flex rounded-xl p-0.5 bg-slate-900 border border-slate-800">
              {selectedStudentIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setScope("selected")}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    scope === "selected"
                      ? "bg-sky-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Siswa Dicentang ({selectedStudentIds.length})
                </button>
              )}

              {currentFilteredClass && currentFilteredClass !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setScope("class")}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    scope === "class"
                      ? "bg-sky-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Kelas {currentFilteredClass} (
                  {
                    students.filter(
                      (s) =>
                        (s.className || "").trim().toLowerCase() ===
                        (currentFilteredClass || "").trim().toLowerCase()
                    ).length
                  }
                  )
                </button>
              )}

              <button
                type="button"
                onClick={() => setScope("all")}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  scope === "all"
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Semua Siswa ({students.length})
              </button>
            </div>
          </div>

          {/* Quick Insert / Row Actions */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              id="add-single-row-btn"
              onClick={handleAddNewSingleRow}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
              title="Tambahkan 1 baris siswa baru ke tabel"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              <span>+ 1 Baris Siswa</span>
            </button>

            <button
              type="button"
              id="open-quick-add-drawer-btn"
              onClick={() => setShowQuickAddDrawer(!showQuickAddDrawer)}
              className="px-2.5 py-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
              title="Tempel teks nama-nama siswa untuk dimasukkan serentak"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Tambah Massal (Ketik / Tempel)</span>
            </button>
          </div>
        </div>

        {/* Quick Add Multi-Student Drawer */}
        {showQuickAddDrawer && (
          <div className="p-4 bg-slate-950 border-b border-emerald-500/30 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                  <FileSpreadsheet className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold text-white">
                  Tambah Siswa Massal Cepat (Tempel dari Excel / Word / Catatan)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddDrawer(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Tutup
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-1 space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Pilih / Ketik Kelas Tujuan:
                </label>
                <input
                  type="text"
                  list="quick-add-classes-list"
                  value={quickAddClass}
                  onChange={(e) => setQuickAddClass(e.target.value)}
                  placeholder="Contoh: XII TKJ 1"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <datalist id="quick-add-classes-list">
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls} />
                  ))}
                </datalist>
                <p className="text-[10px] text-slate-500 pt-1">
                  Format baris teks: <code>Nama Siswa</code> atau <code>Nama Siswa, NISN</code>
                </p>
              </div>

              <div className="md:col-span-3 space-y-2">
                <textarea
                  value={quickAddText}
                  onChange={(e) => setQuickAddText(e.target.value)}
                  rows={4}
                  placeholder={`Contoh tempel:\nAHMAD FAUZI\nBELLA SAFIRA, 1234567890\nCINTA LAURA, 9876543210\nDIAN SASTRO`}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed"
                />

                <div className="flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setQuickAddText("")}
                    className="px-3 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Bersihkan
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyQuickAdd}
                    disabled={!quickAddText.trim()}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-1.5 shadow transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Masukkan ke Tabel Editor</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar: Batch Operations & Format Tools */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border-b border-slate-800 space-y-3">
          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* Action 1: Batch Move Class (Left 7 Cols) */}
            <div className="lg:col-span-7 p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-sky-300">
                  <FolderSync className="w-4 h-4 text-sky-400" />
                  <span>
                    Pindahkan / Ganti Kelas Bersama{" "}
                    {modalSelectedRowIds.size > 0
                      ? `(${modalSelectedRowIds.size} Baris Terpilih)`
                      : `(Semua ${activeDraftList.length} Siswa)`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomClassMode(!isCustomClassMode)}
                  className="text-[11px] text-slate-400 hover:text-sky-300 underline cursor-pointer"
                >
                  {isCustomClassMode ? "Pilih dari daftar kelas" : "Ketik kelas baru"}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {!isCustomClassMode ? (
                  <select
                    id="batch-class-select"
                    value={batchTargetClass}
                    onChange={(e) => setBatchTargetClass(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="">-- Pilih Kelas Tujuan --</option>
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    id="batch-custom-class-input"
                    value={customTargetClass}
                    onChange={(e) => setCustomTargetClass(e.target.value)}
                    placeholder="Contoh: XII PSP 1, X TKJ 2..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                )}

                <button
                  type="button"
                  id="apply-batch-class-btn"
                  onClick={handleApplyBatchClass}
                  disabled={!batchTargetClass && !customTargetClass}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow transition cursor-pointer shrink-0"
                >
                  <span>
                    Terapkan{" "}
                    {modalSelectedRowIds.size > 0
                      ? `(${modalSelectedRowIds.size} Baris)`
                      : `(${activeDraftList.length} Siswa)`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Action 2: Batch Name Typography Formatter (Right 5 Cols) */}
            <div className="lg:col-span-5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <div className="flex items-center space-x-1.5">
                  <Type className="w-4 h-4 text-emerald-400" />
                  <span>Format Nama Siswa Massal</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFindReplace(!showFindReplace)}
                  className="text-[11px] text-slate-400 hover:text-emerald-300 underline cursor-pointer"
                >
                  {showFindReplace ? "Tutup Cari/Ganti" : "Cari & Ganti"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleFormatNames("uppercase")}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] transition cursor-pointer border border-slate-700"
                  title="Ubah semua nama siswa menjadi HURUF BESAR (KAPITAL)"
                >
                  KAPITAL SEMUA
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatNames("titlecase")}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] transition cursor-pointer border border-slate-700"
                  title="Ubah huruf pertama setiap kata menjadi huruf besar"
                >
                  Kapital Tiap Kata
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatNames("trim")}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] transition cursor-pointer border border-slate-700"
                  title="Hapus spasi ganda dan spasi di awal/akhir nama"
                >
                  Rapikan Spasi
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Find & Replace Strip */}
          {showFindReplace && (
            <div className="p-3 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex flex-wrap items-center gap-2 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
              <span className="text-emerald-400 font-bold shrink-0">Cari &amp; Ganti:</span>
              <input
                type="text"
                placeholder="Kata yang dicari..."
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs w-36"
              />
              <span className="text-slate-500">&rarr;</span>
              <input
                type="text"
                placeholder="Ganti dengan..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs w-36"
              />
              <select
                value={findReplaceField}
                onChange={(e) => setFindReplaceField(e.target.value as "name" | "className")}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs"
              >
                <option value="name">Di Kolom Nama</option>
                <option value="className">Di Kolom Kelas</option>
              </select>
              <button
                type="button"
                onClick={handleApplyFindReplace}
                disabled={!findText}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer"
              >
                Terapkan Penggantian
              </button>
            </div>
          )}

          {/* Search, Filter & Bulk Row Actions Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center space-x-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari nama, kelas, atau NISN dalam editor ini..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Bulk Delete Selected Rows Button */}
              {modalSelectedRowIds.size > 0 && (
                <button
                  type="button"
                  id="bulk-delete-rows-in-modal-btn"
                  onClick={handleBulkDeleteInModal}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow transition cursor-pointer shrink-0 animate-pulse"
                  title="Hapus baris-baris siswa yang Anda centang di tabel ini"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Terpilih ({modalSelectedRowIds.size})</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <label className="flex items-center space-x-1.5 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyShowModified}
                  onChange={(e) => setOnlyShowModified(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 focus:ring-offset-0"
                />
                <span>Hanya Tampilkan Yang Diubah ({totalChangesCount})</span>
              </label>

              <span className="text-slate-600">|</span>

              <span className="text-slate-400 font-mono">
                Menampilkan {displayedDrafts.length} siswa
              </span>
            </div>
          </div>
        </div>

        {/* Deleted Students Restore Banner */}
        {deletedIds.size > 0 && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>{deletedIds.size} siswa ditandai untuk dihapus</strong> saat Anda menekan Simpan Perubahan.
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setDeletedIds(new Set())}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-[11px] transition cursor-pointer"
              >
                Batalkan Penghapusan Semua Siswa
              </button>
            </div>
          </div>
        )}

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white font-bold px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Interactive Multi-Row Table Editor */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllVisible}
                      className="text-slate-400 hover:text-white transition cursor-pointer"
                      title="Pilih / Batalkan semua baris yang tampil"
                    >
                      {modalSelectedRowIds.size === displayedDrafts.length && displayedDrafts.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3 min-w-[200px]">
                    Nama Siswa <span className="text-rose-400">*</span>
                  </th>
                  <th className="p-3 w-48 min-w-[160px]">
                    Kelas <span className="text-rose-400">*</span>
                  </th>
                  <th className="p-3 w-36">NISN</th>
                  <th className="p-3 w-36">Username</th>
                  <th className="p-3 w-36">Token Barcode</th>
                  <th className="p-3 w-28 text-center">Status</th>
                  <th className="p-3 w-20 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {displayedDrafts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      {onlyShowModified
                        ? "Belum ada siswa yang mengalami perubahan data."
                        : "Tidak ada siswa yang sesuai dengan filter pencarian."}
                    </td>
                  </tr>
                ) : (
                  displayedDrafts.map((d, index) => {
                    const isNameModified = d.name !== d.originalName;
                    const isClassModified = d.className !== d.originalClassName;
                    const isNisnModified = d.nisn !== d.originalNisn;
                    const isUserModified = d.username !== d.originalUsername;
                    const isModified =
                      d.isNew || isNameModified || isClassModified || isNisnModified || isUserModified;
                    const isRowSelected = modalSelectedRowIds.has(d.id);

                    return (
                      <tr
                        key={d.id}
                        className={`transition hover:bg-slate-800/30 ${
                          isRowSelected
                            ? "bg-sky-950/25 border-l-2 border-l-sky-500"
                            : d.isNew
                            ? "bg-emerald-950/15"
                            : isModified
                            ? "bg-amber-950/15"
                            : ""
                        }`}
                      >
                        {/* Row Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isRowSelected}
                            onChange={() => handleToggleSelectRow(d.id)}
                            className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                        </td>

                        {/* Index */}
                        <td className="p-3 text-center text-slate-500 font-mono text-[11px]">
                          {index + 1}
                        </td>

                        {/* Nama Siswa Input */}
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={d.name}
                            onChange={(e) => handleUpdateRow(d.id, { name: e.target.value })}
                            className={`w-full bg-slate-900 border rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                              d.isNew
                                ? "border-emerald-500/70 focus:border-emerald-400 bg-emerald-950/20"
                                : isNameModified
                                ? "border-amber-500/70 focus:border-amber-400 bg-amber-950/20"
                                : "border-slate-700/80 focus:border-sky-500"
                            }`}
                            placeholder="Nama Lengkap Siswa"
                          />
                          {isNameModified && !d.isNew && (
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate pl-1">
                              Asal: <span className="line-through">{d.originalName}</span>
                            </div>
                          )}
                        </td>

                        {/* Kelas Input / Quick Dropdown */}
                        <td className="p-2.5">
                          <div className="relative">
                            <input
                              type="text"
                              value={d.className}
                              onChange={(e) =>
                                handleUpdateRow(d.id, { className: e.target.value })
                              }
                              list={`class-options-${d.id}`}
                              className={`w-full bg-slate-900 border rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition ${
                                d.isNew
                                  ? "border-emerald-500/70 focus:border-emerald-400 bg-emerald-950/20"
                                  : isClassModified
                                  ? "border-amber-500/70 focus:border-amber-400 bg-amber-950/20"
                                  : "border-slate-700/80 focus:border-sky-500"
                              }`}
                              placeholder="Pilih / Ketik Kelas"
                            />
                            <datalist id={`class-options-${d.id}`}>
                              {availableClasses.map((cls) => (
                                <option key={cls} value={cls} />
                              ))}
                            </datalist>
                          </div>
                          {isClassModified && !d.isNew && (
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate pl-1">
                              Asal: <span className="line-through">{d.originalClassName}</span>
                            </div>
                          )}
                        </td>

                        {/* NISN */}
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={d.nisn}
                            onChange={(e) => handleUpdateRow(d.id, { nisn: e.target.value })}
                            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-sky-500"
                          />
                        </td>

                        {/* Username */}
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={d.username}
                            onChange={(e) =>
                              handleUpdateRow(d.id, { username: e.target.value })
                            }
                            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-sky-500"
                          />
                        </td>

                        {/* Token Preview */}
                        <td className="p-2.5">
                          <span className="font-mono text-[11px] text-cyan-400 bg-slate-950 px-2 py-1 rounded-lg border border-cyan-500/20 block truncate">
                            {d.tokenPreview}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-2.5 text-center">
                          {d.isNew ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              Baru
                            </span>
                          ) : isModified ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Diubah
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                              Sama
                            </span>
                          )}
                        </td>

                        {/* Row Actions: Revert & Delete */}
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            {isModified && !d.isNew && (
                              <button
                                type="button"
                                onClick={() => handleRevertRow(d.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                                title="Kembalikan data siswa ini ke nilai awal"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteRow(d.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                              title={d.isNew ? "Batalkan penambahan baris ini" : "Tandai untuk dihapus"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-xs">
            {totalChangesCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-amber-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>
                  Ringkasan: {modifiedExistingDraftList.length} diubah
                  {newDraftList.length > 0 ? `, +${newDraftList.length} baru` : ""}
                  {deletedIds.size > 0 ? `, -${deletedIds.size} dihapus` : ""}.
                </span>
              </div>
            ) : (
              <span className="text-slate-400">
                Belum ada data siswa yang diubah, ditambah, atau dihapus.
              </span>
            )}

            {totalChangesCount > 0 && (
              <button
                type="button"
                onClick={handleResetAll}
                className="text-xs text-slate-400 hover:text-rose-300 underline cursor-pointer"
              >
                Batalkan Semua Perubahan
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              id="save-bulk-edit-btn"
              onClick={handleSave}
              disabled={isSaving || totalChangesCount === 0}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-sky-600/30 transition cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan Perubahan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>
                    Simpan Perubahan {totalChangesCount > 0 ? `(${totalChangesCount})` : ""}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
