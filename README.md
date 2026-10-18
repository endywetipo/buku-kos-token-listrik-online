# Buku Kos & Token Listrik Online

Aplikasi untuk 7 pintu kos dengan pembayaran kos dan token listrik bersama.
Data disimpan di Supabase sehingga perangkat yang berbeda dapat melihat data yang sama.

## Fitur

- Halaman login dan pendaftaran terpisah, dengan ikon mata untuk melihat/menyembunyikan password.
- Halaman dashboard, daftar pembayaran kos, input kos, daftar token, input token, dan export yang terpisah.
- Admin mengedit melalui halaman edit tersendiri dan menghapus melalui halaman konfirmasi.
- Pengguna yang sudah login dapat mencatat pembayaran; edit dan hapus tetap dibatasi policy RLS Supabase untuk admin.

## 1. Persiapan Supabase

Buka Supabase Dashboard → SQL Editor → New query.

Salin seluruh isi `supabase/setup.sql`, tempel, lalu klik Run.

Untuk fitur bukti transfer BukuKosOnline PRO, jalankan juga `supabase/pro_upgrade.sql` di SQL Editor. Migrasi ini menambahkan kolom path bukti dan bucket privat JPG/PNG maksimal 2 MB. Tanpa migrasi tersebut, fitur selain upload bukti tetap dapat digunakan, tetapi penyimpanan foto belum aktif.

## 2. Jalankan secara lokal

Buka folder proyek ini di VS Code, lalu buka Terminal.

Jalankan:

```bash
npm install
npm run dev
```

Buka alamat yang ditampilkan Vite, biasanya:

```text
http://localhost:5173
```

## 3. Deploy ke Vercel

Di terminal:

```bash
npm run build
npx vercel login
npm run deploy
```

Ikuti pertanyaan Vercel. Setelah selesai, terminal akan memberikan URL `https://...vercel.app`.

## 4. Keamanan

File ini memakai Supabase Publishable Key di browser, bukan service-role/secret key. Jangan pernah memasukkan service-role key ke HTML, JavaScript browser, GitHub, atau Vercel.

Login pada antarmuka bukan pengganti keamanan database. Pastikan perubahan dan penghapusan tetap ditegakkan oleh Row Level Security di Supabase, serta email admin pada tabel `admin_emails` sesuai dengan akun pengelola.
