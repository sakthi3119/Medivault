import React, { useMemo } from "react";
import { typeBadge } from "../utils/recordTypes";

function formatDate(d) {
  const dt = d ? new Date(d) : null;
  if (!dt || Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function RecordCard({ record, onDelete }) {
  const badge = useMemo(() => typeBadge(record?.type), [record?.type]);

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-800/70 bg-surface/30 p-5 shadow-glow">
      <div className="flex items-start justify-between gap-3">
        <div className={`inline-flex rounded-full border px-2 py-1 text-xs ${badge}`}>{record.type}</div>
        <div className="text-xs text-slate-400">{formatDate(record.recordDate)}</div>
      </div>

      <div className="mt-3">
        <div className="text-base font-semibold text-slate-100">{record.title}</div>
        <div className="mt-2 text-sm text-slate-300">
          {record.doctorName ? <div className="truncate">Dr. {record.doctorName}</div> : null}
          {record.hospitalName ? <div className="truncate text-slate-400">{record.hospitalName}</div> : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/70 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 p-4 opacity-0 transition group-hover:opacity-100">
        <a
          href={record.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-slate-700/70 bg-background/40 px-3 py-2 text-xs text-slate-200 hover:bg-background/60"
        >
          View
        </a>
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(record._id)}
            className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-rose-100 hover:bg-danger/15"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

