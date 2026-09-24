import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { CalendarIcon, ChatIcon, PlusIcon, SparkIcon } from "@/components/Icons";

const ERRORS: Record<string, string> = {
  AccessDenied: "Akun ini tidak diizinkan mengakses aplikasi.",
  Configuration: "Konfigurasi login bermasalah. Hubungi pemilik aplikasi.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user && !session.error) redirect("/planner");
  const { error } = await searchParams;

  return (
    <main className="landing">
      <div className="landing-card">
        <div className="logo">
          <SparkIcon size={26} />
        </div>
        <h1>
          Rencanakan harimu, <span>tanya saja.</span>
        </h1>
        <p className="lead">Planner harian yang terhubung ke Google Calendar, lengkap dengan asisten AI.</p>
        <ul className="features">
          <li>
            <span className="ic"><CalendarIcon /></span>
            Jadwal harian &amp; mingguan dari Google Calendar
          </li>
          <li>
            <span className="ic"><ChatIcon /></span>
            &ldquo;Tanggal 12 ada jadwal apa?&rdquo;, langsung dijawab
          </li>
          <li>
            <span className="ic"><PlusIcon /></span>
            Tambah jadwal lewat chat, dengan konfirmasi
          </li>
        </ul>
        {error && <div className="alert">{ERRORS[error] || "Login gagal, silakan coba lagi."}</div>}
        {session?.error && <div className="alert">Sesi kamu sudah berakhir. Silakan login lagi.</div>}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/planner" });
          }}
        >
          <button className="btn btn-primary btn-lg" type="submit">
            <GoogleIcon /> Masuk dengan Google
          </button>
        </form>
        <div className="footer-links">
          <Link href="/privacy">Kebijakan Privasi</Link>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#fff" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
