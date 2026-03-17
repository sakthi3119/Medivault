import React, { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { RECORD_TYPES } from "../utils/recordTypes";

function ModalShell({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 md:items-center" onMouseDown={onClose}>
      <div
        className="w-full max-w-2xl rounded-3xl border border-slate-700/60 bg-surface shadow-glow"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function DropZone({ file, setFile, error }) {
  const inputRef = useRef(null);

  function onPick() {
    inputRef.current?.click();
  }

  function onChange(e) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  function onDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  return (
    <div>
      <input ref={inputRef} type="file" className="hidden" onChange={onChange} accept="application/pdf,image/jpeg,image/png,.docx" />
      <div
        onClick={onPick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="cursor-pointer rounded-3xl border border-dashed border-slate-600/80 bg-background/30 px-5 py-6 text-center hover:border-accent/50"
      >
        <div className="text-sm text-slate-200">{file ? file.name : "Drag & drop a PDF/image/DOCX here"}</div>
        <div className="mt-1 text-xs text-slate-400">Max 10MB • Stored securely on Cloudinary</div>
      </div>
      {error ? <div className="mt-2 text-xs text-danger">{error}</div> : null}
    </div>
  );
}

export function UploadModal({ open, onClose, onUpload }) {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: "",
      type: "Lab Report",
      description: "",
      doctorName: "",
      hospitalName: "",
      recordDate: new Date().toISOString().slice(0, 10),
      tags: "",
    },
  });

  const fileError = useMemo(() => (open && !file ? "File is required." : ""), [open, file]);

  async function submit(values) {
    setServerError("");
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", values.title);
    fd.append("type", values.type);
    fd.append("description", values.description || "");
    fd.append("doctorName", values.doctorName || "");
    fd.append("hospitalName", values.hospitalName || "");
    fd.append("recordDate", values.recordDate);
    fd.append("tags", values.tags || "");

    const res = await onUpload(fd, (evt) => {
      if (!evt.total) return;
      setProgress(Math.round((evt.loaded / evt.total) * 100));
    });

    if (!res.ok) return setServerError(res.message);
    reset();
    setFile(null);
    setProgress(0);
    onClose();
  }

  function closeAndReset() {
    setServerError("");
    setProgress(0);
    onClose();
  }

  return (
    <ModalShell open={open} onClose={closeAndReset}>
      <div className="flex items-center justify-between border-b border-slate-700/60 px-6 py-4">
        <div>
          <div className="font-heading text-2xl italic">Upload record</div>
          <div className="text-xs text-slate-400">Add a new file to your vault</div>
        </div>
        <button onClick={closeAndReset} className="rounded-xl border border-slate-700/70 bg-background/30 px-3 py-2 text-xs text-slate-200 hover:bg-background/50">
          Close
        </button>
      </div>

      <form onSubmit={handleSubmit(submit)} className="space-y-4 px-6 py-5">
        {serverError ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-100">{serverError}</div>
        ) : null}

        <DropZone file={file} setFile={setFile} error={fileError} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-slate-200">Title</label>
            <input className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/40 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30" {...register("title", { required: "Title is required" })} />
            {errors.title ? <div className="mt-1 text-xs text-danger">{errors.title.message}</div> : null}
          </div>
          <div>
            <label className="text-sm text-slate-200">Type</label>
            <select className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/40 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30" {...register("type", { required: true })}>
              {RECORD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-200">Record date</label>
            <input type="date" className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/40 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30" {...register("recordDate", { required: "Record date is required" })} />
            {errors.recordDate ? <div className="mt-1 text-xs text-danger">{errors.recordDate.message}</div> : null}
          </div>
          <div>
            <label className="text-sm text-slate-200">Tags</label>
            <input className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/40 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30" placeholder="diabetes, bloodwork" {...register("tags")} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-slate-200">Doctor name</label>
            <input className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/40 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30" placeholder="S. Kumar" {...register("doctorName")} />
          </div>
          <div>
            <label className="text-sm text-slate-200">Hospital / Clinic</label>
            <input className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/40 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30" placeholder="City Care Hospital" {...register("hospitalName")} />
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-200">Description</label>
          <textarea rows={3} className="mt-2 w-full resize-none rounded-2xl border border-slate-700/70 bg-background/40 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30" {...register("description")} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-slate-400">{progress ? `Uploading… ${progress}%` : " "}</div>
          <button className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/90" type="submit">
            Upload
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

