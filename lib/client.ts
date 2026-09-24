"use client";

import type { EventChanges, NewEvent, RsvpResponse } from "./types";

/** Panggil API internal. Otomatis ke halaman login jika sesi habis. */
async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = "/";
    throw new Error("Sesi berakhir");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
  return data;
}

export const api = {
  create: (event: NewEvent, timeZone: string) => call("/api/events", "POST", { event, timeZone }),
  update: (calendarId: string, eventId: string, changes: EventChanges, timeZone: string) =>
    call("/api/events", "PATCH", { calendarId, eventId, changes, timeZone }),
  remove: (calendarId: string, eventId: string) => call("/api/events", "DELETE", { calendarId, eventId }),
  rsvp: (eventId: string, response: RsvpResponse) => call("/api/invites", "POST", { eventId, response }),
};

export const RSVP_LABEL: Record<RsvpResponse, string> = {
  accepted: "Terima",
  declined: "Tolak",
  tentative: "Mungkin",
};

export const STATUS_LABEL = {
  accepted: "Hadir",
  declined: "Menolak",
  tentative: "Mungkin",
  needsAction: "Belum jawab",
} as const;

export function formatDateLong(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** Ringkasan perubahan untuk ditampilkan di kartu konfirmasi. */
export function describeChanges(c: EventChanges): string[] {
  const out: string[] = [];
  if (c.title) out.push(`Judul → ${c.title}`);
  if (c.date) out.push(`Tanggal → ${formatDateLong(c.date)}`);
  if (c.allDay) out.push("Jadi seharian");
  if (c.startTime || c.endTime)
    out.push(`Jam → ${c.startTime?.replace(":", ".") ?? "…"}${c.endTime ? `–${c.endTime.replace(":", ".")}` : ""}`);
  if (c.location !== undefined) out.push(c.location ? `Lokasi → ${c.location}` : "Hapus lokasi");
  if (c.description !== undefined) out.push("Catatan diperbarui");
  if (c.addAttendees?.length) out.push(`Undang → ${c.addAttendees.join(", ")}`);
  if (c.removeAttendees?.length) out.push(`Hapus tamu → ${c.removeAttendees.join(", ")}`);
  return out;
}
