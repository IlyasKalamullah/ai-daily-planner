import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPendingInvites, respondToInvite } from "@/lib/google";
import { handleGoogleError } from "@/lib/errors";
import { isValidTimeZone, todayIn } from "@/lib/time";
import { str } from "@/lib/validate";

// GET /api/invites?tz=Asia/Jakarta -> undangan yang belum dijawab
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.accessToken || session.error)
    return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });

  const tzParam = new URL(req.url).searchParams.get("tz");
  const tz = isValidTimeZone(tzParam) ? tzParam : "Asia/Jakarta";
  try {
    return NextResponse.json({ invites: await getPendingInvites(session.accessToken, todayIn(tz), tz) });
  } catch (e) {
    return handleGoogleError(e);
  }
}

// POST /api/invites { eventId, response: "accepted" | "declined" | "tentative" }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken || session.error)
    return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const eventId = str(body?.eventId, 300);
  const response = body?.response;
  if (!eventId || !["accepted", "declined", "tentative"].includes(response)) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }
  try {
    await respondToInvite(session.accessToken, eventId, response);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message?.startsWith("Kamu tidak terdaftar")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return handleGoogleError(e);
  }
}
