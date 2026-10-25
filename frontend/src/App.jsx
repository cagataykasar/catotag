// src/App.jsx
import React, { useState } from "react";
import Match from "./pages/Match";
import Tags from "./pages/Tags";
import Account from "./pages/Account";
import { Logo } from "./components/ui";
import { StopwatchIcon, TagIcon, UserIcon } from "./components/Icons";
import { AUTH_KEY } from "./lib/api";
import useCloudSync from "./lib/sync";
import useStoredState from "./lib/useStoredState";
import "./index.css";

const PAGES = [
  { label: "Match", Icon: StopwatchIcon },
  { label: "Tags", Icon: TagIcon },
  { label: "Account", Icon: UserIcon },
];

// Small sync indicator next to the Account tab (only while signed in)
const SYNC_DOT = {
  syncing: "bg-amber-400",
  offline: "bg-amber-400",
  error: "bg-red-400",
  synced: "bg-emerald-400",
};

function App() {
  const [active, setActive] = useState(0);
  const [auth] = useStoredState(AUTH_KEY, null);
  const sync = useCloudSync(auth?.username || null);
  const syncDot = auth ? SYNC_DOT[sync.status] : null;

  const Dot = ({ className = "" }) =>
    syncDot ? <span className={`w-2 h-2 rounded-full ${syncDot} ${className}`} aria-hidden="true" /> : null;

  return (
    <div className="min-h-full flex flex-col">
      {/* Desktop: top bar */}
      <header className="hidden md:flex sticky top-0 z-30 h-14 items-center justify-between px-6 bg-ink-900/95 backdrop-blur border-b border-ink-700">
        <Logo className="text-xl" />
        <nav className="flex gap-1">
          {PAGES.map(({ label }, i) => (
            <button
              key={label}
              onClick={() => setActive(i)}
              aria-current={active === i ? "page" : undefined}
              className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition ${
                active === i ? "bg-ink-700 text-white" : "text-ink-400 hover:text-white"
              }`}
            >
              {label}
              {label === "Account" && <Dot className="absolute top-1.5 right-1.5" />}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 pb-tabbar">
        {/* Pages stay mounted so switching tabs never resets a running match */}
        <div hidden={active !== 0}><Match /></div>
        <div hidden={active !== 1}><Tags /></div>
        {active === 2 && <Account auth={auth} sync={sync} />}
      </main>

      {/* Mobile: thumb-reachable bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-3 bg-ink-900/95 backdrop-blur border-t border-ink-700"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {PAGES.map(({ label, Icon }, i) => (
          <button
            key={label}
            onClick={() => setActive(i)}
            aria-current={active === i ? "page" : undefined}
            className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-semibold ${
              active === i ? "text-accent" : "text-ink-400"
            }`}
          >
            <Icon className="w-6 h-6" />
            {label}
            {label === "Account" && <Dot className="absolute top-2 left-1/2 ml-2.5" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
