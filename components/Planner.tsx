"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Chat from "./Chat";

type PlannerEvent = {
  id: string;
  calendar: string;
  calendarColor?: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  link?: string;
};

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
/** Senin dari pekan yang memuat dateStr */
function mondayOf(dateStr: string) {
  const w = weekday(dateStr);
  return addDays(dateStr, w === 0 ? -6 : 1 - w);
}

/** Apakah event berlangsung pada tanggal `day` */
function occursOn(ev: PlannerEvent, day: string, timeZone: string) {
  if (ev.allDay) return ev.start <= day && day < ev.end;
  const s = ymd(new Date(ev.start), timeZone);
  const e = ymd(new Date(new Date(ev.end).getTime() - 1), timeZone);
  return s <= day && day <= e;
}

export default function Planner() {
  const timeZone = useMemo(tz, []);
  const today = useMemo(() => ymd(new Date(), timeZone), [timeZone]);
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, [load]);

  const dayEvents = events.filter((e) => occursOn(e, selected, timeZone));

  const fmtTime = new Intl.DateTimeFormat("id-ID", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  const longDate = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${selected}T12:00:00Z`));

  return (
    <div className="layout">
      <section className="panel">
        <div className="planner-head">
          <div>
            <h2>{selected === today ? "Hari ini" : longDate.split(",")[0]}</h2>
            <div className="sub">{longDate}</div>
          </div>
          <div className="nav">
            <button className="btn" onClick={() => setSelected(addDays(selected, -7))} aria-label="Pekan sebelumnya">
              ‹
            </button>
            <button className="btn" onClick={() => setSelected(today)}>
              Hari ini
            </button>
            <button className="btn" onClick={() => setSelected(addDays(selected, 7))} aria-label="Pekan berikutnya">
              ›
            </button>
          </div>
        </div>

        <div className="week">
          {days.map((d) => {
            const has = events.some((e) => occursOn(e, d, timeZone));
            return (
              <button
                key={d}
                className={`day ${d === selected ? "active" : ""} ${d === today ? "today" : ""} ${has ? "has" : ""}`}
                onClick={() => setSelected(d)}
              >
                <span className="dname">{HARI_PENDEK[weekday(d)]}</span>
                <span className="dnum">{Number(d.slice(8))}</span>
                <span className="dot" />
              </button>
            );
          })}
        </div>

        <div className="events">
          {loading ? (
            <>
              <div className="skeleton" />
              <div className="skeleton" />
            </>
          ) : error ? (
            <div className="empty">
              {error} <br />
              <button className="btn" style={{ marginTop: 10 }} onClick={load}>
                Coba lagi
              </button>
            </div>
          ) : dayEvents.length === 0 ? (
            <div className="empty">Tidak ada jadwal. Hari yang lapang 🌿</div>
          ) : (
            dayEvents.map((e) => (
              <a
                key={`${e.calendar}-${e.id}`}
                className="event"
                href={e.link}
                target="_blank"
                rel="noreferrer"
                style={{ borderLeftColor: e.calendarColor || "var(--accent)" }}
              >
                <div className="time">
                  {e.allDay ? (
                    "Seharian"
                  ) : (
                    <>
                      {fmtTime.format(new Date(e.start))}
                      <small>{fmtTime.format(new Date(e.end))}</small>
                    </>
                  )}
                </div>
                <div>
                  <div className="title">{e.title}</div>
                  <div className="meta">
                    {e.location ? `${e.location} · ` : ""}
                    {e.calendar}
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      </section>

      <Chat timeZone={timeZone} onEventCreated={load} />
    </div>
  );
}
