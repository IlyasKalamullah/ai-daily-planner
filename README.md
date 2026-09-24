# AI Daily Planner

Daily planner berbasis web yang terhubung ke **Google Calendar**, dengan **chat AI** yang bisa menjawab pertanyaan seperti *"tanggal 12 ada jadwal apa?"* dan menambah jadwal baru (setelah kamu konfirmasi).

**Semua gratis:** Vercel Hobby + Google Calendar API + Groq free tier.

## Fitur

- Login dengan akun Google. Bisa dipakai banyak orang, dan tiap orang hanya melihat jadwalnya sendiri.
- Tampilan mingguan dan harian dari semua kalender yang aktif, termasuk kalender yang dibagikan orang lain.
- Chat AI dengan *tool calling*: AI mengecek Google Calendar sebelum menjawab, jadi tidak mengarang jadwal.
- Tambah, edit, dan hapus jadwal lewat chat atau dengan mengklik jadwal di agenda. Semua perubahan lewat chat perlu dikonfirmasi dulu.
- Undang orang lewat email ("buat rapat Jumat jam 10, undang budi@gmail.com"). Google mengirim email undangannya.
- Kartu **Undangan** untuk menerima, menolak, atau menjawab "mungkin" undangan dari orang lain.
- Batas chat per pengguna per hari, supaya kuota AI gratis tidak cepat habis.
- Halaman Kebijakan Privasi di `/privacy`, yang dibutuhkan untuk verifikasi Google.
- Tidak ada database. Jadwal dibaca langsung dari Google dan tidak disimpan.

## Struktur

```
auth.ts                     Login Google (Auth.js) + auto-refresh token
lib/google.ts               Baca & buat jadwal lewat Google Calendar API
lib/ai.ts                   Klien AI (Groq / Gemini, format OpenAI)
lib/ratelimit.ts            Batas chat harian per user
lib/time.ts                 Utilitas tanggal & zona waktu
app/page.tsx                Halaman login
app/planner/page.tsx        Halaman planner (butuh login)
app/privacy/page.tsx        Kebijakan privasi
app/api/chat/route.ts       Endpoint chat + tool calling
app/api/events/route.ts     Endpoint ambil & buat jadwal
components/Planner.tsx      UI planner mingguan/harian
components/Chat.tsx         UI chat + kartu konfirmasi jadwal
```

---

# Panduan Setup (±20 menit)

## Langkah 1. Siapkan Google Cloud (login + akses Calendar)

1. Buka <https://console.cloud.google.com/> dan login.
2. Klik pemilih project di kiri atas, pilih **New Project**, beri nama (misalnya `ai-daily-planner`), lalu **Create**.
3. Aktifkan Calendar API: menu **APIs & Services → Library**, cari **Google Calendar API**, lalu klik **Enable**.
4. Atur halaman persetujuan: **APIs & Services → OAuth consent screen** (di tampilan baru disebut **Google Auth Platform**).
   - **Branding:** isi nama app, email support, dan email developer.
   - **Audience:** pilih **External**.
   - **Data Access → Add or remove scopes:** tambahkan
     - `.../auth/calendar.events`
     - `.../auth/calendar.calendarlist.readonly`
     - `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
5. Buat kredensial: **Clients** (atau **Credentials → Create Credentials → OAuth client ID**).
   - Application type: **Web application**
   - **Authorized JavaScript origins:**
     - `http://localhost:3000`
     - `https://NAMA-APP-KAMU.vercel.app` (isi setelah deploy di Langkah 4)
   - **Authorized redirect URIs:**
     - `http://localhost:3000/api/auth/callback/google`
     - `https://NAMA-APP-KAMU.vercel.app/api/auth/callback/google`
   - Klik **Create**, lalu salin **Client ID** dan **Client Secret**.

### Mode "Testing" atau "In production"?

Pilih di **Audience** (dulu bernama *Publishing status*):

| Mode | Siapa yang bisa login | Login ulang | Peringatan |
|---|---|---|---|
| **Testing** | Hanya email yang ditambahkan di *Test users* (maks. 100) | Setiap 7 hari | Tidak ada |
| **In production**, tanpa verifikasi | Semua akun Google (maks. 100 user) | Tidak perlu | Muncul "Google hasn't verified this app". User klik *Advanced → Go to …* |
| **In production**, terverifikasi | Tidak terbatas | Tidak perlu | Tidak ada |

**Saran:** mulai dengan **Testing** untuk mencoba. Setelah aplikasi jalan, klik **Publish app** supaya teman-teman bisa login tanpa perlu login ulang tiap 7 hari.

## Langkah 2. Ambil API key AI gratis (Groq)

1. Buka <https://console.groq.com/> dan daftar (tidak perlu kartu kredit).
2. Buka **API Keys → Create API Key**, lalu salin key-nya (diawali `gsk_`).

> Alternatif: Gemini. Ambil key di <https://aistudio.google.com/apikey>, lalu set `AI_PROVIDER=gemini`. Perlu diingat, data di free tier Gemini bisa dipakai Google untuk melatih model. Karena aplikasi ini mengirim isi jadwal ke AI, **Groq lebih disarankan**.

