# Buku Kos & Token Listrik Online

Aplikasi untuk 7 pintu kos dengan pembayaran kos dan token listrik bersama.
Data disimpan di Supabase sehingga perangkat yang berbeda dapat melihat data yang sama.

## 1. Persiapan Supabase

Buka Supabase Dashboard → SQL Editor → New query.

Salin seluruh isi `supabase/setup.sql`, tempel, lalu klik Run.

## 2. Jalankan di Visual Studio Code

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

## 3. Buat link online dengan Vercel

Di terminal:

```bash
npm run build
npx vercel login
npm run deploy
```

Ikuti pertanyaan Vercel. Setelah selesai, terminal akan memberikan URL `https://...vercel.app`.

## 4. Keamanan

File ini memakai Supabase Publishable Key, bukan service-role/secret key.
Jangan pernah memasukkan service-role key ke HTML, JavaScript browser, GitHub, atau Vercel.

Catatan: policy SQL pada contoh ini membuat aplikasi dapat membaca, menambah, dan menghapus data secara publik. Untuk aplikasi yang sudah dipakai sungguhan, sebaiknya ditambahkan login/authentication dan RLS yang lebih ketat.
