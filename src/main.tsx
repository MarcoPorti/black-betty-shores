import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, ArrowLeftRight, ArrowRight, CalendarDays, Check, ChevronDown, Clipboard, ClipboardPaste, Download, Ellipsis, Info, Plus, RefreshCw, Settings2, Share2, Sparkles, Trash2, UserRoundPlus, Users, X, Waves } from "lucide-react";
import { Assignment, BoatState, Chore, DAY_NAMES, Frequency, LONG_DAY_NAMES, Person, addDays, dateKey, formatRange, formatShortDate, parseDateKey, startOfWeek, weekDates } from "./types";
import { generateDay, generateWeek, repairDuplicateTaskAssignments, warningsForDay } from "./lib/generator";
import { decodeBackup, encodeBackup } from "./lib/backup";
import { loadState, saveState } from "./lib/storage";
import { downloadWeekPng } from "./lib/export";
import { Button } from "./components/ui/button";
import "./styles.css";

type View = "week" | "people" | "chores" | "backup";

const DEFAULT_CHORES: Chore[] = [
  { id: "water", name: "Water", emoji: "💧", required: 1, frequency: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "dishes", name: "Dishes", emoji: "🍽️", required: 2, frequency: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "jaro", name: "Jaro", emoji: "🧹", required: 1, frequency: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "watch", name: "Watch", emoji: "👀", required: 2, frequency: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "breakfast", name: "Breakfast", emoji: "🥐", required: 1, frequency: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "lunch", name: "Lunch", emoji: "🥗", required: 1, frequency: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "dinner", name: "Dinner", emoji: "🍲", required: 1, frequency: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
];

const SEEDED_PERSON_IDS = new Set(["alex", "bea", "nico", "rita", "sam", "tino"]);

function isSeededCrew(people: Person[]): boolean {
  return people.length === SEEDED_PERSON_IDS.size && people.every((person) => SEEDED_PERSON_IDS.has(person.id));
}

function initialState(): BoatState {
  const weekStart = dateKey(startOfWeek(new Date()));
  const people: Person[] = [];
  return { version: 1, weekStart, people, chores: DEFAULT_CHORES, schedule: generateWeek(people, DEFAULT_CHORES, weekStart), onboardingComplete: false };
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function initials(name: string): string {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function App() {
  const [state, setState] = useState<BoatState>(() => initialState());
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("week");
  const [selectedDay, setSelectedDay] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [backupText, setBackupText] = useState("");
  const [restoreText, setRestoreText] = useState("");
  const [backupError, setBackupError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [regenerateMode, setRegenerateMode] = useState<"day" | "remaining">("day");
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    loadState().then((saved) => {
      if (saved) {
        const shouldClearSeededCrew = isSeededCrew(saved.people);
        const freshOnboardingState = shouldClearSeededCrew || !saved.onboardingComplete
          ? { ...saved, people: [], schedule: generateWeek([], saved.chores, saved.weekStart) }
          : saved;
        setState({ ...freshOnboardingState, schedule: repairDuplicateTaskAssignments(freshOnboardingState.schedule) });
        setShowOnboarding(shouldClearSeededCrew || !saved.onboardingComplete);
      } else setShowOnboarding(true);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timeout = window.setTimeout(() => { void saveState(state); }, 180);
    return () => window.clearTimeout(timeout);
  }, [state, loaded]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const dates = useMemo(() => weekDates(state.weekStart), [state.weekStart]);
  const currentDate = dates[selectedDay];
  const currentAssignments = state.schedule[currentDate] ?? [];
  const currentWarnings = warningsForDay(state, currentDate, selectedDay);

  function updateState(next: Partial<BoatState>) {
    setState((previous) => ({ ...previous, ...next }));
  }

  function regenerate(mode: "day" | "remaining" = "day") {
    const nextSchedule = { ...state.schedule };
    if (mode === "day") nextSchedule[currentDate] = generateDay(state.people, state.chores, currentDate, selectedDay, nextSchedule);
    else dates.slice(selectedDay).forEach((date, offset) => { nextSchedule[date] = generateDay(state.people, state.chores, date, selectedDay + offset, nextSchedule); });
    updateState({ schedule: nextSchedule });
    setToast(mode === "day" ? `${LONG_DAY_NAMES[selectedDay]} refreshed` : `Remaining week refreshed from ${LONG_DAY_NAMES[selectedDay]}`);
  }

  function regenerateWholeWeek() {
    updateState({ schedule: generateWeek(state.people, state.chores, state.weekStart) });
    setToast("Whole week regenerated");
  }

  function swapAssignments(first: Assignment, second: Assignment) {
    const nextSchedule = { ...state.schedule, [currentDate]: [...currentAssignments] };
    const firstIndex = nextSchedule[currentDate].indexOf(first);
    const secondIndex = nextSchedule[currentDate].indexOf(second);
    if (firstIndex < 0 || secondIndex < 0) return;
    const firstPerson = nextSchedule[currentDate][firstIndex].personId;
    nextSchedule[currentDate][firstIndex] = { ...nextSchedule[currentDate][firstIndex], personId: nextSchedule[currentDate][secondIndex].personId };
    nextSchedule[currentDate][secondIndex] = { ...nextSchedule[currentDate][secondIndex], personId: firstPerson };
    updateState({ schedule: nextSchedule });
  }

  function setAssignment(index: number, personId: string | null) {
    const day = [...currentAssignments];
    day[index] = { ...day[index], personId };
    updateState({ schedule: { ...state.schedule, [currentDate]: day } });
  }

  function copyBackup() {
    const text = encodeBackup(state);
    setBackupText(text);
    void navigator.clipboard?.writeText(text).then(() => setToast("Backup copied to clipboard")).catch(() => setToast("Backup ready to copy"));
  }

  function openBackup() {
    setBackupText(encodeBackup(state));
    setRestoreText("");
    setView("backup");
    setMoreOpen(false);
  }

  function restoreBackup() {
    setBackupError(null);
    try {
      const next = decodeBackup(restoreText);
      if (!window.confirm("Restore this backup and overwrite the current boat setup?")) return;
      const repairedSchedule = repairDuplicateTaskAssignments(next.schedule);
      updateState({ ...next, schedule: repairedSchedule, onboardingComplete: true });
      setBackupText(encodeBackup({ ...state, ...next, schedule: repairedSchedule, onboardingComplete: true }));
      setRestoreText("");
      setToast("Backup restored");
      setView("week");
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Could not restore that backup.");
    }
  }

  function importOnboardingBackup(input: string): string | null {
    try {
      const next = decodeBackup(input);
      if (!window.confirm("Import this crew and replace the starter setup?")) return null;
      const repairedSchedule = repairDuplicateTaskAssignments(next.schedule);
      const importedState = { ...next, schedule: repairedSchedule, onboardingComplete: true as const };
      updateState(importedState);
      setBackupText(encodeBackup({ ...state, ...importedState }));
      setShowOnboarding(false);
      setView("week");
      setToast(`${next.people.length} crew member${next.people.length === 1 ? "" : "s"} imported`);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Could not import that crew backup.";
    }
  }

  function shiftWeek(amount: number) {
    const nextStart = dateKey(addDays(parseDateKey(state.weekStart), amount * 7));
    const nextSchedule = generateWeek(state.people, state.chores, nextStart);
    updateState({ weekStart: nextStart, schedule: nextSchedule });
    setSelectedDay(0);
  }

  function finishOnboarding(nextView: View = "week") {
    updateState({ onboardingComplete: true });
    setShowOnboarding(false);
    setView(nextView);
    setToast(nextView === "people" ? "Add your crew to get started" : "Your weekly board is ready");
  }

  if (!loaded) return <div className="loading-screen"><Waves size={28} /><span>Reading your local deck…</span></div>;
  if (showOnboarding) return <Onboarding onStart={() => finishOnboarding("people")} onImport={importOnboardingBackup} />;

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand"><span>Black Betty Shores</span></div>
        <div className="top-actions"><span className="saved-state"><span className="pulse-dot" /> Saved locally</span></div>
      </header>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-kicker">YOUR BOAT</div>
          <div className="boat-card"><div><strong>Black Betty Shores</strong></div></div>
          <nav className="nav-stack" aria-label="Main navigation">
            <NavButton icon={<CalendarDays size={18} />} label="This week" active={view === "week"} onClick={() => setView("week")} badge={currentWarnings.length || undefined} />
            <NavButton icon={<Users size={18} />} label="People" active={view === "people"} onClick={() => setView("people")} />
            <NavButton icon={<Settings2 size={18} />} label="Chores & rules" active={view === "chores"} onClick={() => setView("chores")} />
            <NavButton icon={<Share2 size={18} />} label="Backup & share" active={view === "backup"} onClick={openBackup} />
          </nav>
          <div className="sidebar-footer"><div className="tip-card"><Sparkles size={16} /><p>Small crew? Leave spots open and Tideboard will flag them for you.</p></div><span className="version">v1.0 · works offline</span></div>
        </aside>
        <main className="main-content">
          {view === "week" && <WeekView state={state} dates={dates} selectedDay={selectedDay} setSelectedDay={setSelectedDay} currentDate={currentDate} assignments={currentAssignments} warnings={currentWarnings} setAssignment={setAssignment} swapAssignments={swapAssignments} regenerate={regenerate} regenerateMode={regenerateMode} setRegenerateMode={setRegenerateMode} shiftWeek={shiftWeek} onBackup={openBackup} onExport={() => void downloadWeekPng(state).then(() => setToast("High-resolution PNG downloaded")).catch(() => setToast("PNG export failed"))} onRegenerateWholeWeek={regenerateWholeWeek} />}
          {view === "people" && <PeopleView state={state} updateState={updateState} onRegenerate={() => regenerate("remaining")} />}
          {view === "chores" && <ChoresView state={state} updateState={updateState} onRegenerate={() => regenerate("remaining")} />}
          {view === "backup" && <BackupView backupText={backupText} restoreText={restoreText} setRestoreText={setRestoreText} copyBackup={copyBackup} restoreBackup={restoreBackup} error={backupError} />}
        </main>
      </div>
      <MobileNav view={view} setView={setView} moreOpen={moreOpen} setMoreOpen={setMoreOpen} onBackup={openBackup} />
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
    </div>
  );
}

function NavButton({ icon, label, active, onClick, badge }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{badge ? <em>{badge}</em> : null}</button>;
}

function MobileNav({ view, setView, moreOpen, setMoreOpen, onBackup }: { view: View; setView: (view: View) => void; moreOpen: boolean; setMoreOpen: (open: boolean) => void; onBackup: () => void }) {
  function choose(nextView: View) {
    setView(nextView);
    setMoreOpen(false);
  }
  return <>
    {moreOpen && <button className="more-scrim" aria-label="Close more menu" onClick={() => setMoreOpen(false)} />}
    {moreOpen && <div className="more-sheet"><div className="more-sheet-handle" /><div className="section-label">MORE ON DECK</div><button onClick={() => choose("chores")}><Settings2 size={17} /><span><strong>Chores & rules</strong><small>Adjust tasks and preferences.</small></span><ArrowRight size={15} /></button><button onClick={onBackup}><Share2 size={17} /><span><strong>Backup & share</strong><small>Copy or restore your boat setup.</small></span><ArrowRight size={15} /></button></div>}
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <button className={view === "week" ? "active" : ""} onClick={() => choose("week")}><CalendarDays size={19} /><span>Week</span></button>
      <button className={view === "people" ? "active" : ""} onClick={() => choose("people")}><Users size={19} /><span>Crew</span></button>
      <button className={`${moreOpen || view === "chores" || view === "backup" ? "active" : ""}`} onClick={() => setMoreOpen(!moreOpen)}><Ellipsis size={20} /><span>More</span></button>
    </nav>
  </>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="header-action">{action}</div>}</div>;
}

function WeekView({ state, dates, selectedDay, setSelectedDay, currentDate, assignments, warnings, setAssignment, swapAssignments, regenerate, regenerateMode, setRegenerateMode, shiftWeek, onBackup, onExport, onRegenerateWholeWeek }: { state: BoatState; dates: string[]; selectedDay: number; setSelectedDay: (value: number) => void; currentDate: string; assignments: Assignment[]; warnings: string[]; setAssignment: (index: number, personId: string | null) => void; swapAssignments: (first: Assignment, second: Assignment) => void; regenerate: (mode?: "day" | "remaining") => void; regenerateMode: "day" | "remaining"; setRegenerateMode: (mode: "day" | "remaining") => void; shiftWeek: (amount: number) => void; onBackup: () => void; onExport: () => void; onRegenerateWholeWeek: () => void }) {
  const grouped = state.chores.map((chore) => ({ chore, slots: assignments.map((assignment, index) => ({ assignment, index })).filter(({ assignment }) => assignment.choreId === chore.id) }));
  const assignedToday = assignments.filter((assignment) => assignment.personId).length;
  const totalToday = assignments.length;
  return <>
    <div className="week-toolbar"><div className="week-switcher"><button className="icon-button" onClick={() => shiftWeek(-1)} aria-label="Previous week"><ArrowLeft size={17} /></button><span>{formatRange(state.weekStart)}</span><button className="icon-button" onClick={() => shiftWeek(1)} aria-label="Next week"><ArrowRight size={17} /></button></div><div className="week-actions"><button className="button secondary" onClick={onBackup}><Share2 size={15} />Backup</button><button className="button primary" onClick={onExport}><Download size={15} />Export PNG</button></div></div>
    <div className="day-tabs">{dates.map((date, index) => <button key={date} className={`day-tab ${selectedDay === index ? "selected" : ""}`} onClick={() => setSelectedDay(index)}><span>{DAY_NAMES[index]}</span><strong>{parseDateKey(date).getDate()}</strong><small>{state.schedule[date]?.filter((assignment) => assignment.personId).length ?? 0}/{state.schedule[date]?.length ?? 0}</small></button>)}</div>
    <section className="surface grid-preview"><div className="surface-heading compact"><div><div className="section-label">AT A GLANCE</div><h2>Week grid</h2></div><div className="grid-actions"><select value={regenerateMode} onChange={(event) => setRegenerateMode(event.target.value as "day" | "remaining")} aria-label="Regeneration scope"><option value="day">Just this day</option><option value="remaining">From this day onward</option></select><button className="button secondary" onClick={() => regenerate(regenerateMode)}><RefreshCw size={15} />Regenerate</button></div></div><div className="grid-scroll"><div className="week-grid"><div className="grid-corner">CHORE</div>{dates.map((date, index) => <div className="grid-day" key={date}><strong>{DAY_NAMES[index]}</strong><small>{formatShortDate(date)}</small></div>)}{state.chores.map((chore) => <div className="grid-row" key={chore.id}><div className="grid-chore"><span>{chore.emoji}</span>{chore.name}</div>{dates.map((date) => <div className="grid-cell" key={`${chore.id}-${date}`}>{(state.schedule[date] ?? []).filter((assignment) => assignment.choreId === chore.id).map((assignment, index) => <span className={assignment.personId ? "name-chip" : "name-chip open"} key={`${date}-${assignment.choreId}-${assignment.personId ?? "open"}-${index}`}>{state.people.find((person) => person.id === assignment.personId)?.name ?? "Open"}</span>)}</div>)}</div>)}</div></div></section>
    <section className="surface day-editor">
      <div className="surface-heading"><div><div className="section-label">{LONG_DAY_NAMES[selectedDay].toUpperCase()} · {formatShortDate(currentDate)}</div><h2>Today on deck</h2><p>{assignedToday} of {totalToday} spots assigned · tap a name to reassign</p></div></div>
      {warnings.length > 0 && <div className="warning-strip"><Info size={16} /><div><strong>{warnings.length} thing{warnings.length === 1 ? "" : "s"} need attention</strong><span>{warnings[0]}{warnings.length > 1 ? ` · +${warnings.length - 1} more` : ""}</span></div></div>}
      <div className="chore-list">{grouped.map(({ chore, slots }) => <ChoreAssignmentRow key={chore.id} chore={chore} slots={slots} people={state.people} setAssignment={setAssignment} swapAssignments={swapAssignments} />)}</div>
    </section>
    <div className="whole-week-action"><div><strong>Start this week over</strong><span>Regenerate every assignment while keeping your crew and rules.</span></div><button className="button secondary" onClick={onRegenerateWholeWeek}><RefreshCw size={15} />Regenerate week</button></div>
  </>;
}

function ChoreAssignmentRow({ chore, slots, people, setAssignment, swapAssignments }: { chore: Chore; slots: { assignment: Assignment; index: number }[]; people: Person[]; setAssignment: (index: number, personId: string | null) => void; swapAssignments: (first: Assignment, second: Assignment) => void }) {
  const [swapMode, setSwapMode] = useState(false);
  const [firstSlot, setFirstSlot] = useState<Assignment | null>(null);
  function pickSlot(assignment: Assignment) {
    if (!swapMode) return;
    if (!firstSlot) setFirstSlot(assignment);
    else {
      swapAssignments(firstSlot, assignment);
      setFirstSlot(null);
      setSwapMode(false);
    }
  }
  return <div className="chore-row"><div className="chore-title"><span className="chore-emoji">{chore.emoji}</span><div><strong>{chore.name}</strong><small>{chore.required} {chore.required === 1 ? "spot" : "spots"}</small></div></div><div className="assignment-slots">{slots.map(({ assignment, index }) => <div className={`assignment-slot ${firstSlot === assignment ? "swap-selected" : ""}`} key={`${assignment.choreId}-${index}`} onClick={() => pickSlot(assignment)}><select value={assignment.personId ?? ""} onClick={(event) => event.stopPropagation()} onChange={(event) => setAssignment(index, event.target.value || null)} aria-label={`${chore.name} assignment`}><option value="">Open spot</option>{people.filter((person) => person.id === assignment.personId || !slots.some((slot) => slot.assignment !== assignment && slot.assignment.personId === person.id)).map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></div>)}</div><button className={`swap-button ${swapMode ? "on" : ""}`} onClick={() => { setSwapMode(!swapMode); setFirstSlot(null); }}>{swapMode ? <X size={14} /> : <ArrowLeftRight size={14} />}<span>{swapMode ? "Cancel" : "Swap"}</span></button>{swapMode && <div className="swap-helper">Tap two spots in this row to swap them.</div>}</div>;
}

function PeopleView({ state, updateState, onRegenerate }: { state: BoatState; updateState: (next: Partial<BoatState>) => void; onRegenerate: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  function addPerson(event: FormEvent) { event.preventDefault(); if (!newName.trim()) return; const person: Person = { id: uid("person"), name: newName.trim(), arrival: state.weekStart, departure: dateKey(addDays(parseDateKey(state.weekStart), 8)), cannot: [], prefers: [], dislikes: [] }; updateState({ people: [...state.people, person] }); setNewName(""); setShowAdd(false); }
  function updatePerson(id: string, patch: Partial<Person>) { updateState({ people: state.people.map((person) => person.id === id ? { ...person, ...patch } : person) }); }
  function deletePerson(id: string) { if (!window.confirm("Remove this person from the boat? Their existing assignments will become open spots.")) return; updateState({ people: state.people.filter((person) => person.id !== id), schedule: Object.fromEntries(Object.entries(state.schedule).map(([date, assignments]) => [date, assignments.map((assignment) => assignment.personId === id ? { ...assignment, personId: null } : assignment)])) }); }
  return <><PageHeader eyebrow="THE CREW" title="Who’s aboard?" description="Arrival and departure dates keep assignments honest. Both dates stay off the rota." action={<button className="button primary" onClick={() => setShowAdd(true)}><Plus size={16} />Add person</button>} />
    <div className="info-callout"><Info size={17} /><span>Dates are inclusive for travel: someone arriving on Tuesday can start Wednesday, and someone leaving Tuesday can work Monday.</span></div>
    <section className="people-stack">{state.people.map((person) => <PersonCard key={person.id} person={person} chores={state.chores} updatePerson={updatePerson} deletePerson={deletePerson} />)}</section>
    <div className="bottom-action"><button className="button secondary" onClick={onRegenerate}><RefreshCw size={15} />Update assignments with these rules</button></div>
    {showAdd && <Modal title="Add a crew member" onClose={() => setShowAdd(false)}><form onSubmit={addPerson} className="form-stack"><label>Name<input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Jamie" /></label><div className="modal-actions"><button type="button" className="button ghost" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="button primary">Add person</button></div></form></Modal>}
  </>;
}

function PersonCard({ person, chores, updatePerson, deletePerson }: { person: Person; chores: Chore[]; updatePerson: (id: string, patch: Partial<Person>) => void; deletePerson: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  function toggle(kind: "cannot" | "prefers" | "dislikes", choreId: string) { const list = person[kind]; updatePerson(person.id, { [kind]: list.includes(choreId) ? list.filter((id) => id !== choreId) : [...list, choreId] }); }
  return <article className={`person-card ${expanded ? "expanded" : ""}`}><div className="person-main"><span className="large-avatar">{initials(person.name)}</span><div className="person-identity"><input className="person-name" value={person.name} onChange={(event) => updatePerson(person.id, { name: event.target.value })} /><span className="person-dates">{formatShortDate(person.arrival)} → {formatShortDate(person.departure)} <small>(travel days excluded)</small></span></div><button className="icon-button" onClick={() => setExpanded(!expanded)} aria-label="Edit crew member"><ChevronDown size={17} className={expanded ? "rotate" : ""} /></button></div>{expanded && <div className="person-details"><div className="date-fields"><label>Arrives<input type="date" value={person.arrival} onChange={(event) => updatePerson(person.id, { arrival: event.target.value })} /></label><label>Leaves<input type="date" value={person.departure} onChange={(event) => updatePerson(person.id, { departure: event.target.value })} /></label></div><div className="rule-groups"><RuleGroup label="Cannot do" hint="strict" tone="danger" selected={person.cannot} chores={chores} onToggle={(id) => toggle("cannot", id)} /><RuleGroup label="Prefers" hint="soft" tone="good" selected={person.prefers} chores={chores} onToggle={(id) => toggle("prefers", id)} /><RuleGroup label="Dislikes" hint="soft" tone="warn" selected={person.dislikes} chores={chores} onToggle={(id) => toggle("dislikes", id)} /></div><button className="delete-link" onClick={() => deletePerson(person.id)}><Trash2 size={14} />Remove {person.name}</button></div>}</article>;
}

function RuleGroup({ label, hint, tone, selected, chores, onToggle }: { label: string; hint: string; tone: string; selected: string[]; chores: Chore[]; onToggle: (id: string) => void }) {
  return <div className="rule-group"><div className="rule-heading"><strong>{label}</strong><span className={`rule-hint ${tone}`}>{hint}</span></div><div className="rule-chips">{chores.map((chore) => <button key={chore.id} className={`rule-chip ${selected.includes(chore.id) ? `selected ${tone}` : ""}`} onClick={() => onToggle(chore.id)}>{chore.emoji} {chore.name}</button>)}</div></div>;
}

function ChoresView({ state, updateState, onRegenerate }: { state: BoatState; updateState: (next: Partial<BoatState>) => void; onRegenerate: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  function updateChore(id: string, patch: Partial<Chore>) { updateState({ chores: state.chores.map((chore) => chore.id === id ? { ...chore, ...patch } : chore) }); }
  function addChore() { const chore: Chore = { id: uid("chore"), name: "New chore", emoji: "✨", required: 1, frequency: "daily", days: [0, 1, 2, 3, 4, 5, 6] }; updateState({ chores: [...state.chores, chore] }); setShowAdd(false); }
  function removeChore(id: string) { if (state.chores.length <= 1) return; updateState({ chores: state.chores.filter((chore) => chore.id !== id), people: state.people.map((person) => ({ ...person, cannot: person.cannot.filter((item) => item !== id), prefers: person.prefers.filter((item) => item !== id), dislikes: person.dislikes.filter((item) => item !== id) })) }); }
  return <><PageHeader eyebrow="THE ROUTINE" title="Chores & rules" description="Tune the rhythm to fit your boat, your season, and your crew." action={<button className="button primary" onClick={() => setShowAdd(true)}><Plus size={16} />Add chore</button>} /><section className="chore-settings">{state.chores.map((chore) => <article className="chore-setting-card" key={chore.id}><div className="chore-setting-top"><input className="emoji-input" value={chore.emoji} maxLength={3} onChange={(event) => updateChore(chore.id, { emoji: event.target.value })} /><input className="chore-name-input" value={chore.name} onChange={(event) => updateChore(chore.id, { name: event.target.value })} /><button className="icon-button danger-icon" onClick={() => removeChore(chore.id)} aria-label={`Remove ${chore.name}`}><Trash2 size={16} /></button></div><div className="chore-setting-fields"><label>Spots required<input type="number" min={1} max={8} value={chore.required} onChange={(event) => updateChore(chore.id, { required: Math.max(1, Number(event.target.value) || 1) })} /></label><label>Frequency<select value={chore.frequency} onChange={(event) => updateChore(chore.id, { frequency: event.target.value as Frequency })}><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="custom">Selected days</option></select></label></div>{chore.frequency === "custom" && <div className="day-picker">{DAY_NAMES.map((day, index) => <button key={day} className={chore.days.includes(index) ? "picked" : ""} onClick={() => updateChore(chore.id, { days: chore.days.includes(index) ? chore.days.filter((item) => item !== index) : [...chore.days, index] })}>{day}</button>)}</div>}<small className="setting-note">People can still mark this chore as cannot do, prefer, or dislike.</small></article>)}</section><div className="bottom-action"><button className="button secondary" onClick={onRegenerate}><RefreshCw size={15} />Apply changes to the rota</button></div>{showAdd && <Modal title="Add a chore" onClose={() => setShowAdd(false)}><div className="add-chore-preview"><span>✨</span><div><strong>New chore</strong><small>You can edit it immediately in the list.</small></div></div><div className="modal-actions"><button className="button ghost" onClick={() => setShowAdd(false)}>Cancel</button><button className="button primary" onClick={addChore}>Add chore</button></div></Modal>}</>;
}

function BackupView({ backupText, restoreText, setRestoreText, copyBackup, restoreBackup, error }: { backupText: string; restoreText: string; setRestoreText: (value: string) => void; copyBackup: () => void; restoreBackup: () => void; error: string | null }) {
  return <><PageHeader eyebrow="KEEP IT WITH YOU" title="Backup & restore" description="Your data stays on this device. Copy one compact backup whenever you want." /><div className="backup-layout single"><section className="surface backup-card"><div className="backup-icon"><Clipboard size={19} /></div><div className="section-label">COPY BACKUP</div><h2>Take your deck with you</h2><p>Paste this short, versioned backup into your notes, a crew chat, or a new device. It includes people, rules, chores, and the current week.</p><textarea className="backup-textarea" value={backupText} readOnly placeholder="Your backup will appear here…" spellCheck={false} /><div className="backup-actions"><button className="button primary" onClick={copyBackup}><Clipboard size={15} />Copy current backup</button></div></section></div><section className="surface restore-card"><div><div className="section-label">RESTORE BACKUP</div><h2>Paste a deck from anywhere</h2><p>Restoring overwrites the current setup only after you confirm.</p></div><div className="restore-row"><textarea className="backup-textarea" value={restoreText} onChange={(event) => setRestoreText(event.target.value)} placeholder="Paste a Tideboard backup here…" spellCheck={false} /><button className="button secondary" onClick={restoreBackup}>Validate & restore</button></div>{error && <div className="error-strip"><Info size={16} />{error}</div>}</section></>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-card"><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={17} /></button></div>{children}</div></div>;
}

function Onboarding({ onStart, onImport }: { onStart: () => void; onImport: (input: string) => string | null }) {
  const [mode, setMode] = useState<"choices" | "import">("choices");
  const [importText, setImportText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submitImport() {
    setError(null);
    if (!importText.trim()) {
      setError("Paste a previous crew backup first.");
      return;
    }
    const importError = onImport(importText);
    if (importError) setError(importError);
  }

  return <div className="onboarding-screen"><header className="onboarding-topbar"><span>Black Betty Shores</span></header><main className="onboarding-page"><div className="onboarding-card">
    <div className="onboarding-art"><div className="sun-glow" /><Waves size={47} /></div>
    {mode === "choices" ? <>
      <div className="eyebrow">WELCOME ABOARD</div>
      <h2>Set up Black Betty Shores.</h2>
      <p>Bring your crew back in seconds, or open the crew list and start setting things up. Your data stays on this device.</p>
      <div className="onboarding-options">
        <button className="onboarding-option featured" onClick={() => setMode("import")}>
          <span className="onboarding-option-icon"><ClipboardPaste size={19} /></span>
          <span><strong>Import previous crew</strong><small>Paste a backup from your notes or crew chat.</small></span>
          <ArrowRight size={16} />
        </button>
        <button className="onboarding-option" onClick={onStart}>
          <span className="onboarding-option-icon"><UserRoundPlus size={19} /></span>
          <span><strong>Start adding people</strong><small>Open an empty crew list and add your people.</small></span>
          <ArrowRight size={16} />
        </button>
      </div>
      <small className="onboarding-foot"><Check size={13} /> Your crew list starts empty — add people or import a previous crew.</small>
    </> : <>
      <button className="onboarding-back" onClick={() => { setMode("choices"); setError(null); }}><ArrowLeft size={15} />Back to setup choices</button>
      <div className="eyebrow">BRING THEM ABOARD</div>
      <h2>Import your previous crew.</h2>
      <p>Paste a Black Betty Shores backup to restore your people, rules, chores, and saved week.</p>
      <textarea className="backup-textarea onboarding-textarea" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Paste your backup here…" spellCheck={false} autoFocus />
      {error && <div className="error-strip"><Info size={16} />{error}</div>}
      <Button className="button primary full-button" onClick={submitImport}><ClipboardPaste size={16} />Validate & import crew</Button>
      <small className="onboarding-foot">Your starter setup will be replaced only after the backup is validated.</small>
    </>}
  </div></main></div>;
}

export default App;

createRoot(document.getElementById("root")!).render(<App />);
