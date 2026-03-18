import React, { useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function initials(name) {
  const n = String(name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
}

function RoleBadge({ role }) {
  const label = role === "doctor" ? "Doctor" : "Patient";
  const cls =
    role === "doctor"
      ? "bg-accent/15 text-accent border-accent/25"
      : "bg-primary/15 text-cyan-100 border-primary/25";
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${cls}`}>{label}</span>;
}

export function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const avatar = useMemo(() => initials(user?.name), [user?.name]);
  const isDoctor = user?.role === "doctor";

  return (
    <div className="sticky top-0 z-30 border-b border-slate-800/70 bg-background/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[conic-gradient(from_210deg,rgba(34,211,238,0.9),rgba(14,116,144,0.95),rgba(34,211,238,0.85))]" />
          <div>
            <div className="font-heading text-xl italic leading-none">MediVault</div>
            <div className="text-[11px] text-slate-400">Digital health record manager</div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm ${isActive ? "bg-surface text-white" : "text-slate-300 hover:text-white"}`
              }
            >
              Dashboard
            </NavLink>
            {!isDoctor ? (
              <>
                <NavLink
                  to="/timeline"
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2 text-sm ${isActive ? "bg-surface text-white" : "text-slate-300 hover:text-white"}`
                  }
                >
                  Timeline
                </NavLink>
                <NavLink
                  to="/share"
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2 text-sm ${isActive ? "bg-surface text-white" : "text-slate-300 hover:text-white"}`
                  }
                >
                  Share
                </NavLink>
              </>
            ) : null}
          </nav>

          {user?.role ? <RoleBadge role={user.role} /> : null}

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/70 bg-surface/50 text-sm font-semibold"
            >
              {avatar}
            </button>
            {open ? (
              <div
                className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-700/60 bg-surface shadow-glow"
                onMouseLeave={() => setOpen(false)}
              >
                <Link to="/profile" className="block px-4 py-3 text-sm text-slate-200 hover:bg-slate-700/40">
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="block w-full px-4 py-3 text-left text-sm text-danger hover:bg-slate-700/40"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

