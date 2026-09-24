import Link from "next/link";

export const metadata = { title: "Kebijakan Privasi – AI Daily Planner" };

export default function Privacy() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "(isi NEXT_PUBLIC_CONTACT_EMAIL)";
  const provider = (process.env.AI_PROVIDER || "groq") === "gemini" ? "Google Gemini API" : "Groq";

  return (
    <main className="doc"><div className="card">
      <p>
        <Link href="/">← Kembali</Link>
      </p>
      <h1>Kebijakan Privasi</h1>
      <p>Terakhir diperbarui: 24 September 2026</p>

      <p>
        AI Daily Planner (&ldquo;aplikasi&rdquo;) membantu kamu melihat dan menambah jadwal Google Calendar serta
        bertanya tentang jadwal lewat chat. Halaman ini menjelaskan data apa yang diakses dan bagaimana
        penggunaannya.
      </p>

      <h2>Data yang kami akses</h2>
      <ul>
        <li>Nama, alamat email, dan foto profil Google kamu, untuk menampilkan akun yang sedang login.</li>
        <li>
          Daftar kalender dan jadwal di Google Calendar kamu (izin <code>calendar.events</code> dan{" "}
          <code>calendar.calendarlist.readonly</code>), untuk menampilkan jadwal dan menjawab pertanyaan.
        </li>
        <li>Pesan yang kamu ketik di fitur chat.</li>
      </ul>

      <h2>Bagaimana data digunakan</h2>
      <ul>
        <li>Jadwal diambil langsung dari Google Calendar setiap kali dibutuhkan dan <strong>tidak disimpan</strong> di database kami.</li>
        <li>
          Saat kamu bertanya di chat, pertanyaan beserta jadwal yang relevan dikirim ke penyedia AI ({provider})
          untuk menyusun jawaban. Riwayat chat tidak disimpan di server kami; riwayat hilang saat halaman ditutup.
        </li>
        <li>Aplikasi hanya membuat, mengubah, atau menghapus jadwal, mengundang tamu, dan menjawab undangan setelah kamu menekan tombol konfirmasi. Saat kamu mengundang orang, Google Calendar mengirim email undangan ke alamat yang kamu masukkan.</li>
        <li>Token login disimpan dalam cookie terenkripsi di browser kamu.</li>
        <li>Untuk membatasi pemakaian, kami menyimpan jumlah pertanyaan per hari yang dikaitkan dengan email kamu, dan data ini dihapus otomatis dalam 26 jam.</li>
      </ul>

      <h2>Berbagi data</h2>
      <p>
        Kami tidak menjual, menyewakan, atau membagikan data kamu kepada pihak lain, selain penyedia AI yang disebut
        di atas untuk memproses pertanyaan chat, dan penyedia hosting (Vercel) yang menjalankan aplikasi.
      </p>
      <p>
        Penggunaan dan pengiriman informasi yang diterima dari Google API oleh aplikasi ini mematuhi{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Google API Services User Data Policy
        </a>
        , termasuk persyaratan Limited Use.
      </p>

      <h2>Mencabut akses</h2>
      <p>
        Kamu bisa mencabut akses aplikasi kapan saja di{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          myaccount.google.com/permissions
        </a>
        . Setelah dicabut, aplikasi tidak bisa lagi membaca kalender kamu.
      </p>

      <h2>Kontak</h2>
      <p>Pertanyaan tentang privasi: {contact}</p>
    </div></main>
  );
}
