import { NextResponse } from "next/server";
import { GoogleApiError, GoogleAuthError } from "./google";

export function handleGoogleError(e: unknown) {
  if (e instanceof GoogleAuthError) {
    return NextResponse.json({ error: "Sesi Google kedaluwarsa, silakan login ulang." }, { status: 401 });
  }
  if (e instanceof GoogleApiError) {
    if (e.status === 403)
      return NextResponse.json({ error: "Kamu tidak punya izin mengubah jadwal ini." }, { status: 403 });
    if (e.status === 404)
      return NextResponse.json({ error: "Jadwal tidak ditemukan (mungkin sudah dihapus)." }, { status: 404 });
  }
  console.error(e);
  return NextResponse.json({ error: "Gagal menghubungi Google Calendar." }, { status: 500 });
}
