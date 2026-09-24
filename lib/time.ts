/** Offset zona waktu untuk tanggal tertentu, contoh "+07:00". */
export function tzOffset(dateStr: string, timeZone: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  // part berbentuk "GMT+07:00" atau "GMT"
  if (!part || part === "GMT") return "+00:00";
  return part.replace("GMT", "");
}

/** "2026-10-12" + "09:30" -> "2026-10-12T09:30:00+07:00" */
export function toRfc3339(dateStr: string, time: string, timeZone: string): string {
  return `${dateStr}T${time.length === 5 ? time + ":00" : time}${tzOffset(dateStr, timeZone)}`;
}

/** Tambah n hari pada "YYYY-MM-DD" */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Tanggal hari ini (YYYY-MM-DD) di zona waktu tertentu */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function isValidDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
