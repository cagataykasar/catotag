import React from "react";

export const inputClass =
  "w-full h-11 px-3 rounded-xl bg-ink-800 border border-ink-600 text-white placeholder-ink-400 " +
  "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export const Card = ({ title, description, aside, children }) => (
  <section className="rounded-2xl bg-ink-900 border border-ink-700 p-4 sm:p-5 space-y-4">
    {(title || aside) && (
      <div className="flex items-start justify-between gap-3">
        <div>
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {description && <p className="text-sm text-ink-400 mt-0.5">{description}</p>}
        </div>
        {aside}
      </div>
    )}
    {children}
  </section>
);

// Compact labelled control used for group / before / after settings
export const MiniField = ({ label, children }) => (
  <label className="flex items-center gap-1.5 h-9 pl-2.5 pr-1 rounded-lg bg-ink-800 border border-ink-700 text-xs font-medium text-ink-400">
    {label}
    {children}
  </label>
);

export const miniInputClass =
  "w-10 h-7 rounded-md bg-ink-950 text-white text-sm text-center tabular-nums placeholder-ink-400 " +
  "focus:outline-none focus:ring-2 focus:ring-accent/40";

export const Logo = ({ className = "" }) => (
  <span className={`font-extrabold tracking-tight ${className}`}>
    cato<span className="text-accent">tag</span>
  </span>
);
