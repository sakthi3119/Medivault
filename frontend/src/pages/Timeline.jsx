import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRecords } from "../hooks/useRecords";
import { typeBadge } from "../utils/recordTypes";

function monthName(m) {
  return new Date(2020, m - 1, 1).toLocaleString(undefined, { month: "long" });
}

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, visible };
}

function Node({ record }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={`relative pl-8 transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
      <div className="absolute left-[7px] top-[6px] h-3 w-3 rounded-full border border-slate-800 bg-background" />
      <div className={`absolute left-1 top-0 h-full w-[2px] bg-slate-700/60`} />
      <div className="rounded-3xl border border-slate-800/70 bg-surface/30 p-4 shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`inline-flex rounded-full border px-2 py-1 text-xs ${typeBadge(record.type)}`}>{record.type}</div>
          <div className="text-xs text-slate-400">
            {new Date(record.recordDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })}
          </div>
        </div>
        <div className="mt-2 font-semibold">{record.title}</div>
        <div className="mt-1 text-sm text-slate-300">
          {record.doctorName ? <span>Dr. {record.doctorName}</span> : null}
          {record.doctorName && record.hospitalName ? <span className="text-slate-500"> • </span> : null}
          {record.hospitalName ? <span className="text-slate-400">{record.hospitalName}</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function Timeline() {
  const { fetchTimeline } = useRecords();
  const [timeline, setTimeline] = useState([]);
  const [openYears, setOpenYears] = useState(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      const res = await fetchTimeline();
      if (!res.ok) {
        setError(res.message);
        setLoading(false);
        return;
      }
      const list = res.data.timeline || [];
      setTimeline(list);
      setOpenYears(new Set(list.map((y) => y.year)));
      setLoading(false);
    })();
  }, [fetchTimeline]);

  const years = useMemo(() => timeline || [], [timeline]);

  function toggleYear(year) {
    setOpenYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  if (loading) return <div className="text-sm text-slate-300">Loading timeline…</div>;
  if (error) return <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-100">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="font-heading text-3xl italic">Timeline</div>
        <div className="mt-1 text-sm text-slate-300">A chronological view of your records.</div>
      </div>

      {years.length === 0 ? <div className="text-sm text-slate-300">No records yet.</div> : null}

      <div className="space-y-5">
        {years.map((y) => {
          const isOpen = openYears.has(y.year);
          return (
            <div key={y.year} className="rounded-3xl border border-slate-800/70 bg-surface/20 p-4 shadow-glow">
              <button
                type="button"
                onClick={() => toggleYear(y.year)}
                className="flex w-full items-center justify-between"
              >
                <div className="inline-flex items-center gap-2">
                  <span className="rounded-full border border-slate-700/70 bg-background/30 px-3 py-1 text-sm text-slate-200">
                    {y.year}
                  </span>
                  <span className="text-xs text-slate-400">{isOpen ? "Collapse" : "Expand"}</span>
                </div>
                <span className="text-slate-400">{isOpen ? "–" : "+"}</span>
              </button>

              {isOpen ? (
                <div className="mt-4 space-y-6">
                  {y.months.map((m) => (
                    <div key={`${y.year}-${m.month}`} className="space-y-3">
                      <div className="text-sm font-semibold text-slate-200">{monthName(m.month)}</div>
                      <div className="space-y-3">
                        {m.records.map((r) => (
                          <Node key={r._id} record={r} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

