import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

/* ───────────────────────── Persistence ─────────────────────────
   Uses the artifact storage API when available, falls back to
   in-memory only (data still works for the session). One key,
   debounced writes. */
const STORAGE_KEY = "moffett-site-training-tracker:v1";

async function loadState() {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get(STORAGE_KEY);
      if (r && r.value) return JSON.parse(r.value);
    }
  } catch (e) {
    /* fall through to seed */
  }
  return null;
}
async function persistState(state) {
  try {
    if (typeof window !== "undefined" && window.storage) {
      await window.storage.set(STORAGE_KEY, JSON.stringify(state));
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

/* ───────────────────────── Helpers ───────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);
// Trained is per-site; every other quiz is a person-level competency shared across sites.
const key = (siteId, personId, compId) =>
  compId === "trained" ? `T|${siteId}|${personId}` : `Q|${personId}|${compId}`;
const recHasData = (r) => !!(r && (r.date || (r.score !== null && r.score !== undefined && r.score !== "")));

function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/* ───────────────────────── Seed data ─────────────────────────
   Transcribed from the training sheet. Every site gets the four
   shared quizzes by default; Conveyor / Lift are in the library to
   add per site. The original per-site training dates are seeded
   into the "Trained" column. */
const TRAINED = { id: "trained", name: "Trained", scored: false };
const COMMON_QUIZZES = [
  { id: "safety", name: "Safety Quiz", scored: true },
  { id: "ss1", name: "Support Stage 1 Quiz", scored: true },
  { id: "ss2", name: "Support Stage 2 Quiz", scored: true },
  { id: "ss3", name: "Support Stage 3 Quiz", scored: true },
];
const EQUIPMENT_QUIZZES = [
  { id: "conveyor", name: "Conveyor Quiz", scored: true },
  { id: "lift", name: "Lift Quiz", scored: true },
  { id: "hydraulic-taxi", name: "Hydraulic Taxi Quiz", scored: true },
];
const DEFAULT_LIBRARY = [...EQUIPMENT_QUIZZES, ...COMMON_QUIZZES];

const SEED_SITES = [
  ["axus", "Axus", "#FCE4D6"],
  ["3m", "3M", "#FCE4D6"],
  ["total-packaging", "Total Packaging", "#FCE4D6"],
  ["hilton", "Hilton", "#D9D9D9"],
  ["dew-valley", "Dew Valley", "#9DC3E6"],
  ["cm", "CM", "#9DC3E6"],
  ["drt", "DRT", "#9DC3E6"],
  ["ifm", "IFM", "#9DC3E6"],
  ["pandriks", "Pandriks", "#9DC3E6"],
  ["kolios", "Kolios", "#9DC3E6"],
  ["unide", "UNIDE", "#E4B7E5"],
  ["yaya", "Yaya", "#FFC000"],
  ["dixon", "Dixon", "#FFC000"],
  ["jice", "JICE", "#FFC000"],
  ["leclerc", "Leclerc", "#7030A0"],
  ["cfuk", "CFUK", "#FFFF00"],
  ["diageo", "Diageo", "#92D050"],
  ["saltoki", "Saltoki", "#F8CBAD"],
  ["asafe", "Asafe", "#000000"],
];

const SEED_PEOPLE = [
  ["adriaan", "Adriaan", ""],
  ["connor", "Connor", ""],
  ["grainne", "Grainne", ""],
  ["jack", "Jack", ""],
  ["kevin", "Kevin", "Nathan Field"],
  ["kyle", "Kyle", ""],
  ["luke", "Luke", ""],
  ["nathan", "Nathan", ""],
  ["nico", "Nico", ""],
  ["pedro", "Pedro", "Nathan Field"],
  ["peter", "Peter", ""],
  ["precious", "Precious", "Nathan Field"],
  ["viktoras", "Viktoras", "Nathan Field"],
];

// [siteId, personId, isoDate] for the "Trained" column
const SEED_TRAINED = [
  // Connor
  ["axus", "connor", "2024-11-01"], ["hilton", "connor", "2024-11-04"],
  ["dew-valley", "connor", "2024-11-05"], ["unide", "connor", "2024-11-11"],
  ["yaya", "connor", "2024-11-12"], ["leclerc", "connor", "2024-11-15"],
  ["cfuk", "connor", "2024-11-16"], ["diageo", "connor", "2024-11-17"],
  ["saltoki", "connor", "2024-11-18"], ["asafe", "connor", "2024-11-19"],
  // Nico (trained on every site)
  ["axus", "nico", "2024-11-01"], ["3m", "nico", "2024-11-02"],
  ["total-packaging", "nico", "2024-11-03"], ["hilton", "nico", "2024-11-04"],
  ["dew-valley", "nico", "2024-11-05"], ["cm", "nico", "2024-11-06"],
  ["drt", "nico", "2024-11-07"], ["ifm", "nico", "2024-11-08"],
  ["pandriks", "nico", "2024-11-09"], ["kolios", "nico", "2024-11-10"],
  ["unide", "nico", "2024-11-11"], ["yaya", "nico", "2024-11-12"],
  ["dixon", "nico", "2024-11-13"], ["jice", "nico", "2024-11-14"],
  ["leclerc", "nico", "2024-11-15"], ["cfuk", "nico", "2024-11-16"],
  ["diageo", "nico", "2024-11-17"], ["saltoki", "nico", "2024-11-18"],
  ["asafe", "nico", "2024-11-19"],
  // Kevin
  ["cfuk", "kevin", "2026-01-15"], ["diageo", "kevin", "2026-02-04"],
  ["asafe", "kevin", "2026-01-27"],
  // Pedro
  ["unide", "pedro", "2026-02-19"], ["diageo", "pedro", "2026-02-05"],
  // Precious
  ["cfuk", "precious", "2026-04-03"], ["asafe", "precious", "2026-04-01"],
  // Viktoras
  ["cfuk", "viktoras", "2026-01-14"], ["diageo", "viktoras", "2026-02-03"],
  ["asafe", "viktoras", "2026-01-27"],
];

function buildSeed() {
  const sites = SEED_SITES.map(([id, name, color]) => ({
    id,
    name,
    color,
    category: "",
    components: [
      { ...TRAINED },
      ...COMMON_QUIZZES.map((c) => ({ ...c })),
    ],
  }));
  const people = SEED_PEOPLE.map(([id, name, trainer]) => ({ id, name, trainer }));
  const records = {};
  SEED_TRAINED.forEach(([s, p, date]) => {
    records[key(s, p, "trained")] = { date, score: null };
  });
  return { sites, people, records, library: DEFAULT_LIBRARY.map((c) => ({ ...c })), settings: { passThreshold: 80 } };
}

/* Convert legacy `siteId|personId|compId` records to the new scheme:
   Trained stays per-site (T|site|person); all other quizzes collapse to
   person-level (Q|person|comp), shared across every site that has them. */
function migrateRecords(s) {
  const old = s.records || {};
  const next = {};
  let changed = false;
  Object.entries(old).forEach(([k, v]) => {
    if (k.startsWith("T|") || k.startsWith("Q|")) {
      next[k] = v;
      return;
    }
    const parts = k.split("|");
    if (parts.length === 3) {
      const [si, pi, ci] = parts;
      const nk = ci === "trained" ? `T|${si}|${pi}` : `Q|${pi}|${ci}`;
      changed = true;
      if (!(nk in next) || (!recHasData(next[nk]) && recHasData(v))) next[nk] = v;
    } else {
      next[k] = v;
    }
  });
  if (changed) s.records = next;
  return s;
}

/* Ensure older saved states gain the shared library + defaults. */
function normalize(s) {
  if (!s.settings) s.settings = { passThreshold: 80 };
  migrateRecords(s);
  if (!Array.isArray(s.library)) {
    const seen = new Set();
    const lib = [];
    DEFAULT_LIBRARY.forEach((c) => {
      seen.add(c.id);
      lib.push({ ...c });
    });
    s.sites.forEach((site) =>
      site.components.forEach((c) => {
        if (c.id !== "trained" && !seen.has(c.id)) {
          seen.add(c.id);
          lib.push({ id: c.id, name: c.name, scored: c.scored });
        }
      })
    );
    s.library = lib;
  } else {
    DEFAULT_LIBRARY.forEach((c) => {
      if (!s.library.some((x) => x.id === c.id)) s.library.push({ ...c });
    });
  }
  return s;
}

/* ───────────────────────── Status logic ───────────────────────── */
function cellStatus(comp, rec, threshold) {
  if (!comp.scored) {
    return rec && rec.date ? "done" : "empty";
  }
  if (!rec || rec.score === null || rec.score === undefined || rec.score === "") return "empty";
  return Number(rec.score) >= threshold ? "pass" : "fail";
}

const STATUS_STYLE = {
  pass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  fail: "bg-rose-100 text-rose-800 border-rose-200",
  done: "bg-sky-100 text-sky-800 border-sky-200",
  empty: "bg-slate-50 text-slate-400 border-slate-200",
};

/* readable text colour against an arbitrary site colour */
function textOn(hex) {
  if (!hex) return "#0f172a";
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0f172a" : "#ffffff";
}

/* ───────────────────────── Small UI pieces ───────────────────────── */
function Swatch({ color, size = 14 }) {
  return (
    <span
      className="inline-block rounded-sm border border-slate-300 shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}

function ProgressBar({ value }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-xl border border-slate-200 w-full ${wide ? "max-w-2xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const btn =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";
const btnPrimary = `${btn} bg-slate-900 text-white hover:bg-slate-700`;
const btnGhost = `${btn} text-slate-600 hover:bg-slate-100`;
const btnDanger = `${btn} text-rose-600 hover:bg-rose-50`;
const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

/* ───────────────────────── Main App ───────────────────────── */
export default function App() {
  const [state, setState] = useState(null);
  const [view, setView] = useState("sites");
  const [selectedSite, setSelectedSite] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | local
  const saveTimer = useRef(null);
  const fileInput = useRef(null);

  // load once
  useEffect(() => {
    let alive = true;
    loadState().then((loaded) => {
      if (!alive) return;
      const s = normalize(loaded || buildSeed());
      setState(s);
      setSelectedSite(s.sites[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  // debounced save on change
  useEffect(() => {
    if (!state) return;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await persistState(state);
      setSaveStatus(ok ? "saved" : "local");
    }, 500);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [state]);

  const threshold = state?.settings?.passThreshold ?? 80;

  /* ── derived stats ── */
  const stats = useMemo(() => {
    if (!state) return null;
    const { sites, people, records } = state;
    const personSites = {}; // personId -> count trained
    const personLast = {}; // personId -> last iso
    let totalScored = 0;
    let totalPassed = 0;

    const sitePct = {};
    sites.forEach((site) => {
      const scored = site.components.filter((c) => c.scored);
      let cells = 0,
        passed = 0;
      people.forEach((p) => {
        scored.forEach((c) => {
          cells++;
          totalScored++;
          const r = records[key(site.id, p.id, c.id)];
          if (cellStatus(c, r, threshold) === "pass") {
            passed++;
            totalPassed++;
          }
        });
        const tr = records[key(site.id, p.id, "trained")];
        if (tr && tr.date) {
          personSites[p.id] = (personSites[p.id] || 0) + 1;
          if (!personLast[p.id] || tr.date > personLast[p.id]) personLast[p.id] = tr.date;
        }
      });
      sitePct[site.id] = cells ? passed / cells : 0;
    });

    const personPct = {};
    people.forEach((p) => {
      let cells = 0,
        passed = 0;
      sites.forEach((site) => {
        site.components
          .filter((c) => c.scored)
          .forEach((c) => {
            cells++;
            const r = records[key(site.id, p.id, c.id)];
            if (cellStatus(c, r, threshold) === "pass") passed++;
          });
      });
      personPct[p.id] = cells ? passed / cells : 0;
    });

    return {
      sitePct,
      personPct,
      personSites,
      personLast,
      overall: totalScored ? totalPassed / totalScored : 0,
      totalScored,
      totalPassed,
    };
  }, [state, threshold]);

  /* ── mutators ── */
  const update = useCallback((fn) => {
    setState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const setRecord = (siteId, personId, compId, patch) =>
    update((d) => {
      const k = key(siteId, personId, compId);
      const cur = d.records[k] || { date: "", score: null };
      const merged = { ...cur, ...patch };
      if (!merged.date && (merged.score === null || merged.score === "")) delete d.records[k];
      else d.records[k] = merged;
    });

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "site-training-tracker.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (obj.sites && obj.people) {
          const s = normalize(obj);
          setState(s);
          setSelectedSite(s.sites[0]?.id ?? null);
        }
      } catch (_) {
        /* ignore bad file */
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  };

  if (!state || !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading tracker…
      </div>
    );
  }

  const saveLabel = {
    idle: "",
    saving: "Saving…",
    saved: "Saved",
    local: "Session only",
  }[saveStatus];

  return (
    <div className="font-sans text-slate-800 bg-slate-50 min-h-screen">
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="px-5 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded bg-emerald-400 flex items-center justify-center text-slate-900 font-bold text-sm">
              M
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Site Training Tracker</h1>
              <p className="text-xs text-slate-400 leading-tight">
                Quiz scores &amp; training dates by site
              </p>
            </div>
          </div>
          <nav className="flex gap-1 ml-2">
            {[
              ["sites", "Sites"],
              ["quizzes", "Quizzes"],
              ["people", "People"],
              ["overview", "Overview"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === id ? "bg-white text-slate-900" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {saveLabel && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    saveStatus === "saving" ? "bg-amber-400" : saveStatus === "local" ? "bg-slate-500" : "bg-emerald-400"
                  }`}
                />
                {saveLabel}
              </span>
            )}
            <button onClick={exportJSON} className="text-xs text-slate-300 hover:text-white">
              Export
            </button>
            <button onClick={() => fileInput.current?.click()} className="text-xs text-slate-300 hover:text-white">
              Import
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              onChange={importJSON}
              className="hidden"
            />
          </div>
        </div>
      </header>

      <main className="p-5">
        {view === "sites" && (
          <SitesView
            state={state}
            stats={stats}
            threshold={threshold}
            selectedSite={selectedSite}
            setSelectedSite={setSelectedSite}
            update={update}
            setRecord={setRecord}
          />
        )}
        {view === "quizzes" && (
          <QuizzesView state={state} update={update} />
        )}
        {view === "people" && (
          <PeopleView state={state} stats={stats} update={update} />
        )}
        {view === "overview" && (
          <OverviewView
            state={state}
            stats={stats}
            threshold={threshold}
            update={update}
            onResetSeed={() => {
              const s = buildSeed();
              setState(s);
              setSelectedSite(s.sites[0]?.id ?? null);
            }}
          />
        )}
      </main>
    </div>
  );
}

/* ───────────────────────── Sites View ───────────────────────── */
function SitesView({ state, stats, threshold, selectedSite, setSelectedSite, update, setRecord }) {
  const [search, setSearch] = useState("");
  const [siteModal, setSiteModal] = useState(null); // {mode:'add'|'edit', site}
  const [cellEdit, setCellEdit] = useState(null); // {siteId, personId, comp}
  const [addComp, setAddComp] = useState(false);

  const site = state.sites.find((s) => s.id === selectedSite) || null;
  const filtered = state.sites.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex gap-5 items-start flex-col lg:flex-row">
      {/* Site list */}
      <aside className="w-full lg:w-72 shrink-0 bg-white rounded-xl border border-slate-200">
        <div className="p-3 border-b border-slate-100 space-y-2">
          <input
            className={input}
            placeholder="Search sites"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className={`${btnPrimary} w-full justify-center`} onClick={() => setSiteModal({ mode: "add" })}>
            + Add site
          </button>
        </div>
        <ul className="max-h-[70vh] overflow-y-auto py-1">
          {filtered.map((s) => {
            const pct = stats.sitePct[s.id] ?? 0;
            const active = s.id === selectedSite;
            return (
              <li key={s.id}>
                <button
                  onClick={() => setSelectedSite(s.id)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 ${
                    active ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  <Swatch color={s.color} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{s.name}</span>
                    <span className="mt-1 block">
                      <ProgressBar value={pct} />
                    </span>
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums">{Math.round(pct * 100)}%</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Site detail */}
      <section className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200">
        {!site ? (
          <div className="p-10 text-center text-slate-400 text-sm">Select a site to view its quizzes.</div>
        ) : (
          <>
            <div
              className="px-5 py-4 rounded-t-xl flex items-center gap-3"
              style={{ backgroundColor: site.color, color: textOn(site.color) }}
            >
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">{site.name}</h2>
                {site.category && <p className="text-xs opacity-80">{site.category}</p>}
              </div>
              <button
                className="rounded-lg px-3 py-1.5 text-sm font-medium bg-white/80 text-slate-800 hover:bg-white"
                onClick={() => setSiteModal({ mode: "edit", site })}
              >
                Edit
              </button>
            </div>

            {/* component chips */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
              {site.components.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                >
                  {c.name}
                  {c.id !== "trained" && (
                    <button
                      className="text-slate-400 hover:text-rose-500"
                      title="Remove from site"
                      onClick={() =>
                        update((d) => {
                          const tgt = d.sites.find((x) => x.id === site.id);
                          tgt.components = tgt.components.filter((x) => x.id !== c.id);
                        })
                      }
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              <button className={`${btnGhost} text-xs px-2 py-1`} onClick={() => setAddComp(true)}>
                + Component
              </button>
            </div>

            {/* matrix */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-slate-500">
                    <th className="sticky left-0 bg-white text-left font-medium px-4 py-2 border-b border-slate-100 min-w-40">
                      Person
                    </th>
                    {site.components.map((c) => (
                      <th
                        key={c.id}
                        className="text-left font-medium px-3 py-2 border-b border-slate-100 whitespace-nowrap"
                      >
                        {c.name}
                        {c.scored && (
                          <span className="ml-1 text-slate-300 font-normal">·score</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.people.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="sticky left-0 bg-white px-4 py-2 border-b border-slate-50">
                        <div className="font-medium">{p.name}</div>
                        {p.trainer && (
                          <div className="text-xs text-slate-400">{p.trainer}</div>
                        )}
                      </td>
                      {site.components.map((c) => {
                        const rec = state.records[key(site.id, p.id, c.id)];
                        const st = cellStatus(c, rec, threshold);
                        return (
                          <td key={c.id} className="px-3 py-2 border-b border-slate-50">
                            <button
                              onClick={() => setCellEdit({ siteId: site.id, personId: p.id, comp: c })}
                              className={`w-full text-left rounded-md border px-2 py-1.5 text-xs leading-tight min-w-24 ${STATUS_STYLE[st]} hover:brightness-95`}
                            >
                              {c.scored ? (
                                rec && rec.score !== null && rec.score !== undefined && rec.score !== "" ? (
                                  <>
                                    <span className="font-semibold tabular-nums">{rec.score}%</span>
                                    {rec.date && (
                                      <span className="block opacity-70 tabular-nums">{fmtDate(rec.date)}</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="opacity-60">—</span>
                                )
                              ) : rec && rec.date ? (
                                <span className="font-medium tabular-nums">{fmtDate(rec.date)}</span>
                              ) : (
                                <span className="opacity-60">—</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {siteModal && (
        <SiteModal
          mode={siteModal.mode}
          site={siteModal.site}
          onClose={() => setSiteModal(null)}
          onSave={(data) => {
            if (siteModal.mode === "add") {
              const id = uid();
              update((d) =>
                d.sites.push({
                  id,
                  name: data.name || "New Site",
                  color: data.color,
                  category: data.category,
                  components: [{ ...TRAINED }, ...COMMON_QUIZZES.map((c) => ({ ...c }))],
                })
              );
              setSelectedSite(id);
            } else {
              update((d) => {
                const t = d.sites.find((x) => x.id === siteModal.site.id);
                t.name = data.name;
                t.color = data.color;
                t.category = data.category;
              });
            }
            setSiteModal(null);
          }}
          onDelete={
            siteModal.mode === "edit"
              ? () => {
                  update((d) => {
                    d.sites = d.sites.filter((x) => x.id !== siteModal.site.id);
                    Object.keys(d.records).forEach((k) => {
                      const p = k.split("|");
                      if (p[0] === "T" && p[1] === siteModal.site.id) delete d.records[k];
                    });
                  });
                  setSelectedSite(state.sites[0]?.id ?? null);
                  setSiteModal(null);
                }
              : null
          }
        />
      )}

      {addComp && site && (
        <AddComponentModal
          site={site}
          library={state.library}
          onClose={() => setAddComp(false)}
          onAdd={(comp) => {
            update((d) => {
              if (!d.library.some((c) => c.id === comp.id)) d.library.push({ ...comp });
              const t = d.sites.find((x) => x.id === site.id);
              if (!t.components.some((c) => c.id === comp.id)) t.components.push(comp);
            });
            setAddComp(false);
          }}
        />
      )}

      {cellEdit && (
        <CellEditModal
          state={state}
          edit={cellEdit}
          threshold={threshold}
          onClose={() => setCellEdit(null)}
          onSave={(patch) => {
            setRecord(cellEdit.siteId, cellEdit.personId, cellEdit.comp.id, patch);
            setCellEdit(null);
          }}
          onClear={() => {
            update((d) => {
              delete d.records[key(cellEdit.siteId, cellEdit.personId, cellEdit.comp.id)];
            });
            setCellEdit(null);
          }}
        />
      )}
    </div>
  );
}

const PALETTE = [
  "#FCE4D6", "#F8CBAD", "#D9D9D9", "#9DC3E6", "#E4B7E5",
  "#FFC000", "#7030A0", "#FFFF00", "#92D050", "#000000",
];

function SiteModal({ mode, site, onClose, onSave, onDelete }) {
  const [name, setName] = useState(site?.name ?? "");
  const [color, setColor] = useState(site?.color ?? "#9DC3E6");
  const [category, setCategory] = useState(site?.category ?? "");
  return (
    <Modal title={mode === "add" ? "Add site" : "Edit site"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Site name</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Category / notes (optional)</label>
          <input
            className={input}
            value={category}
            placeholder="e.g. equipment type, region"
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Colour</label>
          <div className="flex items-center gap-2 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-md border-2 ${color === c ? "border-slate-900" : "border-slate-200"}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-9 rounded border border-slate-200 bg-white"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          {onDelete ? (
            <button className={btnDanger} onClick={onDelete}>
              Delete site
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button className={btnGhost} onClick={onClose}>
              Cancel
            </button>
            <button className={btnPrimary} onClick={() => onSave({ name, color, category })}>
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function AddComponentModal({ site, library, onClose, onAdd }) {
  const existing = new Set(site.components.map((c) => c.id));
  const available = library.filter((c) => !existing.has(c.id));
  const [customName, setCustomName] = useState("");
  return (
    <Modal title="Add component" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">From quiz library</p>
          {available.length === 0 ? (
            <p className="text-sm text-slate-400">All library quizzes already added.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {available.map((c) => (
                <button key={c.id} className={btnGhost} onClick={() => onAdd({ ...c })}>
                  + {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Custom quiz (unique to this site)</p>
          <div className="flex gap-2">
            <input
              className={input}
              placeholder="Quiz name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <button
              className={btnPrimary}
              disabled={!customName.trim()}
              onClick={() => onAdd({ id: uid(), name: customName.trim(), scored: true })}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CellEditModal({ state, edit, threshold, onClose, onSave, onClear }) {
  const rec = state.records[key(edit.siteId, edit.personId, edit.comp.id)] || {};
  const site = state.sites.find((s) => s.id === edit.siteId);
  const person = state.people.find((p) => p.id === edit.personId);
  const [date, setDate] = useState(rec.date || "");
  const [score, setScore] = useState(rec.score ?? "");
  const scored = edit.comp.scored;
  const shared = edit.comp.id !== "trained";
  const otherSites = shared
    ? state.sites.filter((s) => s.id !== site.id && s.components.some((c) => c.id === edit.comp.id)).length
    : 0;
  const passing = scored && score !== "" && Number(score) >= threshold;
  return (
    <Modal title={`${person.name} — ${edit.comp.name}`} onClose={onClose}>
      <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
        <Swatch color={site.color} /> {site.name}
      </p>
      {shared && otherSites > 0 && (
        <p className="text-xs text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 mb-4">
          This is a shared quiz — saving updates {person.name}'s result on {otherSites} other{" "}
          {otherSites === 1 ? "site" : "sites"} too.
        </p>
      )}
      <div className="space-y-4">
        {scored && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Score (%) · pass ≥ {threshold}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                className={input}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                autoFocus
              />
              {score !== "" && (
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    passing ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {passing ? "Pass" : "Below"}
                </span>
              )}
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {scored ? "Date taken" : "Date trained"}
          </label>
          <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex items-center justify-between pt-1">
          <button className={btnDanger} onClick={onClear}>
            Clear
          </button>
          <div className="flex gap-2">
            <button className={btnGhost} onClick={onClose}>
              Cancel
            </button>
            <button
              className={btnPrimary}
              onClick={() =>
                onSave({ date, score: scored ? (score === "" ? null : Number(score)) : null })
              }
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── People View ───────────────────────── */
function PeopleView({ state, stats, update }) {
  const [modal, setModal] = useState(null); // {mode, person}
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">People</h2>
        <button className={btnPrimary} onClick={() => setModal({ mode: "add" })}>
          + Add person
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-left">
              <th className="px-5 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Trainer</th>
              <th className="px-3 py-2 font-medium">Sites trained</th>
              <th className="px-3 py-2 font-medium">Last trained</th>
              <th className="px-3 py-2 font-medium w-48">Quiz pass rate</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {state.people.map((p) => {
              const trained = stats.personSites[p.id] || 0;
              const last = stats.personLast[p.id];
              const pct = stats.personPct[p.id] ?? 0;
              return (
                <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50/60">
                  <td className="px-5 py-2.5 font-medium">{p.name}</td>
                  <td className="px-3 py-2.5 text-slate-600">{p.trainer || "—"}</td>
                  <td className="px-3 py-2.5">
                    {trained === 0 ? (
                      <span className="text-xs font-medium text-rose-600 bg-rose-50 rounded px-1.5 py-0.5">
                        Not trained
                      </span>
                    ) : (
                      <span className="tabular-nums">
                        {trained}
                        <span className="text-slate-400"> / {state.sites.length}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-600">{last ? fmtDate(last) : "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <ProgressBar value={pct} />
                      </div>
                      <span className="text-xs text-slate-400 tabular-nums w-9 text-right">
                        {Math.round(pct * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button className={`${btnGhost} text-xs`} onClick={() => setModal({ mode: "edit", person: p })}>
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <PersonModal
          mode={modal.mode}
          person={modal.person}
          onClose={() => setModal(null)}
          onSave={(data) => {
            if (modal.mode === "add") {
              update((d) => d.people.push({ id: uid(), name: data.name || "New person", trainer: data.trainer }));
            } else {
              update((d) => {
                const t = d.people.find((x) => x.id === modal.person.id);
                t.name = data.name;
                t.trainer = data.trainer;
              });
            }
            setModal(null);
          }}
          onDelete={
            modal.mode === "edit"
              ? () => {
                  update((d) => {
                    d.people = d.people.filter((x) => x.id !== modal.person.id);
                    Object.keys(d.records).forEach((k) => {
                      const p = k.split("|");
                      if ((p[0] === "T" && p[2] === modal.person.id) || (p[0] === "Q" && p[1] === modal.person.id))
                        delete d.records[k];
                    });
                  });
                  setModal(null);
                }
              : null
          }
        />
      )}
    </div>
  );
}

function PersonModal({ mode, person, onClose, onSave, onDelete }) {
  const [name, setName] = useState(person?.name ?? "");
  const [trainer, setTrainer] = useState(person?.trainer ?? "");
  return (
    <Modal title={mode === "add" ? "Add person" : "Edit person"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Trainer (optional)</label>
          <input className={input} value={trainer} onChange={(e) => setTrainer(e.target.value)} />
        </div>
        <div className="flex items-center justify-between pt-1">
          {onDelete ? (
            <button className={btnDanger} onClick={onDelete}>
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button className={btnGhost} onClick={onClose}>
              Cancel
            </button>
            <button className={btnPrimary} onClick={() => onSave({ name, trainer })}>
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Quizzes View (bulk assign) ───────────────────────── */
function QuizzesView({ state, update }) {
  const [addType, setAddType] = useState(false);
  const { library, sites } = state;

  const isAssigned = (siteId, compId) =>
    sites.find((s) => s.id === siteId)?.components.some((c) => c.id === compId);

  const setAssign = (siteId, comp, on) =>
    update((d) => {
      const site = d.sites.find((s) => s.id === siteId);
      if (on) {
        if (!site.components.some((c) => c.id === comp.id)) site.components.push({ ...comp });
      } else {
        site.components = site.components.filter((c) => c.id !== comp.id);
      }
    });

  const toggleOne = (siteId, comp) => setAssign(siteId, comp, !isAssigned(siteId, comp.id));

  const assignAll = (comp) =>
    update((d) =>
      d.sites.forEach((site) => {
        if (!site.components.some((c) => c.id === comp.id)) site.components.push({ ...comp });
      })
    );

  const clearAll = (comp) =>
    update((d) =>
      d.sites.forEach((site) => {
        site.components = site.components.filter((c) => c.id !== comp.id);
      })
    );

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-slate-800">Quizzes</h2>
          <p className="text-xs text-slate-400">Tick a row to assign a quiz to many sites at once.</p>
        </div>
        <button className={btnPrimary} onClick={() => setAddType(true)}>
          + New quiz
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium text-slate-500 min-w-52 border-b border-slate-100">
                Quiz
              </th>
              {sites.map((s) => (
                <th
                  key={s.id}
                  className="px-1.5 py-2 font-medium text-slate-500 border-b border-slate-100"
                  title={s.name}
                >
                  <div className="h-24 flex flex-col items-center justify-end gap-1">
                    <span className="whitespace-nowrap" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                      {s.name}
                    </span>
                    <Swatch color={s.color} size={10} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {library.map((comp) => {
              const count = sites.filter((s) => isAssigned(s.id, comp.id)).length;
              return (
                <tr key={comp.id} className="hover:bg-slate-50/50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 border-t border-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-700">{comp.name}</div>
                        <div className="text-slate-400">
                          {count}/{sites.length} sites
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          className="rounded px-1.5 py-0.5 text-xs text-emerald-700 hover:bg-emerald-50"
                          onClick={() => assignAll(comp)}
                        >
                          All
                        </button>
                        <button
                          className="rounded px-1.5 py-0.5 text-xs text-rose-600 hover:bg-rose-50"
                          onClick={() => clearAll(comp)}
                        >
                          None
                        </button>
                      </div>
                    </div>
                  </td>
                  {sites.map((s) => {
                    const on = isAssigned(s.id, comp.id);
                    return (
                      <td key={s.id} className="px-1 py-1 border-t border-slate-50 text-center">
                        <button
                          onClick={() => toggleOne(s.id, comp)}
                          className={`h-6 w-6 mx-auto rounded-md border flex items-center justify-center transition-colors ${
                            on
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "bg-white border-slate-300 text-transparent hover:border-slate-400"
                          }`}
                          title={`${comp.name} · ${s.name}`}
                        >
                          ✓
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {addType && (
        <AddQuizTypeModal
          state={state}
          onClose={() => setAddType(false)}
          onAdd={({ name, scored, applyAll }) => {
            const comp = { id: uid(), name: name.trim(), scored };
            update((d) => {
              d.library.push(comp);
              if (applyAll)
                d.sites.forEach((site) => {
                  if (!site.components.some((c) => c.id === comp.id)) site.components.push({ ...comp });
                });
            });
            setAddType(false);
          }}
        />
      )}
    </div>
  );
}

function AddQuizTypeModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [scored, setScored] = useState(true);
  const [applyAll, setApplyAll] = useState(false);
  return (
    <Modal title="New quiz" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Quiz name</label>
          <input
            className={input}
            value={name}
            placeholder="e.g. Hydraulic Taxi Quiz"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={scored} onChange={(e) => setScored(e.target.checked)} />
          Records a score (uncheck for a date-only sign-off)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
          Assign to every site now
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button className={btnPrimary} disabled={!name.trim()} onClick={() => onAdd({ name, scored, applyAll })}>
            Add quiz
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Overview View ───────────────────────── */
function OverviewView({ state, stats, threshold, update, onResetSeed }) {
  const cards = [
    ["Sites", state.sites.length],
    ["People", state.people.length],
    ["Quiz cells passed", `${stats.totalPassed} / ${stats.totalScored}`],
    ["Overall completion", `${Math.round(stats.overall * 100)}%`],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(([label, val]) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
            <div className="text-2xl font-bold text-slate-800 mt-1 tabular-nums">{val}</div>
          </div>
        ))}
      </div>

      {/* Trained heatmap: sites x people */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-slate-800">Training matrix</h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-emerald-400 inline-block" /> trained
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-slate-100 border border-slate-200 inline-block" /> not yet
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white px-3 py-2 text-left font-medium text-slate-500 min-w-36">
                  Site
                </th>
                {state.people.map((p) => (
                  <th key={p.id} className="px-1.5 py-2 font-medium text-slate-500">
                    <div className="h-20 flex items-end justify-center">
                      <span className="rotate-180 whitespace-nowrap" style={{ writingMode: "vertical-rl" }}>
                        {p.name}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.sites.map((s) => (
                <tr key={s.id}>
                  <td className="sticky left-0 bg-white px-3 py-1.5 border-t border-slate-50">
                    <span className="flex items-center gap-2">
                      <Swatch color={s.color} size={12} />
                      <span className="truncate">{s.name}</span>
                    </span>
                  </td>
                  {state.people.map((p) => {
                    const tr = state.records[key(s.id, p.id, "trained")];
                    const on = tr && tr.date;
                    return (
                      <td key={p.id} className="px-1 py-1 border-t border-slate-50 text-center">
                        <div
                          title={on ? `${p.name} · ${fmtDate(tr.date)}` : `${p.name} · not trained`}
                          className={`h-6 w-6 mx-auto rounded-sm ${
                            on ? "bg-emerald-400" : "bg-slate-100 border border-slate-200"
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Quiz pass threshold</label>
          <input
            type="number"
            min="0"
            max="100"
            value={threshold}
            onChange={(e) =>
              update((d) => {
                d.settings.passThreshold = Math.max(0, Math.min(100, Number(e.target.value) || 0));
              })
            }
            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <span className="text-sm text-slate-400">%</span>
        </div>
        <button className={btnDanger} onClick={onResetSeed}>
          Reset to original sheet data
        </button>
      </div>
    </div>
  );
}
