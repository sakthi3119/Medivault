import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { BrandPanel } from "../components/BrandPanel.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { email: "", password: "" } });

  async function onSubmit(values) {
    setServerError("");
    const res = await login(values.email, values.password);
    if (!res.ok) return setServerError(res.message);
    const role = res.user?.role;
    navigate(role === "doctor" ? "/profile" : "/dashboard");
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:min-h-[680px] lg:grid-cols-2">
        <BrandPanel />

        <div className="flex items-center justify-center rounded-3xl border border-slate-800/70 bg-surface/30 p-8 shadow-glow">
          <div className="w-full max-w-md">
            <div className="font-heading text-3xl italic">Welcome back</div>
            <div className="mt-1 text-sm text-slate-300">Sign in to manage your records.</div>

            {serverError ? (
              <div className="mt-5 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-100">
                {serverError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
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
                  placeholder="••••••••"
                  {...register("password", { required: "Password is required" })}
                />
                {errors.password ? <div className="mt-1 text-xs text-danger">{errors.password.message}</div> : null}
              </div>

              <button
                disabled={loading}
                className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                type="submit"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="mt-6 text-sm text-slate-300">
              Don’t have an account?{" "}
              <Link to="/register" className="text-accent hover:underline">
                Create one
              </Link>
              .
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