## Langkah 3. Coba di komputer sendiri (opsional)

Butuh [Node.js](https://nodejs.org/) versi 20.9 atau lebih baru.

```bash
npm install
cp .env.example .env.local     # di Windows: copy .env.example .env.local
npx auth secret                # otomatis mengisi AUTH_SECRET di .env.local
```

Buka `.env.local`, isi `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, dan `AI_API_KEY`, lalu jalankan:

```bash
npm run dev
```

Buka <http://localhost:3000>.

## Langkah 4. Deploy ke Vercel

1. Upload folder ini ke repository GitHub baru. File `.env.local` tidak ikut ter-upload karena sudah ada di `.gitignore`.
2. Buka <https://vercel.com/new>, login dengan GitHub, lalu **Import** repository tersebut.
3. Sebelum klik Deploy, buka **Environment Variables** dan isi:

   | Nama | Nilai |
   |---|---|
   | `AUTH_SECRET` | String acak. Buat dengan `npx auth secret` atau `openssl rand -base64 32` |
   | `AUTH_GOOGLE_ID` | Client ID dari Langkah 1 |
   | `AUTH_GOOGLE_SECRET` | Client Secret dari Langkah 1 |
   | `AI_API_KEY` | Key Groq dari Langkah 2 |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | Email kontak untuk halaman privasi |

4. Klik **Deploy**. Setelah selesai, kamu mendapat URL seperti `https://ai-daily-planner-xxx.vercel.app`.
5. **Penting:** kembali ke Google Cloud (Langkah 1.5) dan tambahkan URL itu ke *Authorized JavaScript origins* dan *Authorized redirect URIs* (dengan akhiran `/api/auth/callback/google`).
6. Buka URL-nya, login, dan coba tanya "hari ini ada jadwal apa?".

## Pengaturan tambahan (opsional)

| Variabel | Fungsi |
|---|---|
| `CHAT_DAILY_LIMIT` | Batas pertanyaan per user per hari (default 30) |
| `ALLOWED_EMAILS` | Batasi yang boleh login, misalnya `a@gmail.com,b@gmail.com`. Kosongkan untuk mengizinkan semua akun |
| `AI_PROVIDER` | `groq` (default) atau `gemini` |
| `AI_MODEL` | Ganti model, misalnya `llama-3.3-70b-versatile` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Supaya batas chat tersimpan permanen. Buat database gratis di <https://upstash.com> (Redis), lalu salin *REST URL* dan *REST Token*. Tanpa ini, hitungan batas disimpan di memori server dan bisa ter-reset |

Setelah mengubah environment variable di Vercel, buka **Deployments → ⋯ → Redeploy** supaya perubahan berlaku.

## Mematikan fitur tambah jadwal

Kalau chat cukup untuk membaca jadwal saja:

1. Di `app/api/chat/route.ts`, hapus objek `propose_event`, `propose_update`, `propose_delete`, dan `propose_rsvp` dari array `TOOLS`.
2. Di `auth.ts`, ganti scope `calendar.events` menjadi `https://www.googleapis.com/auth/calendar.events.readonly`, lalu sesuaikan scope yang sama di Google Cloud.

## Supaya bisa dipakai publik tanpa peringatan (verifikasi Google)

Verifikasi Google gratis untuk scope Calendar. Syaratnya:

1. **Domain sendiri** (misalnya `.my.id`, harganya murah). Sambungkan domain di Vercel lewat **Settings → Domains**.
2. Verifikasi kepemilikan domain di [Google Search Console](https://search.google.com/search-console).
3. Di Branding, isi *Application home page* (`https://domainkamu/`) dan *Privacy policy link* (`https://domainkamu/privacy`).
4. Rekam video demo singkat yang menunjukkan alur login dan penggunaan data kalender, lalu upload ke YouTube (unlisted).
5. Klik **Prepare for verification** dan ikuti formulirnya. Proses review bisa berlangsung beberapa hari sampai beberapa minggu.

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `Error 400: redirect_uri_mismatch` | Redirect URI di Google Cloud harus sama persis, termasuk `https` dan tanpa garis miring di akhir |
| `Access blocked: app has not completed verification` | App masih mode Testing dan email kamu belum ada di *Test users*. Tambahkan email, atau publish app |
| Jadwal tidak muncul setelah login | Pastikan kotak izin Calendar dicentang saat login. Logout lalu login lagi |
| Harus login ulang terus | Di mode Testing, token berlaku 7 hari. Publish app untuk menghilangkannya |
| "Layanan AI sedang sibuk" | Kuota gratis Groq per menit tercapai. Tunggu sebentar |
| "Batas pertanyaan per hari tercapai" | Naikkan `CHAT_DAILY_LIMIT` |

## Catatan biaya

- **Vercel Hobby:** gratis untuk proyek non-komersial. Kalau aplikasi dimonetisasi, Vercel mewajibkan plan Pro.
- **Google Calendar API:** gratis, dengan kuota harian besar.
- **Groq free tier:** gratis tanpa kartu kredit, dibatasi jumlah request per menit dan per hari. Kuota ini dibagi ke semua pengguna aplikasi kamu.
