# Sky Striker untuk HP

Versi web (PWA) dari notebook pygame **Sky Striker**. Bisa dimainkan di Chrome (Android), Safari (iPhone), dan browser laptop. Setelah dibuka sekali, game tetap bisa dimainkan tanpa internet.

Isi game sama dengan notebook: angka parameter, 20 level, 4 boss beserta pola serangannya, 5 pesawat di Hangar, item, dan 4 ability. Logikanya di-port 1:1 ke JavaScript dengan nama fungsi yang sama (`update_player`, `check_collisions`, dan seterusnya), lalu diuji frame demi frame terhadap kode Python asli.

## Terbitkan gratis (GitHub Pages)

1. Buat repositori baru di GitHub dengan visibilitas **Public**.
2. Pilih **Add file → Upload files**, seret seluruh ISI folder ini (bukan foldernya), lalu klik **Commit changes**.
3. Buka **Settings → Pages**, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
4. Setelah 1–10 menit, buka `https://USERNAME.github.io/NAMA-REPO/` di HP.

## Kontrol

| | HP | Laptop |
| --- | --- | --- |
| Terbang | Geser jari di mana saja | WASD / panah |
| Tembak | Otomatis (bisa dimatikan di Pengaturan) | Tahan SPACE |
| Ability | 4 tombol bulat | Q, E, R, F |
| Jeda | Tombol ⏸ | P / ESC |

## Isi folder

| Berkas | Isi |
| --- | --- |
| `js/params.js` | Semua parameter game (ubah di sini) |
| `js/logic.js` | Logika game, port dari notebook |
| `js/render.js` | Menggambar pesawat, musuh, boss, peluru |
| `js/ui.js` | HUD, menu, hangar, layar jeda/menang |
| `js/main.js` | Game loop, kontrol sentuh, tata letak, simpan progres |
| `js/rng.js` | Angka acak (bisa diberi benih untuk pengujian) |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA: bisa dipasang dan dimainkan offline |
| `tests/` | Uji unit dan uji paritas dengan notebook |

## Uji di laptop

```bash
python -m http.server 8000      # lalu buka http://localhost:8000
node tests/logic.test.mjs       # uji unit
python tests/parity/run_parity.py --notebook sky_striker.ipynb   # bandingkan dengan notebook
```

Progres (koin, pesawat, level terakhir) tersimpan di browser HP masing-masing. Menghapus data situs di browser akan menghapus progres.
