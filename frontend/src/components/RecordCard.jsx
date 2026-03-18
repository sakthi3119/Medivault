import React, { useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext.jsx";
import { decryptArrayBufferToObjectUrl } from "../utils/e2ee";
import { typeBadge } from "../utils/recordTypes";

function formatDate(d) {
  const dt = d ? new Date(d) : null;
  if (!dt || Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function RecordCard({ record, onDelete, cipherEndpoint }) {
  const badge = useMemo(() => typeBadge(record?.type), [record?.type]);
  const { e2ee } = useAuth();
  const [opening, setOpening] = useState(false);

  async function onView() {
    if (!record) return;

    if (!record.isEncrypted) {
      window.open(record.fileUrl, "_blank", "noreferrer");
      return;
    }

    if (!e2ee?.privateKey) {
      alert("Encryption key is locked. Please log out and sign in again.");
      return;
    }

    setOpening(true);
    try {
      const endpoint =
        typeof cipherEndpoint === "function"
          ? cipherEndpoint(record._id)
          : cipherEndpoint || `/api/records/${record._id}/cipher`;
      const { data } = await api.get(endpoint, { responseType: "arraybuffer" });
      const objectUrl = await decryptArrayBufferToObjectUrl({
        ciphertext: data,
        encryptionIvB64: record.encryptionIv,
        wrappedKeyB64: record.wrappedKey,
        privateKey: e2ee.privateKey,
        mimeType: record.mimeType,
      });
      window.open(objectUrl, "_blank", "noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "Unable to open this file.");
    } finally {
      setOpening(false);
    }
  }

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
        <button
          type="button"
          onClick={onView}
          disabled={opening}
          className="rounded-xl border border-slate-700/70 bg-background/40 px-3 py-2 text-xs text-slate-200 hover:bg-background/60 disabled:opacity-60"
        >
          {opening ? "Opening…" : "View"}
        </button>
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

