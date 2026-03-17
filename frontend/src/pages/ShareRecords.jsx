import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useRecords } from "../hooks/useRecords";

function formatExpiry(d) {
  const dt = d ? new Date(d) : null;
  if (!dt || Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function isExpired(expiresAt) {
  const t = new Date(expiresAt).getTime();
  return !t || t <= Date.now();
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="rounded-xl border border-slate-700/70 bg-background/35 px-3 py-2 text-xs text-slate-200 hover:bg-background/50"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export default function ShareRecords() {
  const { items: records } = useRecords({ type: "All", search: "", page: 1, limit: 50 });
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");

  const [allRecords, setAllRecords] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [label, setLabel] = useState("");
  const [expiresIn, setExpiresIn] = useState("24h");
  const [createdLink, setCreatedLink] = useState("");

  const recordList = useMemo(() => records || [], [records]);

  async function loadTokens() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/access");
      setTokens(data.tokens || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load share links.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTokens();
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingDoctors(true);
      try {
        const { data } = await api.get("/api/doctors");
        setDoctors(data.doctors || []);
      } catch (err) {
        // optional UX: if it fails, don't block sharing
        setDoctors([]);
      } finally {
        setLoadingDoctors(false);
      }
    })();
  }, []);

  async function createLink() {
    setCreating(true);
    setCreatedLink("");
    setError("");
    try {
      const payload = {
        allRecords,
        recordIds: allRecords ? [] : Array.from(selected),
        doctorId: selectedDoctorId || undefined,
        label: label || undefined,
        expiresIn,
      };
      const { data } = await api.post("/api/access", payload);
      const url = `${window.location.origin}/shared/${data.token.token}`;
      setCreatedLink(url);
      await loadTokens();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create share link.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(token) {
    setError("");
    try {
      await api.patch(`/api/access/${token}/revoke`);
      await loadTokens();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to revoke link.");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <div className="font-heading text-3xl italic">Share</div>
          <div className="mt-1 text-sm text-slate-300">Create read-only links to share records with a doctor.</div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}

        <div className="rounded-3xl border border-slate-800/70 bg-surface/20 p-4 shadow-glow">
          <div className="text-sm font-semibold">Active & expired links</div>
          {loading ? <div className="mt-3 text-sm text-slate-300">Loading…</div> : null}
          {!loading && tokens.length === 0 ? <div className="mt-3 text-sm text-slate-300">No links yet.</div> : null}

          <div className="mt-4 space-y-3">
            {tokens.map((t) => {
              const url = `${window.location.origin}/shared/${t.token}`;
              const expired = isExpired(t.expiresAt) || t.isRevoked;
              const doctor = t.doctor;
              return (
                <div key={t._id} className="rounded-2xl border border-slate-800/70 bg-background/25 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{t.label || "Share link"}</div>
                      <div className="mt-1 text-xs text-slate-400">Expires: {formatExpiry(t.expiresAt)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {t.allRecords ? "All records" : `${t.recordIds?.length || 0} selected record(s)`} • Accessed {t.accessCount || 0} time(s)
                      </div>
                      {doctor ? (
                        <div className="mt-1 text-xs text-slate-400">
                          Doctor: <span className="text-slate-200">{doctor.name}</span>
                          {doctor.specialization ? <span className="text-slate-500"> • </span> : null}
                          {doctor.specialization ? <span>{doctor.specialization}</span> : null}
                          {doctor.hospitalName ? <span className="text-slate-500"> • </span> : null}
                          {doctor.hospitalName ? <span className="text-slate-400">{doctor.hospitalName}</span> : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <CopyButton text={url} />
                      <button
                        type="button"
                        onClick={() => revoke(t.token)}
                        disabled={expired}
                        className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-rose-100 hover:bg-danger/15 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 break-all rounded-xl border border-slate-700/60 bg-surface/30 px-3 py-2 text-xs text-slate-300">
                    {url}
                  </div>
                  {expired ? (
                    <div className="mt-2 text-xs text-amber-200">Expired / revoked</div>
                  ) : (
                    <div className="mt-2 text-xs text-success">Active</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-800/70 bg-surface/20 p-5 shadow-glow">
          <div className="text-sm font-semibold">Create new share link</div>
          <div className="mt-1 text-xs text-slate-400">Choose records, expiry, and an optional label.</div>

          <div className="mt-5 space-y-4">
            <label className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-background/25 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">All records</div>
                <div className="text-xs text-slate-400">Share everything in your vault</div>
              </div>
              <input type="checkbox" checked={allRecords} onChange={(e) => setAllRecords(e.target.checked)} className="h-5 w-5 accent-accent" />
            </label>

            {!allRecords ? (
              <div className="rounded-2xl border border-slate-800/70 bg-background/25 p-4">
                <div className="text-sm font-semibold">Select records</div>
                <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
                  {recordList.map((r) => (
                    <label key={r._id} className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-surface/20 px-3 py-2 hover:bg-surface/35">
                      <input
                        type="checkbox"
                        checked={selected.has(r._id)}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(r._id);
                            else next.delete(r._id);
                            return next;
                          });
                        }}
                        className="mt-1 h-4 w-4 accent-accent"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm text-slate-100">{r.title}</div>
                        <div className="truncate text-xs text-slate-400">{r.type}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-800/70 bg-background/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Select doctor (optional)</div>
                  <div className="mt-1 text-xs text-slate-400">Choose a registered doctor to associate with this link.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDoctorId("")}
                  className="rounded-xl border border-slate-700/70 bg-background/35 px-3 py-2 text-xs text-slate-200 hover:bg-background/50"
                >
                  Clear
                </button>
              </div>

              {loadingDoctors ? <div className="mt-3 text-sm text-slate-300">Loading doctors…</div> : null}
              {!loadingDoctors && doctors.length === 0 ? (
                <div className="mt-3 text-sm text-slate-300">No doctors registered yet.</div>
              ) : null}

              <div className="mt-3 space-y-2">
                {doctors.map((d) => (
                  <label
                    key={d._id}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-800/60 bg-surface/20 px-4 py-3 hover:bg-surface/35"
                  >
                    <input
                      type="radio"
                      name="selectedDoctor"
                      value={d._id}
                      checked={selectedDoctorId === d._id}
                      onChange={() => setSelectedDoctorId(d._id)}
                      className="mt-1 h-4 w-4 accent-accent"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100">{d.name}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {d.specialization ? <span>{d.specialization}</span> : <span>—</span>}
                        {d.hospitalName ? <span className="text-slate-500"> • </span> : null}
                        {d.hospitalName ? <span className="text-slate-400">{d.hospitalName}</span> : null}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-200">Label (optional)</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/35 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30" placeholder="Cardiology consult" />
            </div>

            <div>
              <label className="text-sm text-slate-200">Expiry duration</label>
              <select value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/35 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30">
                <option value="1h">1 hour</option>
                <option value="6h">6 hours</option>
                <option value="24h">24 hours</option>
                <option value="48h">48 hours</option>
                <option value="7d">7 days</option>
              </select>
            </div>

            <button
              type="button"
              onClick={createLink}
              disabled={creating || (!allRecords && selected.size === 0)}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create link"}
            </button>

            {createdLink ? (
              <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
                <div className="text-sm font-semibold text-accent">Link created</div>
                <div className="mt-2 break-all rounded-xl border border-accent/25 bg-background/25 px-3 py-2 text-xs text-slate-100">
                  {createdLink}
                </div>
                <div className="mt-3">
                  <CopyButton text={createdLink} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

