import { addDays, toRfc3339 } from "./time";

const API = "https://www.googleapis.com/calendar/v3";

export type PlannerEvent = {
  id: string;
  calendar: string;
  calendarColor?: string;
  title: string;
  start: string; // RFC3339 atau YYYY-MM-DD (seharian)
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  link?: string;
};

export class GoogleAuthError extends Error {}

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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar API ${res.status}: ${text.slice(0, 300)}`);
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
    // Kalau izin daftar kalender tidak diberikan, pakai kalender utama saja.
    return [{ id: "primary", summary: "Kalender utama", accessRole: "owner", primary: true }];
  }
}

/**
 * Ambil jadwal dari tanggal startDate s/d endDate (inklusif), di zona waktu user.
 */
export async function getEvents(
  token: string,
  startDate: string,
  endDate: string,
  timeZone: string
): Promise<PlannerEvent[]> {
  const timeMin = toRfc3339(startDate, "00:00", timeZone);
  const timeMax = toRfc3339(addDays(endDate, 1), "00:00", timeZone);
  const calendars = await listCalendars(token);

  const results = await Promise.all(
    calendars.map(async (cal) => {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        timeZone,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      });
      try {
        const data = await gfetch(
          token,
          `/calendars/${encodeURIComponent(cal.id)}/events?${params}`
        );
        return (data.items || [])
          .filter((ev: any) => ev.status !== "cancelled")
          .map(
            (ev: any): PlannerEvent => ({
              id: ev.id,
              calendar: cal.summaryOverride || cal.summary,
              calendarColor: cal.backgroundColor,
              title: ev.summary || "(Tanpa judul)",
              start: ev.start?.dateTime || ev.start?.date,
              end: ev.end?.dateTime || ev.end?.date,
              allDay: !ev.start?.dateTime,
              location: ev.location,
              description: ev.description?.slice(0, 500),
              link: ev.htmlLink,
            })
          );
      } catch (e) {
        if (e instanceof GoogleAuthError) throw e;
        console.error(`Gagal membaca kalender ${cal.id}`, e);
        return [];
      }
    })
  );

  return results
    .flat()
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export type NewEvent = {
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  allDay?: boolean;
  description?: string;
  location?: string;
};

/** Buat jadwal baru di kalender utama user. */
export async function createEvent(token: string, ev: NewEvent, timeZone: string) {
  let body: any;
  if (ev.allDay || !ev.startTime) {
    body = {
      summary: ev.title,
      description: ev.description,
      location: ev.location,
      start: { date: ev.date },
      end: { date: addDays(ev.date, 1) },
    };
  } else {
    const end = ev.endTime || addHour(ev.startTime);
    const endDate = end <= ev.startTime ? addDays(ev.date, 1) : ev.date;
    body = {
      summary: ev.title,
      description: ev.description,
      location: ev.location,
      start: { dateTime: toRfc3339(ev.date, ev.startTime, timeZone), timeZone },
      end: { dateTime: toRfc3339(endDate, end, timeZone), timeZone },
    };
  }
  return gfetch(token, "/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function addHour(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
