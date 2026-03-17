import React, { useEffect, useMemo, useState } from "react";
import { UploadModal } from "../components/UploadModal.jsx";
import { RecordCard } from "../components/RecordCard.jsx";
import { useRecords } from "../hooks/useRecords";
import { RECORD_TYPES } from "../utils/recordTypes";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/axios";

function StatPill({ label, value }) {
  return (
    <div className="rounded-3xl border border-slate-800/70 bg-surface/30 px-5 py-4 shadow-glow">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "doctor") return <DoctorDashboard />;
  return <PatientDashboard />;
}

function DoctorDashboard() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/api/access/assigned");
        setTokens(data.tokens || []);
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to load assigned links.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800/70 bg-surface/20 p-6 shadow-glow">
        <div className="font-heading text-3xl italic">Doctor dashboard</div>
        <div className="mt-2 text-sm text-slate-300">Share links assigned to you (active only).</div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}

        {loading ? <div className="mt-4 text-sm text-slate-300">Loading…</div> : null}

        {!loading && tokens.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-800/70 bg-background/25 px-4 py-3 text-sm text-slate-300">
            No active links yet. Ask a patient to share records with you.
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {tokens.map((t) => {
            const url = `/shared/${t.token}`;
            const patientName = t.patient?.name ? String(t.patient.name).split(/\s+/)[0] : "Patient";
            const expires = t.expiresAt ? new Date(t.expiresAt).toLocaleString() : "—";
            const count = t.allRecords ? "All records" : `${t.recordIds?.length || 0} record(s)`;
            return (
              <div key={t._id} className="rounded-2xl border border-slate-800/70 bg-background/25 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100">{t.label || `Shared by ${patientName}`}</div>
                    <div className="mt-1 text-xs text-slate-400">Expires: {expires}</div>
                    <div className="mt-1 text-xs text-slate-500">{count}</div>
                  </div>
                  <a
                    href={url}
                    className="rounded-xl border border-slate-700/70 bg-background/40 px-3 py-2 text-xs text-slate-200 hover:bg-background/60"
                  >
                    Open
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PatientDashboard() {
  const [type, setType] = useState("All");
  const [search, setSearch] = useState("");
  const [page] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, breakdown: [] });

  const { items, loading, error, fetchRecords, createRecord, deleteRecord, fetchStats } = useRecords({
    type,
    search,
    page,
    limit: 12,
  });

  useEffect(() => {
    (async () => {
      const res = await fetchStats();
      if (!res.ok) return;
      const breakdown = res.data.byType || [];
      const total = breakdown.reduce((sum, x) => sum + x.count, 0);
      setStats({ total, breakdown });
    })();
  }, [fetchStats]);

  const topBreakdown = useMemo(() => (stats.breakdown || []).slice(0, 4), [stats.breakdown]);

  async function onUpload(fd, onUploadProgress) {
    const res = await createRecord(fd, onUploadProgress);
    if (res.ok) {
      await fetchRecords();
      const s = await fetchStats();
      if (s.ok) {
        const breakdown = s.data.byType || [];
        const total = breakdown.reduce((sum, x) => sum + x.count, 0);
        setStats({ total, breakdown });
      }
    }
    return res;
  }

  async function onDelete(id) {
    const res = await deleteRecord(id);
    if (res.ok) {
      await fetchRecords();
      const s = await fetchStats();
      if (s.ok) {
        const breakdown = s.data.byType || [];
        const total = breakdown.reduce((sum, x) => sum + x.count, 0);
        setStats({ total, breakdown });
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatPill label="Total Records" value={stats.total} />
        <div className="md:col-span-2 rounded-3xl border border-slate-800/70 bg-surface/30 p-5 shadow-glow">
          <div className="text-xs text-slate-400">Record types</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {topBreakdown.length ? (
              topBreakdown.map((b) => (
                <div key={b.type} className="rounded-full border border-slate-700/60 bg-background/25 px-3 py-1 text-xs text-slate-200">
                  <span className="text-slate-400">{b.type}</span> <span className="font-semibold">· {b.count}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-300">No records yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-800/70 bg-surface/20 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {["All", ...RECORD_TYPES].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                type === t
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-slate-700/70 bg-background/30 text-slate-200 hover:bg-background/45"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, doctor, hospital, tags…"
            className="w-full min-w-[240px] rounded-2xl border border-slate-700/70 bg-background/35 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30 md:w-[340px]"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}

      {loading ? <div className="text-sm text-slate-300">Loading records…</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <RecordCard key={r._id} record={r} onDelete={onDelete} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-slate-900 shadow-glow hover:brightness-110"
        aria-label="Upload record"
      >
        <span className="text-3xl leading-none">+</span>
      </button>

      <UploadModal open={modalOpen} onClose={() => setModalOpen(false)} onUpload={onUpload} />
    </div>
  );
}

