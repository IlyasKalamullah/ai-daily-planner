"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Chat from "./Chat";
import EventSheet, { whenText } from "./EventSheet";
import { CalendarIcon, ChatIcon, ChevronLeft, ChevronRight, LayersIcon, MailIcon, PinIcon, UsersIcon } from "./Icons";
import { api, RSVP_LABEL } from "@/lib/client";
import type { PlannerEvent, RsvpResponse } from "@/lib/types";

const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function tz() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
}
function ymd(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
}
function addDays(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekday(dateStr: string) {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}
function mondayOf(dateStr: string) {
  const w = weekday(dateStr);
  return addDays(dateStr, w === 0 ? -6 : 1 - w);
}
function occursOn(ev: PlannerEvent, day: string, timeZone: string) {
  if (ev.allDay) return ev.start <= day && day < ev.end;
  const s = ymd(new Date(ev.start), timeZone);
  const e = ymd(new Date(new Date(ev.end).getTime() - 1), timeZone);
  return s <= day && day <= e;
}
function greeting(hour: number) {
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}
function fmtDuration(ms: number) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} j ${r} mnt` : `${h} jam`;
}

export default function Planner({ firstName }: { firstName: string }) {
  const timeZone = useMemo(tz, []);
  const [now, setNow] = useState(() => new Date());
  const today = ymd(now, timeZone);
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [invites, setInvites] = useState<PlannerEvent[]>([]);
  const [answering, setAnswering] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [openEvent, setOpenEvent] = useState<PlannerEvent | null>(null);

  // perbarui "sekarang" tiap menit untuk status "sedang berlangsung"
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const weekStart = mondayOf(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/events?start=${weekStart}&end=${addDays(weekStart, 6)}&tz=${encodeURIComponent(timeZone)}`
      );
      if (res.status === 401) {
        window.location.href = "/";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat jadwal");
      setEvents(data.events);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [weekStart, timeZone]);

  const loadInvites = useCallback(async () => {
    try {
      const res = await fetch(`/api/invites?tz=${encodeURIComponent(timeZone)}`);
      if (res.ok) setInvites((await res.json()).invites);
    } catch {}
  }, [timeZone]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const refreshAll = useCallback(() => {
    load();
    loadInvites();
  }, [load, loadInvites]);

  async function answer(ev: PlannerEvent, r: RsvpResponse) {
    setAnswering(ev.id + r);
    setInviteError(null);
    try {
      await api.rsvp(ev.id, r);
      setInvites((list) => list.filter((x) => x.id !== ev.id));
      load();
    } catch (e: any) {
      setInviteError(e.message);
    } finally {
      setAnswering(null);
    }
  }

  const closeChat = useCallback(() => setChatOpen(false), []);
  const dayEvents = events.filter((e) => occursOn(e, selected, timeZone));
  const weekCount = events.length;
  const timed = dayEvents.filter((e) => !e.allDay);
  const busyMs = timed.reduce((sum, e) => sum + (new Date(e.end).getTime() - new Date(e.start).getTime()), 0);
  const upcoming = events.find((e) => !e.allDay && new Date(e.start) > now);

  const fmtTime = new Intl.DateTimeFormat("id-ID", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  const fmtDayShort = new Intl.DateTimeFormat("id-ID", { timeZone, weekday: "short", day: "numeric", month: "short" });
  const longDate = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${selected}T12:00:00Z`));
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${selected}T12:00:00Z`)
  );
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(now));

  return (
    <>
      <div className="layout">
        <div className="main-col">
          {/* ---------- Hero ---------- */}
          <section className="card hero">
            <div className="hero-top">
              <div>
                <div className="greet">
                  {greeting(hour)}
                  {firstName ? `, ${firstName}` : ""} 👋
                </div>
                <h1>{selected === today ? "Hari ini" : longDate.split(",")[0]}</h1>
                <div className="date-sub">{longDate}</div>
              </div>
              <div className="nav">
                <button className="btn btn-icon" onClick={() => setSelected(addDays(selected, -7))} aria-label="Pekan sebelumnya">
                  <ChevronLeft />
                </button>
                <button className="btn today-btn" onClick={() => setSelected(today)}>
                  {monthLabel}
                </button>
                <button className="btn btn-icon" onClick={() => setSelected(addDays(selected, 7))} aria-label="Pekan berikutnya">
                  <ChevronRight />
                </button>
              </div>
            </div>

            <div className="week" role="tablist" aria-label="Pilih hari">
              {days.map((d) => {
                const count = events.filter((e) => occursOn(e, d, timeZone)).length;
                return (
                  <button
                    key={d}
                    role="tab"
                    aria-selected={d === selected}
                    className={`day ${d === selected ? "active" : ""} ${d === today ? "today" : ""}`}
                    onClick={() => setSelected(d)}
                  >
                    <span className="dname">{HARI_PENDEK[weekday(d)]}</span>
                    <span className="dnum">{Number(d.slice(8))}</span>
                    <span className="dots">
                      {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                        <i key={i} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="stats">
              <div className="stat accent">
                <span className="label">Jadwal</span>
                <span className="value">{loading ? "–" : dayEvents.length}</span>
                <span className="hint">{selected === today ? "hari ini" : "hari dipilih"}</span>
              </div>
              <div className="stat">
                <span className="label">Terisi</span>
                <span className="value">{loading ? "–" : busyMs ? fmtDuration(busyMs) : "0"}</span>
                <span className="hint">{weekCount} jadwal pekan ini</span>
              </div>
              <div className="stat next">
                <span className="label">Berikutnya</span>
                <span className="value small">{loading ? "–" : upcoming ? upcoming.title : "Tidak ada"}</span>
                <span className="hint">
                  {upcoming ? `${fmtDayShort.format(new Date(upcoming.start))} · ${fmtTime.format(new Date(upcoming.start))}` : "di pekan ini"}
                </span>
              </div>
            </div>
          </section>

          {/* ---------- Undangan ---------- */}
          {invites.length > 0 && (
            <section className="card invites">
              <div className="agenda-head">
                <h2>
                  <MailIcon size={17} /> Undangan
                </h2>
                <span className="count-pill">{invites.length}</span>
              </div>
              <div className="invite-list">
                {invites.map((ev) => (
                  <div key={ev.id} className="invite">
                    <button className="invite-main" onClick={() => setOpenEvent(ev)}>
                      <div className="invite-from">{ev.organizer || "Seseorang"} mengundangmu</div>
                      <div className="tl-title">{ev.title}</div>
                      <div className="tl-meta">
                        <span>{whenText(ev, timeZone)}</span>
                        {ev.attendees.length > 0 && (
                          <span>
                            <UsersIcon size={13} /> {ev.attendees.length} tamu
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="invite-actions">
                      {(["accepted", "tentative", "declined"] as RsvpResponse[]).map((r) => (
                        <button
                          key={r}
                          className={`btn ${r === "accepted" ? "btn-primary" : ""}`}
                          disabled={!!answering}
                          onClick={() => answer(ev, r)}
                        >
                          {answering === ev.id + r ? "…" : RSVP_LABEL[r]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {inviteError && <div className="alert" style={{ marginTop: 12 }}>{inviteError}</div>}
            </section>
          )}

          {/* ---------- Agenda ---------- */}
          <section className="card agenda">
            <div className="agenda-head">
              <h2>Agenda</h2>
              <span>{dayEvents.length ? `${dayEvents.length} kegiatan` : ""}</span>
            </div>

            {loading ? (
              <div className="timeline">
                <div className="skeleton" />
                <div className="skeleton" />
                <div className="skeleton" />
              </div>
            ) : error ? (
              <div className="empty">
                <span className="empty-ic"><CalendarIcon size={22} /></span>
                <b>{error}</b>
                <button className="btn" style={{ marginTop: 12 }} onClick={load}>
                  Coba lagi
                </button>
              </div>
            ) : dayEvents.length === 0 ? (
              <div className="empty">
                <span className="empty-ic"><CalendarIcon size={22} /></span>
                <b>Hari yang lapang</b>
                Belum ada jadwal. Tambahkan lewat chat kalau perlu.
              </div>
            ) : (
              <ol className="timeline">
                {dayEvents.map((e) => {
                  const s = new Date(e.start);
                  const en = new Date(e.end);
                  const live = !e.allDay && s <= now && now < en;
                  const past = !e.allDay && en <= now;
                  return (
                    <li key={`${e.calendar}-${e.id}`} className={`tl-item ${past ? "past" : ""}`}>
                      <div className="tl-time">
                        {e.allDay ? (
                          <b>Seharian</b>
                        ) : (
                          <>
                            <b>{fmtTime.format(s)}</b>
                            <small>{fmtTime.format(en)}</small>
                          </>
                        )}
                      </div>
                      <button
                        className="tl-card"
                        onClick={() => setOpenEvent(e)}
                        style={{ ["--c" as string]: e.calendarColor || "var(--accent)" }}
                      >
                        {live && <span className="badge live">Berlangsung</span>}
                        {past && <span className="badge done">Selesai</span>}
                        {!e.isOrganizer && e.myResponse === "needsAction" && (
                          <span className="badge pending">Belum dijawab</span>
                        )}
                        <div className="tl-title">{e.title}</div>
                        <div className="tl-meta">
                          {e.location && (
                            <span>
                              <PinIcon size={13} /> {e.location}
                            </span>
                          )}
                          {e.attendees.length > 0 && (
                            <span>
                              <UsersIcon size={13} /> {e.attendees.length} tamu
                            </span>
                          )}
                          <span>
                            <LayersIcon size={13} /> {e.calendar}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <Chat timeZone={timeZone} onChanged={refreshAll} open={chatOpen} onClose={closeChat} />
      </div>

      <div className={`backdrop ${chatOpen ? "show" : ""}`} onClick={() => setChatOpen(false)} />
      {openEvent && (
        <EventSheet
          key={openEvent.id}
          event={openEvent}
          timeZone={timeZone}
          onClose={() => setOpenEvent(null)}
          onChanged={refreshAll}
        />
      )}
      {!chatOpen && !openEvent && (
        <button className="fab" onClick={() => setChatOpen(true)}>
          <ChatIcon size={20} /> Tanya jadwal
        </button>
      )}
    </>
  );
}
