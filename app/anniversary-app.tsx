"use client";

import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { CalendarDays, ChevronRight, Copy, Edit3, Home, LogOut, PartyPopper, Plus, RefreshCw, Settings2, Trash2, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { countdown, formatDate, isSpecialToday, localIsoDate, upcomingOccurrences } from "@/lib/date-engine";

export type AppAnniversary = { id: string; name: string; anniversary_date: string };
type Mode = "config" | "signed-out" | "onboarding" | "ready";
type Household = { id: string; invite_code: string } | null;
type Photo = { id: number; portrait?: string; landscape?: string; photographer: string; photographerUrl: string; pageUrl: string; alt: string };

function GlassButton({ children, onClick, label, className = "", disabled = false }: { children: React.ReactNode; onClick?: () => void; label: string; className?: string; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`icon-button ${className}`}>{children}</button>;
}

export default function AnniversaryApp({ mode, anniversaries: initial, household: initialHousehold, authError }: { mode: Mode; anniversaries: AppAnniversary[]; household: Household; authError?: string }) {
  const [anniversaries, setAnniversaries] = useState(initial);
  const [household, setHousehold] = useState(initialHousehold);
  const [tab, setTab] = useState<"home" | "days">("home");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<AppAnniversary | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [toast, setToast] = useState(authError ?? "");
  const today = localIsoDate();
  const todaysEvents = useMemo(() => anniversaries.flatMap((anniversary) => {
    const matches = isSpecialToday(anniversary, today);
    return [matches.yearly && { ...anniversary, kind: "yearly" as const }, matches.milestone && { ...anniversary, kind: "milestone" as const }].filter(Boolean) as Array<AppAnniversary & { kind: "yearly" | "milestone" }>;
  }), [anniversaries, today]);
  const upcoming = useMemo(() => upcomingOccurrences(anniversaries, today), [anniversaries, today]);
  const headline = upcoming[headlineIndex % Math.max(upcoming.length, 1)];
  const supabase = useMemo(() => (mode === "config" ? null : createClient()), [mode]);

  useEffect(() => { if (mode === "ready") void loadPhoto(1); }, [mode]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); }, [toast]);

  async function loadPhoto(page: number) {
    setLoadingPhoto(true);
    try {
      const response = await fetch(`/api/backgrounds?page=${page}`);
      const data = await response.json() as { photos?: Photo[] };
      if (data.photos?.length) { setPhotos(data.photos); setPhotoIndex(0); setPhoto(data.photos[0]); }
    } catch { /* gradient fallback remains */ } finally { setLoadingPhoto(false); }
  }

  function refresh() {
    if (upcoming.length) setHeadlineIndex((index) => (index + 1) % upcoming.length);
    if (photos.length && photoIndex < photos.length - 1) { const next = photoIndex + 1; setPhotoIndex(next); setPhoto(photos[next]); }
    else void loadPhoto(Math.floor(Math.random() * 20) + 1);
  }

  function signIn() {
    window.location.assign("/auth/login");
  }

  async function signOut() { if (supabase) { await supabase.auth.signOut(); window.location.reload(); } }

  async function createHousehold() {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("create_household");
    if (error) setToast(error.message); else { setHousehold(data); window.location.reload(); }
  }

  async function joinHousehold(code: string) {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("join_household", { input_code: code });
    if (error) setToast(error.message); else { setHousehold(data); window.location.reload(); }
  }

  async function saveAnniversary(name: string, date: string) {
    if (!supabase || !household) return;
    const cleanName = name.trim();
    if (!cleanName || !date || date > today || cleanName.length > 80) { setToast("Enter a name and a past or today’s date."); return; }
    const result = editing
      ? await supabase.from("anniversaries").update({ name: cleanName, anniversary_date: date, updated_at: new Date().toISOString() }).eq("id", editing.id).select("id, name, anniversary_date").single()
      : await supabase.from("anniversaries").insert({ household_id: household.id, name: cleanName, anniversary_date: date }).select("id, name, anniversary_date").single();
    if (result.error) setToast(result.error.message.includes("duplicate") ? "That anniversary already exists." : result.error.message);
    else { setAnniversaries((items) => editing ? items.map((item) => item.id === editing.id ? result.data : item) : [...items, result.data]); setModal(null); setEditing(null); setToast(editing ? "Anniversary updated." : "Anniversary added."); }
  }

  async function removeAnniversary(item: AppAnniversary) {
    if (!supabase || !window.confirm(`Delete “${item.name}”?`)) return;
    const { error } = await supabase.from("anniversaries").delete().eq("id", item.id);
    if (error) setToast(error.message); else { setAnniversaries((items) => items.filter((entry) => entry.id !== item.id)); setToast("Anniversary removed."); }
  }

  const background = photo?.portrait || photo?.landscape;
  if (mode === "config") return <Shell><EmptyState icon={<Settings2 />} title="Almost ready" body="Add your Supabase URL and publishable key to .env.local, then restart the app." /> </Shell>;
  if (mode === "signed-out") return <Shell><div className="auth-card"><div className="brand-mark"><CalendarDays /></div><p className="eyebrow">A little time capsule</p><h1>Keep the days worth celebrating close.</h1><p className="muted">Share anniversaries with your household, and let every 100-day milestone become a reason to pause.</p><button className="primary-button wide" onClick={signIn}>Continue with Google <ChevronRight size={18} /></button><p className="fine-print">Your dates are private to your household.</p></div></Shell>;
  if (mode === "onboarding") return <Shell><Onboarding onCreate={createHousehold} onJoin={joinHousehold} signOut={signOut} /></Shell>;

  const special = todaysEvents.length > 0;
  return <main className="app-shell">
    <div className="backdrop" style={background ? { backgroundImage: `url(${background})` } : undefined} />
    <div className="backdrop-wash" />
    <header className="topbar"><div><p className="eyebrow">{special ? "Today is worth remembering" : "Your next reason to celebrate"}</p><p className="brand-name">Anniversary</p></div><GlassButton label="Refresh photo and headline" onClick={refresh} className={loadingPhoto ? "spin" : ""}><RefreshCw size={19} /></GlassButton></header>
    <section className="content-wrap">
      {tab === "home" ? <>
        <section className={`hero-card ${special ? "is-special" : ""}`}>
          <div className="hero-kicker">{special ? "A special day" : "Coming up"}</div>
          {special ? <><h1>{todaysEvents.map((event) => event.name).join(" & ")}</h1><div className="event-pills">{todaysEvents.map((event) => <span key={`${event.id}-${event.kind}`} className="pill">{event.kind === "yearly" ? "Yearly anniversary" : "100-day milestone"}</span>)}</div><button className="celebrate-button" onClick={() => { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; void confetti({ particleCount: 130, spread: 95, origin: { y: 0.58 }, colors: ["#f7d58a", "#ff9f83", "#d6e5b3", "#fff8e7"] }); }}><PartyPopper size={20} /> Make it sparkle</button></> : upcoming.length ? <><p className="countdown">{countdown(headline.daysAway)}</p><h1>{headline.name}</h1><p className="hero-date">{formatDate(headline.date)}</p><p className="hero-detail">{headline.kind === "milestone" ? `${headline.milestone} days together` : "Yearly anniversary"}</p></> : <EmptyState icon={<CalendarDays />} title="No dates yet" body="Add your first anniversary below and we’ll count every meaningful day." />}
        </section>
        {!special && upcoming.length > 0 && <section className="upcoming-section"><div className="section-heading"><h2>Coming up</h2><span>{upcoming.length} moments</span></div><div className="upcoming-list">{upcoming.slice(0, 5).map((event) => <article className="upcoming-row" key={event.id}><div><strong>{event.name}</strong><span>{formatDate(event.date)} · {event.kind === "milestone" ? `${event.milestone} days` : "Yearly"}</span></div><b>{countdown(event.daysAway)}</b></article>)}</div></section>}
      </> : <DaysView anniversaries={anniversaries} onAdd={() => { setEditing(null); setModal("add"); }} onEdit={(item) => { setEditing(item); setModal("edit"); }} onDelete={removeAnniversary} household={household} onCopy={() => { navigator.clipboard?.writeText(household?.invite_code ?? ""); setToast("Invite code copied."); }} onSignOut={signOut} />}
    </section>
    <nav className="bottom-nav"><button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}><Home size={20} /><span>Home</span></button><button className="add-fab" onClick={() => { setEditing(null); setModal("add"); }} aria-label="Add anniversary"><Plus size={26} /></button><button className={tab === "days" ? "active" : ""} onClick={() => setTab("days")}><CalendarDays size={20} /><span>Days</span></button></nav>
    {modal && <AnniversaryModal mode={modal} initial={editing} onClose={() => { setModal(null); setEditing(null); }} onSave={saveAnniversary} />}
    {toast && <div className="toast" role="status">{toast}</div>}
    {photo && <a className="attribution" href={photo.pageUrl} target="_blank" rel="noreferrer">Photo by {photo.photographer} on Pexels</a>}
  </main>;
}

