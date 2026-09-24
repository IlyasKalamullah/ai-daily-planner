import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createEvent, getEvents, GoogleAuthError } from "@/lib/google";
import { addDays, isValidDate, isValidTimeZone } from "@/lib/time";

async function requireSession() {
  const session = await auth();
  if (!session?.accessToken || session.error) return null;
  return session;
}

function handleError(e: unknown) {
  if (e instanceof GoogleAuthError) {
    return NextResponse.json({ error: "Sesi Google kedaluwarsa, silakan login ulang." }, { status: 401 });
  }
  console.error(e);
  return NextResponse.json({ error: "Gagal menghubungi Google Calendar." }, { status: 500 });
}

// GET /api/events?start=2026-10-01&end=2026-10-07&tz=Asia/Jakarta
export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  let end = url.searchParams.get("end") || start;
  const tzParam = url.searchParams.get("tz");
  const tz = isValidTimeZone(tzParam) ? tzParam : "Asia/Jakarta";
  if (!isValidDate(start) || !isValidDate(end)) {
    return NextResponse.json({ error: "Parameter tanggal tidak valid." }, { status: 400 });
  }
  if (end > addDays(start, 62)) end = addDays(start, 62);

  try {
    const events = await getEvents(session.accessToken!, start, end, tz);
    return NextResponse.json({ events });
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/events  -> membuat jadwal baru (setelah user menekan konfirmasi)
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ev = body?.event;
  const tz = isValidTimeZone(body?.timeZone) ? body.timeZone : "Asia/Jakarta";
  const validTime = (t: unknown) => t === undefined || (typeof t === "string" && /^\d{2}:\d{2}$/.test(t));
  if (!ev?.title || !isValidDate(ev?.date) || !validTime(ev.startTime) || !validTime(ev.endTime)) {
    return NextResponse.json({ error: "Data jadwal tidak valid." }, { status: 400 });
  }

  try {
    const created = await createEvent(
      session.accessToken!,
      {
        title: String(ev.title).slice(0, 200),
        date: ev.date,
        startTime: ev.startTime,
        endTime: ev.endTime,
        allDay: !!ev.allDay,
        location: ev.location ? String(ev.location).slice(0, 200) : undefined,
        description: ev.description ? String(ev.description).slice(0, 1000) : undefined,
      },
      tz
    );
    return NextResponse.json({ ok: true, link: created.htmlLink });
  } catch (e) {
    return handleError(e);
  }
}
