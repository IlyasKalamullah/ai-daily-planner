import { isValidDate } from "./time";
import type { EventChanges, NewEvent } from "./google";

const TIME = /^\d{2}:\d{2}$/;
const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

export const isTime = (t: unknown): t is string => typeof t === "string" && TIME.test(t);
export const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

export function emails(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,;]+/) : [];
  return [...new Set(arr.map((e) => String(e).trim().toLowerCase()).filter((e) => EMAIL.test(e)))].slice(0, 50);
}

/** Validasi data jadwal baru. Mengembalikan null jika tidak valid. */
export function parseNewEvent(v: any): NewEvent | null {
  const title = str(v?.title, 200);
  if (!title || !isValidDate(v?.date)) return null;
  if (v.startTime !== undefined && !isTime(v.startTime)) return null;
  if (v.endTime !== undefined && !isTime(v.endTime)) return null;
  return {
    title,
    date: v.date,
    startTime: v.startTime,
    endTime: v.endTime,
    allDay: !!v.allDay || !v.startTime,
    location: str(v.location, 200) || undefined,
    description: str(v.description, 2000) || undefined,
    attendees: emails(v.attendees),
  };
}

/** Validasi perubahan jadwal. Field yang tidak valid dibuang. */
export function parseChanges(v: any): EventChanges {
  const c: EventChanges = {};
  const title = str(v?.title, 200);
  if (title) c.title = title;
  if (isValidDate(v?.date)) c.date = v.date;
  if (isTime(v?.startTime)) c.startTime = v.startTime;
  if (isTime(v?.endTime)) c.endTime = v.endTime;
  if (typeof v?.allDay === "boolean") c.allDay = v.allDay;
  if (typeof v?.location === "string") c.location = v.location.slice(0, 200);
  if (typeof v?.description === "string") c.description = v.description.slice(0, 2000);
  const add = emails(v?.addAttendees);
  const remove = emails(v?.removeAttendees);
  if (add.length) c.addAttendees = add;
  if (remove.length) c.removeAttendees = remove;
  return c;
}

export const hasChanges = (c: EventChanges) => Object.keys(c).length > 0;
