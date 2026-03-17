import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import { RecordCard } from "../components/RecordCard.jsx";

function msToParts(ms) {
  const s = Math.max(Math.floor(ms / 1000), 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return { h, m, sec };
}

export default function SharedView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/api/access/shared/${token}`, { headers: { Authorization: undefined } });
        setData(res.data);
      } catch (err) {
        setError(err?.response?.data?.message || "Unable to open this share link.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const expiresAt = data?.token?.expiresAt ? new Date(data.token.expiresAt).getTime() : 0;
  const remainingMs = expiresAt ? expiresAt - now : 0;
  const remaining = useMemo(() => msToParts(remainingMs), [remainingMs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-5xl text-sm text-slate-300">Loading shared records…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800/70 bg-surface/20 p-6 shadow-glow">
          <div className="font-heading text-3xl italic">Link unavailable</div>
          <div className="mt-2 text-sm text-slate-300">{error}</div>
          <div className="mt-6 rounded-2xl border border-slate-800/70 bg-background/25 px-4 py-3 text-xs text-slate-400">
            Tip: ask the patient to generate a new share link.
          </div>
        </div>
      </div>
    );
  }

  const patientName = data?.patient?.name || "Patient";
  const records = data?.records || [];
  const expired = remainingMs <= 0;

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-800/70 bg-surface/20 p-6 shadow-glow">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-heading text-3xl italic">Shared records</div>
              <div className="mt-1 text-sm text-slate-300">
                Viewing <span className="font-semibold text-slate-100">{patientName}</span>’s records (read-only).
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-background/25 px-4 py-3 text-sm">
              {expired ? (
                <span className="text-amber-200">Access expired</span>
              ) : (
                <span className="text-slate-200">
                  Expires in{" "}
                  <span className="font-semibold text-accent">
                    {remaining.h}h {remaining.m}m {remaining.sec}s
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {records.map((r) => (
            <RecordCard key={r._id} record={r} onDelete={null} />
          ))}
        </div>

        {records.length === 0 ? <div className="text-sm text-slate-300">No records shared.</div> : null}
      </div>
    </div>
  );
}

