import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createEvent, deleteEvent, getEvents, updateEvent } from "@/lib/google";
import { handleGoogleError } from "@/lib/errors";
import { addDays, isValidDate, isValidTimeZone } from "@/lib/time";
import { hasChanges, parseChanges, parseNewEvent, str } from "@/lib/validate";

async function requireSession() {
  const session = await auth();
  if (!session?.accessToken || session.error) return null;
  return session;
}

const tzOf = (v: unknown) => (isValidTimeZone(v) ? (v as string) : "Asia/Jakarta");

// GET /api/events?start=2026-10-01&end=2026-10-07&tz=Asia/Jakarta
export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  let end = url.searchParams.get("end") || start;
  const tz = tzOf(url.searchParams.get("tz"));
  if (!isValidDate(start) || !isValidDate(end)) {
    return NextResponse.json({ error: "Parameter tanggal tidak valid." }, { status: 400 });
  }
  if (end > addDays(start, 62)) end = addDays(start, 62);

  try {
    return NextResponse.json({ events: await getEvents(session.accessToken!, start, end, tz) });
  } catch (e) {
    return handleGoogleError(e);
  }
}

// POST /api/events  { event, timeZone } -> buat jadwal baru
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ev = parseNewEvent(body?.event);
  if (!ev) return NextResponse.json({ error: "Data jadwal tidak valid." }, { status: 400 });

  try {
    const created = await createEvent(session.accessToken!, ev, tzOf(body?.timeZone));
    return NextResponse.json({ ok: true, link: created?.htmlLink });
  } catch (e) {
    return handleGoogleError(e);
  }
}

// PATCH /api/events  { calendarId, eventId, changes, timeZone } -> ubah jadwal
export async function PATCH(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const calendarId = str(body?.calendarId, 300);
  const eventId = str(body?.eventId, 300);
  const changes = parseChanges(body?.changes);
  if (!calendarId || !eventId || !hasChanges(changes)) {
    return NextResponse.json({ error: "Data perubahan tidak valid." }, { status: 400 });
  }
  try {
    await updateEvent(session.accessToken!, calendarId, eventId, changes, tzOf(body?.timeZone));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleGoogleError(e);
  }
}

// DELETE /api/events  { calendarId, eventId } -> hapus jadwal
export async function DELETE(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const calendarId = str(body?.calendarId, 300);
  const eventId = str(body?.eventId, 300);
  if (!calendarId || !eventId) return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  try {
    await deleteEvent(session.accessToken!, calendarId, eventId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleGoogleError(e);
  }
}
