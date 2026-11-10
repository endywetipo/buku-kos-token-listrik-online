# BukuKosOnline — Buku Kos & Token Listrik Online

Aplikasi web untuk mencatat pembayaran kos dan token listrik. Bisa dipakai oleh kos mana saja, berapa pun jumlah pintunya (1–500). Data setiap kos disimpan terpisah di Supabase dan tidak bisa dilihat oleh kos lain.

## Cara kerja

1. Pengguna mendaftar dengan email dan password, lalu memilih peran:
   - **Pemilik Kos**: membuat kos (nama, kota, jumlah pintu, harga per bulan, mode token). Kode undangan 6 karakter dibuat otomatis.
   - **Penyewa**: memasukkan kode undangan dari pemilik dan nomor pintunya.
2. Setiap kos memilih **mode token listrik**:
   - `bersama`: satu meter token dipakai bersama. Pemilik mencatat pembelian token, lalu total dibagi rata per pintu (bagian pintu kosong ditanggung pemilik) dan setiap penyewa menerima tagihan token.
   - `per_pintu`: setiap pintu punya token sendiri. Fitur token disembunyikan sehingga penyewa hanya membayar kos.
3. Pemisahan data ditegakkan di database dengan Row Level Security (RLS), bukan hanya di tampilan:
   - Pemilik hanya melihat data kos miliknya.
   - Penyewa hanya melihat pembayaran kos miliknya/pintunya, token kosnya, dan tagihan miliknya sendiri.
   - Foto bukti transfer disimpan di bucket privat dengan path `<kos_id>/...` dan hanya bisa dibuka oleh anggota kos tersebut.

## Fitur

- Dashboard pemilik: status bayar per pintu, daftar penyewa (ubah pintu, keluarkan), tagihan token, grafik 6 bulan.
- Dashboard penyewa: status kos bulan ini, tagihan token, riwayat pembayaran, keluar dari kos.
- Pengaturan kos: kode undangan (salin / buat baru), nama, kota, jumlah pintu, harga, mode token, nomor meter PLN, dan rekening.
- Input pembayaran kos dan token dengan unggah bukti JPG/PNG (maksimal 2 MB).
- Export rekap ke WhatsApp, Excel (.xlsx), PDF, dan JSON.

## 1. Persiapan Supabase

**Instalasi baru:** buka Supabase Dashboard → SQL Editor → New query, tempel seluruh isi `supabase/setup.sql`, lalu klik Run.

**Database yang sudah berjalan:** jalankan file di `supabase/migrations/` yang belum pernah dijalankan, berurutan sesuai nama file. Untuk pembaruan multi-kos, jalankan `supabase/migrations/20261111000000_multi_kos_global.sql`. Migrasi ini aman dijalankan ulang.

## 2. Jalankan secara lokal

```bash
npm install
npm run dev
```

Buka alamat yang ditampilkan Vite, biasanya `http://localhost:5173`.

## 3. Deploy ke Vercel

```bash
npm run build
npx vercel login
npm run deploy
```

## 4. Keamanan

Browser hanya memakai Supabase Publishable Key, bukan service-role/secret key. Jangan pernah memasukkan service-role key ke HTML, JavaScript browser, GitHub, atau Vercel.

Semua izin baca/tulis ditegakkan oleh RLS dan fungsi RPC `SECURITY DEFINER` (`create_kos_for_owner`, `join_kos_by_code`, `leave_kos`, `owner_set_tenant_kamar`, `owner_remove_tenant`, `regenerate_invite_code`). Email pada tabel `admin_emails` adalah admin aplikasi yang dapat melihat semua kos.
