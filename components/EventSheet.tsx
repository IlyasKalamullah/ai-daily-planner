"use client";

import { useEffect, useMemo, useState } from "react";
import { api, RSVP_LABEL, STATUS_LABEL } from "@/lib/client";
import type { EventChanges, PlannerEvent, RsvpResponse } from "@/lib/types";
import {
  ClockIcon,
  CloseIcon,
  EditIcon,
  ExternalIcon,
  LayersIcon,
  PinIcon,
  TrashIcon,
  UsersIcon,
} from "./Icons";

type Mode = "view" | "edit" | "delete";

function localParts(iso: string, timeZone: string) {
  const d = new Date(iso);
  return {
    date: new Intl.DateTimeFormat("en-CA", { timeZone }).format(d),
    time: new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d),
  };
}
function addDays(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

export function whenText(e: PlannerEvent, timeZone: string) {
  const d = new Intl.DateTimeFormat("id-ID", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const t = new Intl.DateTimeFormat("id-ID", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  if (e.allDay) {
    const s = d.format(new Date(`${e.start}T12:00:00Z`));
    const endIncl = addDays(e.end, -1);
    return endIncl !== e.start ? `${s} – ${d.format(new Date(`${endIncl}T12:00:00Z`))}` : `${s} · seharian`;
  }
  return `${d.format(new Date(e.start))} · ${t.format(new Date(e.start))}–${t.format(new Date(e.end))}`;
}

export default function EventSheet({
  event,
  timeZone,
  onClose,
  onChanged,
}: {
  event: PlannerEvent;
  timeZone: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // nilai awal form
  const initial = useMemo(() => {
    const s = event.allDay ? { date: event.start, time: "09:00" } : localParts(event.start, timeZone);
    const e = event.allDay ? { date: event.start, time: "10:00" } : localParts(event.end, timeZone);
    return {
      title: event.title,
      date: s.date,
      allDay: event.allDay,
      startTime: s.time,
      endTime: e.time,
      location: event.location || "",
      description: event.description || "",
      attendees: event.attendees.filter((a) => !a.self || !event.isOrganizer).map((a) => a.email),
    };
  }, [event, timeZone]);
  const [form, setForm] = useState(initial);
  const [newGuest, setNewGuest] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function addGuest() {
    const emails = newGuest
      .split(/[\s,;]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    const bad = emails.filter((x) => !EMAIL.test(x));
    if (bad.length) {
      setError(`Email tidak valid: ${bad.join(", ")}`);
      return;
    }
    setError(null);
    setForm((f) => ({ ...f, attendees: [...new Set([...f.attendees, ...emails])] }));
    setNewGuest("");
  }

  function save() {
    const c: EventChanges = {};
    if (form.title.trim() && form.title.trim() !== initial.title) c.title = form.title.trim();
    if (form.date !== initial.date) c.date = form.date;
    if (form.allDay !== initial.allDay) c.allDay = form.allDay;
    if (!form.allDay) {
      if (form.startTime !== initial.startTime || form.allDay !== initial.allDay || form.date !== initial.date)
        c.startTime = form.startTime;
      if (form.endTime !== initial.endTime || form.allDay !== initial.allDay || form.date !== initial.date)
        c.endTime = form.endTime;
    }
    if (form.location !== initial.location) c.location = form.location;
    if (form.description !== initial.description) c.description = form.description;
    const before = new Set(initial.attendees);
    const after = new Set(form.attendees);
    const add = [...after].filter((x) => !before.has(x));
    const remove = [...before].filter((x) => !after.has(x));
    if (add.length) c.addAttendees = add;
    if (remove.length) c.removeAttendees = remove;
    if (!form.allDay && form.endTime <= form.startTime && form.endTime !== "00:00") {
      setError("Jam selesai harus setelah jam mulai.");
      return;
    }
    if (Object.keys(c).length === 0) {
      setMode("view");
      return;
    }
    run(() => api.update(event.calendarId, event.id, c, timeZone));
  }

  const isInvite = !event.isOrganizer && event.myResponse !== undefined;

  return (
    <>
      <div className="backdrop show sheet-backdrop" onClick={onClose} />
      <div className="sheet card" role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="sheet-head">
          <span className="sheet-color" style={{ background: event.calendarColor || "var(--accent)" }} />
          <h3>{mode === "edit" ? "Edit jadwal" : mode === "delete" ? "Hapus jadwal?" : event.title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Tutup">
            <CloseIcon />
          </button>
        </div>

        <div className="sheet-body">
          {mode === "view" && (
            <>
              <div className="info-row">
                <ClockIcon size={16} /> <span>{whenText(event, timeZone)}</span>
              </div>
              {event.location && (
                <div className="info-row">
                  <PinIcon size={16} /> <span>{event.location}</span>
                </div>
              )}
              <div className="info-row">
                <LayersIcon size={16} />
                <span>
                  {event.calendar}
                  {!event.isOrganizer && event.organizer ? ` · diundang oleh ${event.organizer}` : ""}
                </span>
              </div>
              {event.attendees.length > 0 && (
                <div className="info-row top">
                  <UsersIcon size={16} />
                  <ul className="guests">
                    {event.attendees.map((a) => (
                      <li key={a.email}>
                        <span className="g-email">
                          {a.name || a.email}
                          {a.self ? " (kamu)" : ""}
                          {a.organizer ? " · penyelenggara" : ""}
                        </span>
                        <span className={`g-status ${a.status}`}>{STATUS_LABEL[a.status]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {event.description && <p className="desc">{event.description}</p>}

              {isInvite && (
                <div className="rsvp">
                  <span>Kamu akan hadir?</span>
                  <div className="rsvp-btns">
                    {(["accepted", "tentative", "declined"] as RsvpResponse[]).map((r) => (
                      <button
                        key={r}
                        className={`btn ${event.myResponse === r ? "btn-primary" : ""}`}
                        disabled={busy}
                        onClick={() => run(() => api.rsvp(event.id, r))}
                      >
                        {RSVP_LABEL[r]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {mode === "edit" && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <label>
                Judul
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
              </label>
              <div className="form-row">
                <label>
                  Tanggal
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </label>
                <label className="check">
                  <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} />
                  Seharian
                </label>
              </div>
              {!form.allDay && (
                <div className="form-row">
                  <label>
                    Mulai
                    <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
                  </label>
                  <label>
                    Selesai
                    <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
                  </label>
                </div>
              )}
              <label>
                Lokasi
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={200} />
              </label>
              <label>
                Catatan
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
              </label>
              <div className="label">Tamu</div>
              {form.attendees.length > 0 && (
                <div className="guest-chips">
                  {form.attendees.map((email) => (
                    <span key={email} className="guest-chip">
                      {email}
                      <button
                        type="button"
                        aria-label={`Hapus ${email}`}
                        onClick={() => setForm({ ...form, attendees: form.attendees.filter((x) => x !== email) })}
                      >
                        <CloseIcon size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="guest-add">
                <input
                  type="email"
                  placeholder="email@contoh.com"
                  value={newGuest}
                  onChange={(e) => setNewGuest(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGuest();
                    }
                  }}
                />
                <button type="button" className="btn" onClick={addGuest} disabled={!newGuest.trim()}>
                  Undang
                </button>
              </div>
              <p className="hint">Tamu baru akan menerima email undangan dari Google Calendar.</p>
            </form>
          )}

          {mode === "delete" && (
            <div className="confirm-delete">
              <p>
                <b>{event.title}</b>
                <br />
                {whenText(event, timeZone)}
              </p>
              <p className="hint">
                {event.isOrganizer
                  ? event.attendees.length > 1
                    ? "Jadwal akan dihapus dan semua tamu akan diberi tahu lewat email."
                    : "Jadwal akan dihapus dari Google Calendar."
                  : "Kamu hanya tamu. Jadwal ini hanya akan hilang dari kalendermu."}
              </p>
            </div>
          )}

          {error && <div className="alert">{error}</div>}
        </div>

        <div className="sheet-foot">
          {mode === "view" && (
            <>
              <button className="btn btn-danger-ghost" onClick={() => setMode("delete")}>
                <TrashIcon size={16} /> Hapus
              </button>
              {event.link && (
                <a className="btn btn-ghost" href={event.link} target="_blank" rel="noreferrer">
                  <ExternalIcon size={16} /> Google
                </a>
              )}
              <span className="spacer" />
              {event.canEdit && (
                <button className="btn btn-primary" onClick={() => setMode("edit")}>
                  <EditIcon size={16} /> Edit
                </button>
              )}
            </>
          )}
          {mode === "edit" && (
            <>
              <span className="spacer" />
              <button className="btn" onClick={() => { setForm(initial); setMode("view"); setError(null); }} disabled={busy}>
                Batal
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </>
          )}
          {mode === "delete" && (
            <>
              <span className="spacer" />
              <button className="btn" onClick={() => setMode("view")} disabled={busy}>
                Batal
              </button>
              <button className="btn btn-danger" onClick={() => run(() => api.remove(event.calendarId, event.id))} disabled={busy}>
                {busy ? "Menghapus…" : "Ya, hapus"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
