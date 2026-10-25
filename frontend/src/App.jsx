// src/App.jsx
import React, { useState } from "react";
import Match from "./pages/Match";
import Tags from "./pages/Tags";
import { Card, Logo } from "./components/ui";
import { MailIcon, StopwatchIcon, TagIcon } from "./components/Icons";
import "./index.css";

const PAGES = [
  { label: "Match", Icon: StopwatchIcon },
  { label: "Tags", Icon: TagIcon },
  { label: "Contact", Icon: MailIcon },
];

function App() {
  const [active, setActive] = useState(0);

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
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                active === i ? "bg-ink-700 text-white" : "text-ink-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 pb-tabbar">
        {/* Pages stay mounted so switching tabs never resets a running match */}
        <div hidden={active !== 0}><Match /></div>
        <div hidden={active !== 1}><Tags /></div>
        {active === 2 && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <Card title="Contact" description="Questions, bugs or feature ideas are welcome.">
              <a href="mailto:cagataykasar@gmail.com" className="inline-flex items-center gap-2 text-accent font-semibold">
                <MailIcon className="w-5 h-5" />
                cagataykasar@gmail.com
              </a>
            </Card>
          </div>
        )}
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
            className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-semibold ${
              active === i ? "text-accent" : "text-ink-400"
            }`}
          >
            <Icon className="w-6 h-6" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
