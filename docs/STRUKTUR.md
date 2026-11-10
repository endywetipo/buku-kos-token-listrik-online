# Struktur folder

```text
buku-kos-token-listrik-online/
├── src/
│   ├── index.html                 # aplikasi utama (auth, onboarding, dashboard, form, pengaturan)
│   ├── pro.css                    # gaya tambahan fitur PRO
│   └── public/
│       ├── pro-upgrade.js         # tabel riwayat, grafik, bukti transfer, export Excel/PDF
│       └── vendor/                # Chart.js, jsPDF, fflate
├── supabase/
│   ├── setup.sql                  # skema lengkap untuk instalasi baru (gabungan migrasi)
│   └── migrations/                # perubahan bertahap untuk database yang sudah berjalan
├── php-version/                   # versi alternatif PHP Native + MySQL
├── docs/
│   └── STRUKTUR.md
├── package.json
├── vite.config.js
└── vercel.json
```

## Tabel utama

| Tabel | Isi |
|---|---|
| `kos` | Satu baris per kos: pemilik, kode undangan, jumlah pintu, harga, mode token, rekening |
| `profiles` | Peran pengguna (`owner`/`tenant`), kos yang diikuti, nomor pintu |
| `kos_entries` | Pembayaran kos per pintu per periode |
| `token_entries` | Pengisian token listrik (mode `bersama`) |
| `tagihan_token` | Tagihan token per penyewa hasil pembagian pembelian token |
| `admin_emails` | Admin aplikasi |
