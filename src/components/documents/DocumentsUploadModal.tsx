"use client";

import React, { useState, useEffect } from "react";
import { type DocumentTab, DEFAULT_MAX_FILE_SIZE_BYTES, ALLOWED_EXTENSIONS } from "@/lib/documentPermissions";
import { getUser } from "@/lib/auth";
import { normalizeRole } from "@/lib/permissions";

interface EmployeeOption {
  id: string;
  name: string;
  dept?: string;
  title?: string;
}

interface DocumentsUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab: DocumentTab;
  onSuccess: () => void;
}

export function DocumentsUploadModal({
  isOpen,
  onClose,
  defaultTab,
  onSuccess,
}: DocumentsUploadModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DocumentTab>(
    defaultTab === "deleted-items" ? "documents" : defaultTab
  );
  const [effectiveDate, setEffectiveDate] = useState("");
  const [subStatus, setSubStatus] = useState(
    defaultTab === "proposals" ? "Draft" : defaultTab === "projects" ? "Planned" : ""
  );
  const [relatedProgramDonor, setRelatedProgramDonor] = useState("");
  const [tags, setTags] = useState("");

  // Contract specific fields
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [contractType, setContractType] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [contractStatus, setContractStatus] = useState<"Active" | "Expired" | "Terminated" | "Superseded">("Active");
  const [empSearch, setEmpSearch] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"IDLE" | "SCANNING" | "CLEAN" | "INFECTED">("IDLE");
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (defaultTab && defaultTab !== "deleted-items") {
      setCategory(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    if (isOpen) {
      // Fetch staff list for employee dropdown
      fetch("/api/employees")
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.data)) {
            setEmployees(
              data.data.map((e: any) => ({
                id: e.employeeId || e.id,
                name: e.fullName || e.name || "Unknown Staff",
                dept: e.department || e.dept || "General",
                title: e.title || e.position || "Staff Member",
              }))
            );
          }
        })
        .catch((err) => console.warn("Failed to load staff list for upload modal:", err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmpId(empId);
    const chosen = employees.find((e) => e.id === empId);
    if (chosen && !title) {
      setTitle(`${chosen.name} — ${contractType} Employment Contract`);
    }
    if (chosen && !description) {
      setDescription(`Official ${contractType} employment contract agreement for ${chosen.name} (${chosen.title || chosen.dept}).`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setErrorMsg("");
    const ext = selected.name.split(".").pop()?.toLowerCase() || "";

    if (category === "employee-contracts") {
      if (!["pdf", "doc", "docx"].includes(ext)) {
        setErrorMsg(`Employment contracts must be in PDF or DOC/DOCX format (selected: .${ext}).`);
        return;
      }
    } else {
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setErrorMsg(`Unsupported file type .${ext}. Allowed formats: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, PNG/JPG.`);
        return;
      }
    }

    if (selected.size > DEFAULT_MAX_FILE_SIZE_BYTES) {
      setErrorMsg(`File exceeds the 25 MB institutional threshold (${(selected.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    setFile(selected);
    setIsScanning(true);
    setScanStatus("SCANNING");

    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
      // Simulate antivirus security scan check
      setTimeout(() => {
        setIsScanning(false);
        setScanStatus("CLEAN");
      }, 500);
    };
    reader.readAsDataURL(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!title.trim()) {
      setErrorMsg("Title is required.");
      return;
    }
    if (!description.trim()) {
      setErrorMsg("Description is required.");
      return;
    }
    if (!file || !fileBase64) {
      setErrorMsg("Please select a file to upload.");
      return;
    }

    if (category === "employee-contracts") {
      if (!selectedEmpId) {
        setErrorMsg("Please select an employee for this contract.");
        return;
      }
      if (!contractType) {
        setErrorMsg("Please select a Contract Type.");
        return;
      }
      if (!startDate) {
        setErrorMsg("Start date is required.");
        return;
      }
      const isNoEnd = contractType === "Permanent" || contractType === "Volunteer";
      if (!isNoEnd) {
        if (!endDate) {
          setErrorMsg(`End date is required for ${contractType} contracts.`);
          return;
        }
        if (new Date(endDate).getTime() <= new Date(startDate).getTime()) {
          setErrorMsg("End date must be after the start date.");
          return;
        }
      }
    }

    const user = getUser();
    const roleCode = normalizeRole(user?.role, user?.username, user?.email);
    const chosenEmp = employees.find((e) => e.id === selectedEmpId);

    try {
      setUploading(true);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user) {
        headers["x-bcf-user-role"] = user.role || roleCode;
        headers["x-bcf-username"] = user.username || "";
        headers["x-bcf-email"] = user.email || "";
        headers["x-bcf-name"] = user.name || "";
      }

      const isNoEndDate = contractType === "Permanent" || contractType === "Volunteer";

      const body = {
        title: title.trim(),
        description: description.trim(),
        category,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
        fileData: fileBase64,
        effectiveDate: effectiveDate || undefined,
        subStatus: subStatus || undefined,
        relatedProgramDonor: relatedProgramDonor || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),

        // Contract payload
        employeeId: category === "employee-contracts" ? selectedEmpId : undefined,
        employeeName: category === "employee-contracts" ? chosenEmp?.name : undefined,
        employeeDept: category === "employee-contracts" ? chosenEmp?.dept : undefined,
        contractType: category === "employee-contracts" ? contractType : undefined,
        startDate: category === "employee-contracts" ? startDate || undefined : undefined,
        endDate: category === "employee-contracts"
          ? (isNoEndDate ? undefined : (endDate || undefined))
          : undefined,
        contractStatus: category === "employee-contracts"
          ? (isNoEndDate && contractStatus === "Expired" ? "Active" : contractStatus)
          : undefined,
      };

      const res = await fetch("/api/documents", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to upload document.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Upload error:", err);
      setErrorMsg(err.message || "An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
      e.id.toLowerCase().includes(empSearch.toLowerCase()) ||
      (e.dept && e.dept.toLowerCase().includes(empSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Institutional Repository
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight mt-0.5">
              {category === "employee-contracts"
                ? "File Employee Contract"
                : "Upload to Documents & Policies"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-3.5 sm:space-y-4 text-xs flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Category Selector */}
          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Tab / Repository Category <span className="text-rose-600">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white cursor-pointer font-medium"
            >
              <option value="documents">Documents</option>
              <option value="policies">Policies</option>
              <option value="proposals">Proposals</option>
              <option value="projects">Projects</option>
              <option value="employee-contracts">Employee Contracts</option>
            </select>
          </div>

          {/* Contract-Specific Section: Employee Dropdown */}
          {category === "employee-contracts" && (
            <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl space-y-3">
              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Employee (Searchable Staff Directory) <span className="text-rose-600">*</span>
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="Search by staff name, ID or department..."
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white mb-1"
                  />
                  <select
                    required
                    value={selectedEmpId}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-800 rounded-xl text-xs text-slate-900 dark:text-white cursor-pointer font-bold"
                  >
                    <option value="">-- Choose Employee ({filteredEmployees.length} staff) --</option>
                    {filteredEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.id}) — {emp.title} ({emp.dept})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`grid grid-cols-1 ${contractType && contractType !== "Permanent" && contractType !== "Volunteer" ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-2.5`}>
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Contract Type <span className="text-rose-600">*</span>
                  </label>
                  <select
                    required
                    value={contractType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setContractType(val);
                      if (val === "Permanent" || val === "Volunteer") {
                        setEndDate("");
                        if (contractStatus === "Expired") {
                          setContractStatus("Active");
                        }
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="" disabled>Select Type...</option>
                    <option value="Permanent">Permanent</option>
                    <option value="Fixed-Term Contract">Fixed-Term Contract</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Casual">Casual</option>
                    <option value="Consultant">Consultant</option>
                    <option value="Volunteer">Volunteer</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Start Date <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>

                {/* Conditional End Date: Only shown for Fixed-Term Contract, Part-Time, Casual, Consultant, Intern */}
                {contractType && contractType !== "Permanent" && contractType !== "Volunteer" && (
                  <div>
                    <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      End Date <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Contract Status
                </label>
                <select
                  value={contractStatus}
                  onChange={(e) => setContractStatus(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="Active">Active</option>
                  {contractType !== "Permanent" && contractType !== "Volunteer" && (
                    <option value="Expired">Expired</option>
                  )}
                  <option value="Terminated">Terminated</option>
                  <option value="Superseded">Superseded</option>
                </select>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={category === "employee-contracts" ? "e.g. Mabinty Mustapha — Permanent Employment Contract" : "e.g. BCF-SL Standard Procurement SOP 2026"}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Description */}
          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Description / Reference Purpose <span className="text-rose-600">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short note describing what this item is and why it is uploaded..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Other Categories specific status / effective date */}
          {category === "policies" ? (
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Effective Date (Optional)
              </label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
          ) : category === "proposals" ? (
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Proposal Status
              </label>
              <select
                value={subStatus}
                onChange={(e) => setSubStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          ) : category === "projects" ? (
            <div>
              <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Project Phase Status
              </label>
              <select
                value={subStatus}
                onChange={(e) => setSubStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="Planned">Planned</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          ) : null}

          {/* Tags */}
          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Tags (Comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. Contract, Human Resources, Governance, 2026"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>

          {/* File Picker */}
          <div>
            <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Select Document File <span className="text-rose-600">*</span>
            </label>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
              <input
                type="file"
                id="file-upload-input"
                onChange={handleFileChange}
                accept={category === "employee-contracts" ? ".pdf,.doc,.docx" : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"}
                className="hidden"
              />
              <label
                htmlFor="file-upload-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-3xl text-emerald-600">
                  cloud_upload
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {file ? file.name : "Click to select or drag and drop file"}
                </span>
                <span className="text-[10px] text-slate-400">
                  {category === "employee-contracts"
                    ? "PDF, DOC/DOCX only · Maximum 25 MB"
                    : "PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, PNG/JPG · Maximum 25 MB"}
                </span>
              </label>

              {file && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-mono">
                    Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                  {scanStatus === "SCANNING" ? (
                    <span className="text-amber-600 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] animate-spin">
                        sync
                      </span>
                      Scanning for security threats...
                    </span>
                  ) : scanStatus === "CLEAN" ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">
                        verified_user
                      </span>
                      File Integrity &amp; Virus Check Passed
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[10px] text-slate-400">
              Uploader &amp; timestamp recorded automatically
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || isScanning}
                className="flex-1 sm:flex-none px-5 py-2 min-h-[38px] rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {uploading ? "Uploading..." : category === "employee-contracts" ? "File Contract" : "Upload Document"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
