import { addDays, toRfc3339 } from "./time";
import type { Attendee, EventChanges, NewEvent, PlannerEvent } from "./types";

export type { Attendee, EventChanges, NewEvent, PlannerEvent };

const API = "https://www.googleapis.com/calendar/v3";

export class GoogleAuthError extends Error {}
export class GoogleApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function gfetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (res.status === 401) throw new GoogleAuthError("Sesi Google kedaluwarsa");
  if (res.status === 204 || res.status === 410) return null; // hapus berhasil / sudah terhapus
  if (!res.ok) {
    const text = await res.text();
    throw new GoogleApiError(res.status, `Google Calendar API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

type CalendarListItem = {
  id: string;
  summary: string;
  summaryOverride?: string;
  backgroundColor?: string;
  selected?: boolean;
  primary?: boolean;
  accessRole: string;
};

/** Ambil semua kalender yang ditampilkan (termasuk kalender yang dibagikan orang lain). */
async function listCalendars(token: string): Promise<CalendarListItem[]> {
  try {
    const data = await gfetch(token, "/users/me/calendarList?maxResults=50");
    const items: CalendarListItem[] = data.items || [];
    return items.filter((c) => c.selected || c.primary);
  } catch (e) {
    if (e instanceof GoogleAuthError) throw e;
    return [{ id: "primary", summary: "Kalender utama", accessRole: "owner", primary: true }];
  }
}

function mapEvent(ev: any, cal: CalendarListItem): PlannerEvent {
  const attendees: Attendee[] = (ev.attendees || [])
    .filter((a: any) => !a.resource)
    .map((a: any) => ({
      email: a.email,
      name: a.displayName,
      status: a.responseStatus || "needsAction",
      self: !!a.self,
      organizer: !!a.organizer,
    }));
  const me = attendees.find((a) => a.self);
  // Jika ada data organizer, user adalah pembuat hanya bila organizer.self === true.
  // Jika tidak ada data organizer sama sekali (jadwal pribadi), anggap user pembuatnya.
  const isOrganizer = ev.organizer ? ev.organizer.self === true : true;
  const writable = cal.accessRole === "owner" || cal.accessRole === "writer";
  return {
    id: ev.id,
    calendarId: cal.primary ? "primary" : cal.id,
    calendar: cal.summaryOverride || cal.summary,
    calendarColor: cal.backgroundColor,
    title: ev.summary || "(Tanpa judul)",
    start: ev.start?.dateTime || ev.start?.date,
    end: ev.end?.dateTime || ev.end?.date,
    allDay: !ev.start?.dateTime,
    location: ev.location,
    description: ev.description?.slice(0, 1000),
    link: ev.htmlLink,
    organizer: ev.organizer?.displayName || ev.organizer?.email,
    isOrganizer,
    attendees,
    myResponse: me?.status,
    canEdit: writable && (isOrganizer || !!ev.guestsCanModify),
  };
}

async function listFromCalendars(
  token: string,
  params: Record<string, string>,
  calendars?: CalendarListItem[],
  maxPages = 1
): Promise<PlannerEvent[]> {
  const cals = calendars || (await listCalendars(token));
  const results = await Promise.all(
    cals.map(async (cal) => {
      try {
        // ambil beberapa halaman agar rentang panjang (mis. setahun) tidak terpotong
        const items: any[] = [];
        let pageToken: string | undefined;
        for (let page = 0; page < maxPages; page++) {
          const q = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", ...params });
          if (pageToken) q.set("pageToken", pageToken);
          const data = await gfetch(token, `/calendars/${encodeURIComponent(cal.id)}/events?${q}`);
          items.push(...(data.items || []));
          pageToken = data.nextPageToken;
          if (!pageToken) break;
        }
        return items
          .filter((ev: any) => ev.status !== "cancelled")
          .map((ev: any) => mapEvent(ev, cal));
      } catch (e) {
        if (e instanceof GoogleAuthError) throw e;
        console.error(`Gagal membaca kalender ${cal.id}`, e);
        return [];
      }
    })
  );
  // event yang sama bisa muncul di 2 kalender; ambil yang bisa diedit dulu
  const seen = new Map<string, PlannerEvent>();
  for (const ev of results.flat()) {
    const prev = seen.get(ev.id);
    if (!prev || (!prev.canEdit && ev.canEdit)) seen.set(ev.id, ev);
  }
  return [...seen.values()].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/** Ambil jadwal dari startDate s/d endDate (inklusif), di zona waktu user. */
export async function getEvents(token: string, startDate: string, endDate: string, timeZone: string) {
  return listFromCalendars(
    token,
    {
      timeMin: toRfc3339(startDate, "00:00", timeZone),
      timeMax: toRfc3339(addDays(endDate, 1), "00:00", timeZone),
      timeZone,
      maxResults: "250",
    },
    undefined,
    4 // hingga 1000 jadwal per kalender
  );
}

/** Cari jadwal berdasarkan kata kunci (judul, deskripsi, lokasi, peserta). */
export async function searchEvents(
  token: string,
  query: string,
  startDate: string,
  endDate: string,
  timeZone: string
) {
  const events = await listFromCalendars(token, {
    q: query,
    timeMin: toRfc3339(startDate, "00:00", timeZone),
    timeMax: toRfc3339(addDays(endDate, 1), "00:00", timeZone),
    timeZone,
    maxResults: "25",
  });
  return events.slice(0, 40);
}

/** Undangan yang belum dijawab (dari hari ini s/d 90 hari ke depan). */
export async function getPendingInvites(token: string, today: string, timeZone: string) {
  const events = await listFromCalendars(
    token,
    {
      timeMin: toRfc3339(today, "00:00", timeZone),
      timeMax: toRfc3339(addDays(today, 90), "00:00", timeZone),
      timeZone,
      maxResults: "250",
    },
    [{ id: "primary", summary: "Kalender utama", accessRole: "owner", primary: true }]
  );
  return events.filter((e) => !e.isOrganizer && e.myResponse === "needsAction");
}

export async function getEvent(token: string, calendarId: string, eventId: string) {
  const cal: CalendarListItem = { id: calendarId, summary: calendarId, accessRole: "owner", primary: calendarId === "primary" };
  const raw = await gfetch(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  return { raw, event: mapEvent(raw, cal) };
}

/* ---------------- Tulis ---------------- */

function addHour(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeBlock(date: string, startTime: string | undefined, endTime: string | undefined, allDay: boolean, timeZone: string) {
  if (allDay || !startTime) {
    return {
      start: { date, dateTime: null, timeZone: null },
      end: { date: addDays(date, 1), dateTime: null, timeZone: null },
    };
  }
  const end = endTime || addHour(startTime);
  const endDate = end <= startTime ? addDays(date, 1) : date;
  return {
    start: { dateTime: toRfc3339(date, startTime, timeZone), timeZone, date: null },
    end: { dateTime: toRfc3339(endDate, end, timeZone), timeZone, date: null },
  };
}

/** Buat jadwal baru di kalender utama user (opsional: undang peserta). */
export async function createEvent(token: string, ev: NewEvent, timeZone: string) {
  const { start, end } = timeBlock(ev.date, ev.startTime, ev.endTime, !!ev.allDay, timeZone);
  const clean = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
  const body: any = {
    summary: ev.title,
    description: ev.description,
    location: ev.location,
    start: clean(start),
    end: clean(end),
  };
  if (ev.attendees?.length) body.attendees = ev.attendees.map((email) => ({ email }));
  const q = ev.attendees?.length ? "?sendUpdates=all" : "";
  return gfetch(token, `/calendars/primary/events${q}`, { method: "POST", body: JSON.stringify(body) });
}

/** Tanggal & jam lokal dari RFC3339 */
function localParts(iso: string, timeZone: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return { date, time };
}

/** Ubah jadwal. Field yang tidak diisi tetap seperti semula. */
export async function updateEvent(
  token: string,
  calendarId: string,
  eventId: string,
  changes: EventChanges,
  timeZone: string
) {
  const { raw } = await getEvent(token, calendarId, eventId);
  const body: any = {};
  if (changes.title !== undefined) body.summary = changes.title;
  if (changes.location !== undefined) body.location = changes.location;
  if (changes.description !== undefined) body.description = changes.description;

  const timeChanged =
    changes.date !== undefined ||
    changes.startTime !== undefined ||
    changes.endTime !== undefined ||
    changes.allDay !== undefined;

  if (timeChanged) {
    const wasAllDay = !raw.start?.dateTime;
    let date: string, startTime: string | undefined, endTime: string | undefined;
    if (wasAllDay) {
      date = raw.start.date;
    } else {
      const s = localParts(raw.start.dateTime, timeZone);
      const e = localParts(raw.end.dateTime, timeZone);
      date = s.date;
      startTime = s.time;
      endTime = e.time;
    }
    const allDay = changes.allDay ?? (changes.startTime ? false : wasAllDay);
    // kalau jam mulai digeser tanpa jam selesai, pertahankan durasi
    if (changes.startTime && !changes.endTime && !wasAllDay && raw.start?.dateTime) {
      const dur = new Date(raw.end.dateTime).getTime() - new Date(raw.start.dateTime).getTime();
      const [h, m] = changes.startTime.split(":").map(Number);
      const endMin = (h * 60 + m + Math.round(dur / 60000)) % (24 * 60);
      endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
    }
    const tb = timeBlock(
      changes.date ?? date,
      changes.startTime ?? startTime,
      changes.endTime ?? endTime,
      allDay,
      timeZone
    );
    body.start = tb.start;
    body.end = tb.end;
  }

  let hasAttendees = (raw.attendees || []).length > 0;
  if (changes.addAttendees?.length || changes.removeAttendees?.length) {
    const remove = new Set((changes.removeAttendees || []).map((e) => e.toLowerCase()));
    const list = (raw.attendees || []).filter((a: any) => !remove.has(String(a.email).toLowerCase()));
    const existing = new Set(list.map((a: any) => String(a.email).toLowerCase()));
    for (const email of changes.addAttendees || []) {
      if (!existing.has(email.toLowerCase())) list.push({ email });
    }
    body.attendees = list;
    hasAttendees = hasAttendees || list.length > 0;
  }

  const q = hasAttendees ? "?sendUpdates=all" : "";
  return gfetch(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}${q}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

/** Hapus jadwal. Jika user hanya tamu, jadwal hanya hilang dari kalendernya. */
export async function deleteEvent(token: string, calendarId: string, eventId: string) {
  return gfetch(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "DELETE" }
  );
}

/** Jawab undangan: accepted / declined / tentative */
export async function respondToInvite(
  token: string,
  eventId: string,
  response: "accepted" | "declined" | "tentative"
) {
  const { raw } = await getEvent(token, "primary", eventId);
  const attendees = (raw.attendees || []).map((a: any) => (a.self ? { ...a, responseStatus: response } : a));
  if (!attendees.some((a: any) => a.self)) throw new Error("Kamu tidak terdaftar sebagai tamu di jadwal ini.");
  return gfetch(token, `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "PATCH",
    body: JSON.stringify({ attendees }),
  });
}