function Shell({ children }: { children: React.ReactNode }) { return <main className="shell"><div className="shell-glow" /><div className="shell-inner">{children}</div></main>; }
function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) { return <div className="empty-state"><div className="empty-icon">{icon}</div><h2>{title}</h2><p>{body}</p></div>; }

function Onboarding({ onCreate, onJoin, signOut }: { onCreate: () => void; onJoin: (code: string) => void; signOut: () => void }) {
  const [code, setCode] = useState("");
  return <div className="onboarding"><div className="brand-mark"><Users /></div><p className="eyebrow">Welcome to your household</p><h1>Who are you celebrating with?</h1><p className="muted">Start a shared space or join someone who has already made one.</p><button className="primary-button wide" onClick={onCreate}>Create a household <ChevronRight size={18} /></button><div className="or"><span>or join with a code</span></div><div className="join-row"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} placeholder="10-character code" aria-label="Household invite code" /><button className="secondary-button" disabled={code.length < 6} onClick={() => onJoin(code)}>Join</button></div><button className="text-button" onClick={signOut}><LogOut size={15} /> Sign out</button></div>;
}

function DaysView({ anniversaries, onAdd, onEdit, onDelete, household, onCopy, onSignOut }: { anniversaries: AppAnniversary[]; onAdd: () => void; onEdit: (item: AppAnniversary) => void; onDelete: (item: AppAnniversary) => void; household: Household; onCopy: () => void; onSignOut: () => void }) {
  return <section className="days-view"><div className="section-heading"><div><p className="eyebrow">Your shared calendar</p><h1>All the days</h1></div><GlassButton label="Sign out" onClick={onSignOut}><LogOut size={18} /></GlassButton></div><div className="invite-card"><div><span className="muted small">Household invite code</span><strong>{household?.invite_code}</strong></div><GlassButton label="Copy invite code" onClick={onCopy}><Copy size={17} /></GlassButton></div>{anniversaries.length ? <div className="days-list">{anniversaries.map((item) => <article className="day-row" key={item.id}><div className="day-icon"><CalendarDays size={19} /></div><div className="day-copy"><strong>{item.name}</strong><span>{formatDate(item.anniversary_date)} · {new Date(`${item.anniversary_date}T00:00:00`).getFullYear()}</span></div><button aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><Edit3 size={17} /></button><button aria-label={`Delete ${item.name}`} onClick={() => onDelete(item)}><Trash2 size={17} /></button></article>)}</div> : <EmptyState icon={<CalendarDays />} title="Your list is empty" body="Add a date and your shared calendar will come alive." />}<button className="secondary-button wide" onClick={onAdd}><Plus size={18} /> Add an anniversary</button></section>;
}

function AnniversaryModal({ mode, initial, onClose, onSave }: { mode: "add" | "edit"; initial: AppAnniversary | null; onClose: () => void; onSave: (name: string, date: string) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.anniversary_date ?? "");
  const max = localIsoDate();
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card" onSubmit={(event) => { event.preventDefault(); onSave(name, date); }}><div className="modal-heading"><div><p className="eyebrow">{mode === "add" ? "A new memory" : "Update a memory"}</p><h2>{mode === "add" ? "Add an anniversary" : "Edit anniversary"}</h2></div><GlassButton label="Close" onClick={onClose}><X size={19} /></GlassButton></div><label>Name<input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Our first date" /></label><label>Date<input required type="date" max={max} value={date} onChange={(event) => setDate(event.target.value)} /></label><button className="primary-button wide" type="submit">{mode === "add" ? "Save anniversary" : "Save changes"}</button></form></div>;
}
