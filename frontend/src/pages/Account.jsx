import React, { useEffect, useState } from "react";
import { api, clearAuth, login, register } from "../lib/api";
import { MATCH_KEY } from "../lib/sync";
import { readStored } from "../lib/useStoredState";
import { exportXml } from "../lib/xml";
import { Card, inputClass } from "../components/ui";
import { DownloadIcon, MailIcon, XIcon } from "../components/Icons";

const STATUS_TEXT = {
  idle: "Not synced yet",
  syncing: "Syncing…",
  synced: "Backed up",
  offline: "Offline: changes are kept on this device and upload when you're back online",
  error: "Sync failed",
};
const STATUS_DOT = {
  idle: "bg-ink-600",
  syncing: "bg-amber-400 animate-pulse",
  synced: "bg-emerald-400",
  offline: "bg-amber-400",
  error: "bg-red-400",
};

const formatDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const primaryButton =
  "h-11 px-5 rounded-xl bg-accent text-ink-950 font-bold hover:brightness-110 disabled:opacity-40 transition";
const secondaryButton =
  "h-10 px-4 rounded-xl border border-ink-600 text-ink-200 font-semibold hover:bg-ink-800 disabled:opacity-40 transition";

const Contact = () => (
  <p className="text-sm text-ink-400 text-center">
    Questions or ideas?{" "}
    <a href="mailto:cagataykasar@gmail.com" className="inline-flex items-center gap-1 text-accent font-semibold">
      <MailIcon className="w-4 h-4" />
      cagataykasar@gmail.com
    </a>
  </p>
);

const AuthForms = () => {
  const [mode, setMode] = useState("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signin") await login(username.trim(), password);
      else await register(username.trim(), email.trim(), password);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Back up your data"
      description="Sign in to save your tags, layout, presets and matches to your account and restore them on any device. The app keeps working offline either way."
    >
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-ink-800">
        {[
          ["signin", "Sign in"],
          ["register", "Create account"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => {
              setMode(value);
              setError("");
            }}
            className={`h-9 rounded-lg text-sm font-semibold transition ${
              mode === value ? "bg-ink-600 text-white" : "text-ink-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoComplete="username"
          autoCapitalize="none"
          required
          className={inputClass}
        />
        {mode === "register" && (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
            className={inputClass}
          />
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "register" ? "Password (at least 8 characters)" : "Password"}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          minLength={mode === "register" ? 8 : undefined}
          maxLength={72}
          required
          className={inputClass}
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </Card>
  );
};

const SavedMatches = ({ stamp }) => {
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const currentId = readStored(MATCH_KEY, null)?.id;

  useEffect(() => {
    let cancelled = false;
    api("/sync/matches")
      .then((list) => !cancelled && (setMatches(list), setError("")))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [stamp]);

  const download = async (m) => {
    setBusyId(m.match_id);
    try {
      const full = await api(`/sync/matches/${m.match_id}`);
      const data = full.data || {};
      await exportXml(Array.isArray(data.instances) ? data.instances : [], data.teamA, data.teamB, new Date(m.created_at));
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Delete this match from your account? ${m.tag_count} tags will be lost.`)) return;
    setBusyId(m.match_id);
    try {
      await api(`/sync/matches/${m.match_id}`, { method: "DELETE" });
      setMatches((list) => list.filter((x) => x.match_id !== m.match_id));
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card title="Saved matches" description="Every match is backed up automatically. Download its XML any time.">
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!matches && !error && <p className="text-sm text-ink-400">Loading…</p>}
      {matches && matches.length === 0 && <p className="text-sm text-ink-400">No matches backed up yet.</p>}
      {matches && matches.length > 0 && (
        <ul className="-my-3 divide-y divide-ink-800">
          {matches.map((m) => {
            const isCurrent = m.match_id === currentId;
            return (
              <li key={m.match_id} className="py-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">
                    {m.team_a || m.team_b ? `${m.team_a || "Home"} vs ${m.team_b || "Away"}` : "Untitled match"}
                    {isCurrent && (
                      <span className="ml-2 align-middle px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[11px] font-bold">
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-400">
                    {formatDate(m.created_at)} · {m.tag_count} tags
                  </div>
                </div>
                <button
                  onClick={() => download(m)}
                  disabled={busyId === m.match_id}
                  aria-label="Download XML"
                  className="w-10 h-10 grid place-items-center rounded-lg text-accent hover:bg-ink-800 disabled:opacity-40"
                >
                  <DownloadIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => remove(m)}
                  disabled={busyId === m.match_id || isCurrent}
                  aria-label="Delete match"
                  title={isCurrent ? "This is the match in progress" : "Delete"}
                  className="w-10 h-10 grid place-items-center rounded-lg text-ink-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

const DeleteAccount = () => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!window.confirm("Permanently delete your account and all backed up data? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      await api("/users/me", { method: "DELETE", body: { password } });
      clearAuth();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Card
      title="Delete account"
      description="Removes your account and everything backed up to it. Data on this device stays."
      aside={
        !open && (
          <button onClick={() => setOpen(true)} className="h-9 px-3 rounded-lg text-sm font-semibold text-red-300 hover:bg-red-500/10">
            Delete…
          </button>
        )
      }
    >
      {open && (
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Confirm with your password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="h-11 px-5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 disabled:opacity-40">
              Delete my account
            </button>
            <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </Card>
  );
};

const Account = ({ auth, sync }) => {
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!auth) return setMe(null);
    api("/users/me").then(setMe).catch(() => {});
  }, [auth]);

  if (!auth) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <h1 className="text-2xl font-extrabold">Account</h1>
        <AuthForms />
        <Contact />
      </div>
    );
  }

  const signOut = () => {
    if (window.confirm("Sign out? Your tags and current match stay on this device.")) clearAuth();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-extrabold">Account</h1>

      <Card
        title={auth.username}
        description={me?.email}
        aside={
          <button onClick={signOut} className={secondaryButton}>
            Sign out
          </button>
        }
      >
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[sync.status]}`} />
          <div className="flex-1 text-sm">
            <div className="font-semibold">{STATUS_TEXT[sync.status]}</div>
            {sync.status === "error" && sync.error && <div className="text-red-300">{sync.error}</div>}
            {sync.lastSyncedAt && (
              <div className="text-ink-400">Last sync {new Date(sync.lastSyncedAt).toLocaleTimeString()}</div>
            )}
          </div>
          <button onClick={sync.syncNow} disabled={sync.status === "syncing"} className={secondaryButton}>
            Sync now
          </button>
        </div>
      </Card>

      {/* Reload the list after uploads and after every successful sync */}
      <SavedMatches stamp={`${sync.matchesStamp}-${sync.lastSyncedAt}`} />
      <DeleteAccount />
      <Contact />
    </div>
  );
};

export default Account;
