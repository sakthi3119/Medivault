import React, { useEffect, useMemo, useState } from "react";
import { UploadModal } from "../components/UploadModal.jsx";
import { RecordCard } from "../components/RecordCard.jsx";
import { useRecords } from "../hooks/useRecords";
import { RECORD_TYPES } from "../utils/recordTypes";

function StatPill({ label, value }) {
  return (
    <div className="rounded-3xl border border-slate-800/70 bg-surface/30 px-5 py-4 shadow-glow">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function Dashboard() {
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

