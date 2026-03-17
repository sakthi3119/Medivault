export const RECORD_TYPES = [
  "Lab Report",
  "Prescription",
  "Discharge Summary",
  "Radiology",
  "Vaccination",
  "Insurance",
  "Surgery Report",
  "Consultation Notes",
  "Other",
];

export function typeBadge(type) {
  const map = {
    "Lab Report": "bg-accent/15 text-accent border-accent/25",
    Prescription: "bg-primary/15 text-cyan-100 border-primary/25",
    Radiology: "bg-purple-400/15 text-purple-200 border-purple-400/25",
    Vaccination: "bg-success/15 text-emerald-200 border-success/25",
    Insurance: "bg-amber-400/15 text-amber-200 border-amber-400/25",
    "Discharge Summary": "bg-slate-400/15 text-slate-200 border-slate-300/25",
    "Surgery Report": "bg-rose-400/15 text-rose-200 border-rose-300/25",
    "Consultation Notes": "bg-indigo-400/15 text-indigo-200 border-indigo-300/25",
    Other: "bg-slate-500/15 text-slate-200 border-slate-400/25",
  };
  return map[type] || map.Other;
}

