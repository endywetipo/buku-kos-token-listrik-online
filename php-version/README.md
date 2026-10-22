# BukuKos Online — Versi PHP Native MySQL

Ini adalah versi alternatif PHP Native MySQL dari aplikasi utama yang menggunakan Supabase PostgreSQL + React.

## Cara Install

1. **Install XAMPP** dan jalankan Apache + MySQL.
2. Buka **phpMyAdmin** (`http://localhost/phpmyadmin`).
3. Import file `database.sql` ke phpMyAdmin — ini akan membuat database `bukukos` beserta seluruh tabel.
4. Atur koneksi database di `config.php` (host, user, password, nama database) sesuai konfigurasi XAMPP Anda.
5. Letakkan folder `php-version/` di dalam `htdocs` XAMPP (misal `C:\xampp\htdocs\php-version\`).
6. Buka browser: `http://localhost/php-version/`

## Akun Admin Default

- **Username:** `admin`
- **Password:** `admin123`

## Fitur

- Login admin dengan session
- Dashboard: total kamar, total penghuni, total pemasukan bulan ini, token listrik terjual
- Manajemen Kamar: tambah, edit, hapus, status kosong/isi
- Manajemen Penghuni: data penghuni dan kamar yang ditempati
- Pembayaran Kos: catat pembayaran bulanan, status lunas/belum, tanggal bayar
- Token Listrik: catat pembelian token, jumlah kWh, harga, untuk penghuni mana

## Teknologi

- PHP Native (tanpa framework)
- MySQL (mysqli)
- Bootstrap 5.3 (CDN)
- Responsive & desain premium warna biru
