import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../context/AuthContext.jsx";
import { useRecords } from "../hooks/useRecords";

function Stat({ label, value }) {
  return (
    <div className="rounded-3xl border border-slate-800/70 bg-surface/30 px-5 py-4 shadow-glow">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}

export default function Profile() {
  const { user, updateUser, loading } = useAuth();
  const { fetchStats } = useRecords();
  const [serverMsg, setServerMsg] = useState({ type: "", text: "" });
  const [stats, setStats] = useState({ total: 0, lastUpload: "" });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
      address: user?.address || "",
      bloodGroup: user?.bloodGroup || "",
      dateOfBirth: user?.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : "",
      specialization: user?.specialization || "",
      hospitalName: user?.hospitalName || "",
    },
  });

  useEffect(() => {
    reset({
      name: user?.name || "",
      phone: user?.phone || "",
      address: user?.address || "",
      bloodGroup: user?.bloodGroup || "",
      dateOfBirth: user?.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : "",
      specialization: user?.specialization || "",
      hospitalName: user?.hospitalName || "",
    });
  }, [user, reset]);

  useEffect(() => {
    if (user?.role !== "patient") return;
    (async () => {
      const res = await fetchStats();
      if (!res.ok) return;
      const breakdown = res.data.byType || [];
      const total = breakdown.reduce((sum, x) => sum + x.count, 0);
      const recent = res.data.recent || [];
      const lastUpload = recent[0]?.recordDate
        ? new Date(recent[0].recordDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
        : "—";
      setStats({ total, lastUpload });
    })();
  }, [fetchStats, user?.role]);

  const roleLabel = useMemo(() => (user?.role === "doctor" ? "Doctor" : "Patient"), [user?.role]);

  async function onSubmit(values) {
    setServerMsg({ type: "", text: "" });
    const res = await updateUser(values);
    if (!res.ok) return setServerMsg({ type: "error", text: res.message });
    setServerMsg({ type: "ok", text: "Profile updated." });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="font-heading text-3xl italic">Profile</div>
        <div className="mt-1 text-sm text-slate-300">Update your account details.</div>
      </div>

      {serverMsg.text ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            serverMsg.type === "ok"
              ? "border-success/30 bg-success/10 text-emerald-100"
              : "border-danger/30 bg-danger/10 text-rose-100"
          }`}
        >
          {serverMsg.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Role" value={roleLabel} />
        {user?.role === "patient" ? <Stat label="Total records" value={stats.total} /> : <Stat label="Email" value={user?.email || "—"} />}
        {user?.role === "patient" ? <Stat label="Last record date" value={stats.lastUpload} /> : <Stat label="Active" value={user?.isActive ? "Yes" : "No"} />}
      </div>

      <div className="rounded-3xl border border-slate-800/70 bg-surface/20 p-6 shadow-glow">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-slate-200">Name</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/35 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30"
              {...register("name", { required: "Name is required" })}
            />
            {errors.name ? <div className="mt-1 text-xs text-danger">{errors.name.message}</div> : null}
          </div>

          <div>
            <label className="text-sm text-slate-200">Phone</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/35 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30"
              {...register("phone")}
            />
          </div>

          {user?.role === "doctor" ? (
            <div>
              <label className="text-sm text-slate-200">Specialization</label>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/35 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="Cardiology"
                {...register("specialization", { required: "Specialization is required for doctors" })}
              />
              {errors.specialization ? <div className="mt-1 text-xs text-danger">{errors.specialization.message}</div> : null}
            </div>
          ) : null}

          {user?.role === "doctor" ? (
            <div>
              <label className="text-sm text-slate-200">Hospital / Clinic</label>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/35 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="City Care Hospital"
                {...register("hospitalName", { required: "Hospital / clinic name is required for doctors" })}
              />
              {errors.hospitalName ? <div className="mt-1 text-xs text-danger">{errors.hospitalName.message}</div> : null}
            </div>
          ) : null}

          <div className="md:col-span-2">
            <label className="text-sm text-slate-200">Address</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/35 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30"
              {...register("address")}
            />
          </div>

          <div>
            <label className="text-sm text-slate-200">Blood group</label>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/35 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="O+"
              {...register("bloodGroup")}
            />
          </div>

          <div>
            <label className="text-sm text-slate-200">Date of birth</label>
            <input
              type="date"
              className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/35 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/30"
              {...register("dateOfBirth")}
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-end">
            <button
              disabled={loading}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
              type="submit"
            >
              {loading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

