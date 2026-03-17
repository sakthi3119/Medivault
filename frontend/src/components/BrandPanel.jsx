import React from "react";

function CrossIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 3h4a2 2 0 0 1 2 2v5h5a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-5v5a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-5H3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h5V5a2 2 0 0 1 2-2Z"
        fill="url(#g)"
      />
      <defs>
        <linearGradient id="g" x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3EE" />
          <stop offset="1" stopColor="#0E7490" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function BrandPanel() {
  return (
    <div className="relative hidden h-full w-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-700/60 bg-surface/40 p-10 shadow-glow lg:flex">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(circle_at_70%_90%,rgba(14,116,144,0.22),transparent_60%)]" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <CrossIcon />
          <div>
            <div className="font-heading text-3xl italic tracking-tight">MediVault</div>
            <div className="text-sm text-slate-300">Your health history, always with you</div>
          </div>
        </div>
        <div className="mt-10 max-w-md text-slate-200">
          <div className="font-heading text-2xl italic leading-tight">
            Organize reports, prescriptions, and medical files in one secure place.
          </div>
          <div className="mt-4 text-sm leading-relaxed text-slate-300">
            Upload records, view your timeline, and share read-only links with doctors when you need a second opinion.
          </div>
        </div>
      </div>
      <div className="relative text-xs text-slate-400">Clinical refined dark • Free-tier stack</div>
    </div>
  );
}

