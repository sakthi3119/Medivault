import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { BrandPanel } from "../components/BrandPanel.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const navigate = useNavigate();
  const { register: signup, loading } = useAuth();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "patient",
      specialization: "",
    },
  });

  const role = watch("role");
  const isDoctor = useMemo(() => role === "doctor", [role]);

  async function onSubmit(values) {
    setServerError("");
    const payload = {
      name: values.name,
      email: values.email,
      password: values.password,
      role: values.role,
      specialization: values.role === "doctor" ? values.specialization : undefined,
    };
    const res = await signup(payload);
    if (!res.ok) return setServerError(res.message);
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:min-h-[680px] lg:grid-cols-2">
        <BrandPanel />

        <div className="flex items-center justify-center rounded-3xl border border-slate-800/70 bg-surface/30 p-8 shadow-glow">
          <div className="w-full max-w-md">
            <div className="font-heading text-3xl italic">Create your account</div>
            <div className="mt-1 text-sm text-slate-300">Secure, simple, and ready for your next visit.</div>

            {serverError ? (
              <div className="mt-5 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-100">
                {serverError}
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-slate-700/70 bg-background/30 p-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="cursor-pointer">
                  <input type="radio" value="patient" className="hidden" {...register("role")} />
                  <div className={`rounded-xl px-4 py-2 text-center text-sm ${!isDoctor ? "bg-surface text-white" : "text-slate-300 hover:text-white"}`}>
                    Patient
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input type="radio" value="doctor" className="hidden" {...register("role")} />
                  <div className={`rounded-xl px-4 py-2 text-center text-sm ${isDoctor ? "bg-surface text-white" : "text-slate-300 hover:text-white"}`}>
                    Doctor
                  </div>
                </label>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
              <div>
                <label className="text-sm text-slate-200">Full name</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/40 px-4 py-3 text-sm outline-none ring-accent/30 focus:ring-2"
                  placeholder="Sanjay Kumar"
                  {...register("name", { required: "Name is required" })}
                />
                {errors.name ? <div className="mt-1 text-xs text-danger">{errors.name.message}</div> : null}
              </div>

              <div>
                <label className="text-sm text-slate-200">Email</label>
                <input
                  type="email"
                  className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/40 px-4 py-3 text-sm outline-none ring-accent/30 focus:ring-2"
                  placeholder="you@example.com"
                  {...register("email", { required: "Email is required" })}
                />
                {errors.email ? <div className="mt-1 text-xs text-danger">{errors.email.message}</div> : null}
              </div>

              <div>
                <label className="text-sm text-slate-200">Password</label>
                <input
                  type="password"
                  className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/40 px-4 py-3 text-sm outline-none ring-accent/30 focus:ring-2"
                  placeholder="At least 6 characters"
                  {...register("password", { required: "Password is required", minLength: { value: 6, message: "Minimum 6 characters" } })}
                />
                {errors.password ? <div className="mt-1 text-xs text-danger">{errors.password.message}</div> : null}
              </div>

              {isDoctor ? (
                <div>
                  <label className="text-sm text-slate-200">Specialization</label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-700/70 bg-background/40 px-4 py-3 text-sm outline-none ring-accent/30 focus:ring-2"
                    placeholder="Cardiology"
                    {...register("specialization", { required: "Specialization is required for doctors" })}
                  />
                  {errors.specialization ? (
                    <div className="mt-1 text-xs text-danger">{errors.specialization.message}</div>
                  ) : null}
                </div>
              ) : null}

              <button
                disabled={loading}
                className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                type="submit"
              >
                {loading ? "Creating..." : "Create account"}
              </button>
            </form>

            <div className="mt-6 text-sm text-slate-300">
              Already have an account?{" "}
              <Link to="/login" className="text-accent hover:underline">
                Sign in
              </Link>
              .
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

