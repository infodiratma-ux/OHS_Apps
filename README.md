# Aplikasi Notifikasi Awal Insiden — PT Maruwai Coal (Alamtri)

Aplikasi web satu file (HTML) untuk notifikasi awal insiden, form F-MAC-IMS-14-001 Rev 4.0.
Berjalan offline (localStorage). Mendukung export PDF/PPT/Excel dan dashboard.

## Isi repository
- `index.html` — aplikasi utama
- `vercel.json` — konfigurasi hosting Vercel (clean URLs + security headers)
- `package.json` — penanda project (tanpa build step)
- `.gitignore`
- `README.md` — panduan ini

## Akun superuser awal
- christina.widyaningtyas@alamtri.com — password: admin123
- dwi.pranoto@alamtri.com — password: admin123

> Setelah login, buat akun lain (User Departemen, CRS, PJA) lewat menu
> Setting → Manajemen User, dan ganti password default demi keamanan.

## Cara publish ke GitHub + Vercel

### 1) Unggah ke GitHub
1. Buat repository baru di GitHub (mis. `notifikasi-insiden`).
2. Klik **Add file → Upload files**, seret semua file di folder ini
   (`index.html`, `vercel.json`, `package.json`, `.gitignore`, `README.md`).
3. Klik **Commit changes**. Pastikan file muncul di repo dan ada branch `main`.

### 2) Deploy ke Vercel
1. Buka https://vercel.com, login **Continue with GitHub**.
2. **Add New… → Project → Import** repository ini.
3. Konfigurasi:
   - Framework Preset: **Other**
   - Build Command: **(kosongkan)**
   - Output Directory: **(kosongkan)**
   - Install Command: **(kosongkan)**
4. Klik **Deploy**. Selesai — dapat URL `https://namaproject.vercel.app`.

Setiap kali Anda push perubahan ke GitHub, Vercel otomatis re-deploy.

## Catatan
- Export PDF/PPT/Excel & grafik memuat library dari CDN (jsDelivr), jadi
  perlu koneksi internet saat halaman dibuka.
- Data disimpan di localStorage per-browser (belum tersinkron antar-perangkat).
  Gunakan menu Setting → Backup/Restore (JSON) untuk memindahkan data,
  atau lanjutkan ke integrasi Google Sheet / database bila diperlukan.
