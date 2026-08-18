/* ════════════════════════════════════════════════════════════
   FAT — api.js
   Konfigurasi, sesi, komunikasi server, dan utilitas tampilan.
   Dipakai bersama oleh app.js dan cetak.js.

   Berkas ini harus dimuat lebih dulu daripada keduanya.
   ════════════════════════════════════════════════════════════ */

var KONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzUYDOarNmgkmcKlbMui7wC4ur-8yy5KGA4KX0sHVddaR6m2rAgBm-1QJqqVs6QFNWPZA/exec',
  CLIENT_ID: '365991274172-stp5fpm837khrlkn4fqjurrmk7pciom8.apps.googleusercontent.com',
  MENIT_MENGANGGUR: 30,

  /**
   * Penanda versi berkas ini. Naikkan bersama angka ?v= di index.html
   * setiap kali app.js diubah. Nilainya tampil di layar Profil, sehingga
   * bisa dipastikan browser memuat versi terbaru dan bukan salinan cache.
   */
  BUILD: '2026-08-17.8'
};

var S = { boot: null, tab: 'home', layar: 'home', p: {}, stack: [], form: {},
          sibuk: false, token: null, masuk: false };

var IDLE = { timer: null, terakhir: Date.now() };

/* ── Penyimpanan token ───────────────────────────────────── */

/**
 * Token disimpan di sessionStorage, bukan localStorage.
 *
 * sessionStorage hidup selama tab terbuka dan hilang saat tab ditutup.
 * Itu titik tengah yang masuk akal: memuat ulang halaman tidak memaksa
 * login lagi, tetapi menutup tab benar-benar mengakhiri sesi. localStorage
 * akan membuat token bertahan berhari-hari di perangkat bersama.
 *
 * ID token Google berlaku satu jam. Setelah itu server menolaknya dan
 * aplikasi meminta masuk lagi.
 */
var KUNCI_TOKEN = 'fat_token';

function simpanToken_(token) {
  S.token = token;
  try { sessionStorage.setItem(KUNCI_TOKEN, token); } catch (e) { /* mode privat */ }
}

function hapusToken_() {
  S.token = null;
  try { sessionStorage.removeItem(KUNCI_TOKEN); } catch (e) { }
}

/** Membaca bagian exp dari JWT tanpa memvalidasi tanda tangannya. */
function kedaluwarsaToken_(token) {
  try {
    var isi = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return Number(JSON.parse(atob(isi)).exp) * 1000;
  } catch (e) {
    return 0;
  }
}

/**
 * Mengambil token tersimpan bila masih cukup lama berlaku.
 * Sisa di bawah satu menit dianggap habis, agar permintaan tidak
 * ditolak di tengah jalan.
 */
function tokenTersimpan_() {
  var t;
  try { t = sessionStorage.getItem(KUNCI_TOKEN); } catch (e) { return null; }
  if (!t) return null;
  if (kedaluwarsaToken_(t) < Date.now() + 60000) {
    hapusToken_();
    return null;
  }
  return t;
}

/* ── Komunikasi dengan server ────────────────────────────── */

/**
 * Memanggil satu aksi di Apps Script.
 *
 * Content-Type sengaja text/plain. Header yang lebih spesifik memicu
 * permintaan preflight, dan Apps Script tidak bisa menjawabnya —
 * seluruh data karena itu dikirim di dalam badan permintaan.
 */
function api(aksi, payload) {
  if (!KONFIG.API_URL || KONFIG.API_URL.indexOf('GANTI') === 0) {
    return Promise.reject({ kode: 'API_BELUM_DIATUR' });
  }
  return fetch(KONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ aksi: aksi, id_token: S.token, payload: payload || {} })
  })
    .then(function (r) {
      if (!r.ok) throw { kode: 'GAGAL_TERHUBUNG', asli: 'HTTP ' + r.status };
      return r.json();
    })
    .then(function (j) {
      if (j && j.ok) return j.data;
      var e = (j && j.error) || { kode: 'BALASAN_KOSONG', fungsi: aksi };
      if (['TOKEN_KEDALUWARSA', 'TOKEN_TIDAK_ADA', 'TOKEN_TIDAK_SAH'].indexOf(e.kode) > -1) {
        keluar(true);
      }
      throw e;
    })
    .catch(function (e) {
      if (e && e.kode) throw e;
      throw { kode: 'GAGAL_TERHUBUNG', fungsi: aksi, asli: String(e && e.message ? e.message : e) };
    });
}

var PESAN = {
  BELUM_DISETUP: 'Sistem belum disiapkan. Hubungi administrator.',
  SESI_HABIS: 'Sesi berakhir. Muat ulang halaman untuk masuk lagi.',
  IDENTITAS_TIDAK_TERBACA: 'Google tidak memberi tahu aplikasi siapa Anda. ' +
    'Deployment perlu diubah menjadi "Jalankan sebagai: pengguna yang mengakses". ' +
    'Hubungi administrator.',
  PENGGUNA_TIDAK_TERDAFTAR: 'Email Anda belum terdaftar. Minta administrator menambahkannya.',
  PENGGUNA_NONAKTIF: 'Akun Anda dinonaktifkan.',
  TANPA_ROLE: 'Akun Anda belum diberi peran apa pun.',
  TIDAK_BERHAK: 'Anda tidak punya hak untuk tindakan ini.',
  MELEBIHI_BATAS_WEWENANG: 'Nominal melebihi batas wewenang Anda.',
  BUKAN_APPROVER_ANDA: 'Dokumen ini bukan giliran Anda.',
  TIDAK_BOLEH_SETUJUI_SENDIRI: 'Anda tidak bisa menyetujui dokumen yang Anda ajukan sendiri.',
  SUDAH_ANDA_PROSES: 'Anda sudah memberi keputusan pada tahap ini.',
  CATATAN_WAJIB: 'Catatan wajib diisi saat menolak atau meminta revisi.',
  DOKUMEN_TIDAK_DITEMUKAN: 'Dokumen tidak ditemukan.',
  DOKUMEN_SUDAH_SELESAI: 'Dokumen sudah selesai diproses.',
  BUKAN_DOKUMEN_ANDA: 'Ini bukan dokumen Anda.',
  HANYA_DRAFT_BISA_DIUBAH: 'Hanya draft yang bisa diubah.',
  SUDAH_TERKIRIM: 'Dokumen sudah terkirim sebelumnya.',
  ITEM_KOSONG: 'Tambahkan minimal satu item.',
  PAGU_NOL: 'Total pagu masih nol.',
  JUDUL_WAJIB: 'Judul RAB wajib diisi.',
  PERIODE_WAJIB: 'Periode anggaran wajib dipilih.',
  MASA_BERLAKU_WAJIB: 'Masa berlaku wajib diisi.',
  MASA_BERLAKU_TERBALIK: 'Tanggal akhir harus setelah tanggal mulai.',
  TIPE_RAB_TIDAK_VALID: 'Jenis RAB tidak dikenali.',
  DIVISI_TIDAK_VALID: 'Divisi tidak dikenali.',
  FLOW_TIDAK_ADA: 'Jalur persetujuan belum diatur. Hubungi administrator.',
  LOCK_TIMEOUT: 'Sistem sedang sibuk. Coba lagi beberapa detik.',
  BALASAN_KOSONG: 'Server tidak mengembalikan data.',
  AKSES_BERKAS_DITOLAK: 'Anda belum diberi akses ke salah satu berkas data.',
  JENIS_BERKAS_TIDAK_DIIZINKAN: 'Jenis berkas ini tidak diterima. ' +
    'Gunakan PDF, foto, atau dokumen Word dan Excel.',
  LAMPIRAN_TERLALU_BESAR: 'Berkas terlalu besar. Perkecil dulu atau bagi menjadi beberapa berkas.',
  BERKAS_RUSAK: 'Berkas gagal dibaca. Coba unggah ulang.',
  BERKAS_KOSONG: 'Tidak ada berkas yang terkirim.',
  SHEET_TIDAK_ADA: 'Struktur data tidak lengkap. Hubungi administrator.',
  GAGAL_TERHUBUNG: 'Gagal terhubung ke server. Periksa koneksi Anda.',
  KESALAHAN_SISTEM: 'Terjadi kesalahan sistem. Sudah dicatat untuk diperiksa.'
};

function inisial(nama) {
  var bagian = String(nama || '?').trim().split(/\s+/);
  return (bagian[0][0] + (bagian[1] ? bagian[1][0] : '')).toUpperCase();
}

function kartuGalat(e) {
  var rinci = [];
  if (e.kode) rinci.push('Kode: ' + esc(e.kode));
  if (e.fungsi) rinci.push('Fungsi: ' + esc(e.fungsi));
  if (e.asli) rinci.push('Pesan server: ' + esc(e.asli));
  if (e.mentah) rinci.push('Balasan: ' + esc(e.mentah));
  if (e.kode === 'AKSES_BERKAS_DITOLAK' && e.detail && e.detail.file) {
    rinci.push('Berkas: ' + esc(e.detail.file));
  }
  if (e.kode === 'GAGAL_TERHUBUNG' && /is not defined|not a function/i.test(e.asli || '')) {
    rinci.push('Library FAT tidak dikenali. Blok "dependencies" di appsscript.json ' +
      'kemungkinan terhapus. Pasang ulang library lewat menu Libraries.');
  }
  if (e.kode === 'BALASAN_KOSONG') {
    rinci.push('Buka FAT_CORE, pilih berkas 06_Api.gs, jalankan fungsi ' +
      esc(e.fungsi ? 'api' + e.fungsi.charAt(0).toUpperCase() + e.fungsi.slice(1) : 'terkait') +
      ', lalu lihat Execution log untuk penyebabnya.');
  }
  return '<div class="galat"><div class="kepala">' + esc(pesanError(e)) + '</div>' +
    (rinci.length ? '<div class="isi mono">' + rinci.join('<br>') + '</div>' : '') + '</div>' +
    '<div class="btnrow" style="margin-top:0"><button class="btn ghost" onclick="periksaAkses()">' +
    'Periksa akses berkas</button></div><div id="hasilAkses"></div>';
}

/**
 * Menampilkan hak baca dan tulis pengguna pada ketiga berkas data.
 * Ini yang membedakan "belum dibagikan" dari kesalahan kode.
 */
function periksaAkses() {
  var box = document.getElementById('hasilAkses');
  if (!box) return;
  box.innerHTML = '<div class="card"><div class="sm">Memeriksa…</div></div>';

  api('cekAkses').then(function (d) {
    var baris = d.berkas.map(function (b) {
      var beres = b.hak_dibutuhkan === 'Pelihat' ? b.baca : (b.baca && b.tulis);
      var punya = !b.baca ? 'tidak ada akses' : b.tulis ? 'Editor' : 'Pelihat';
      return '<div class="rowb" style="padding:7px 0">' +
        '<div style="min-width:0"><div style="font-weight:600;font-size:12.5px">' +
        esc(b.nama || b.berkas) + '</div>' +
        '<div class="xs">butuh ' + esc(b.hak_dibutuhkan) + ' &middot; punya ' + esc(punya) +
        (b.catatan ? ' &middot; ' + esc(b.catatan) : '') + '</div>' +
        (b.pesan_asli ? '<div class="xs mono" style="margin-top:3px;opacity:.7">' +
          esc(b.pesan_asli) + '</div>' : '') + '</div>' +
        '<span class="pill ' + (beres ? 'p-ok' : 'p-no') + '">' +
        (beres ? 'siap' : 'kurang') + '</span></div>';
    }).join('<div class="hr"></div>');

    var kurang = d.berkas.filter(function (b) {
      return b.hak_dibutuhkan === 'Pelihat' ? !b.baca : !(b.baca && b.tulis);
    });

    box.innerHTML = '<div class="card"><div class="xs" style="margin-bottom:6px">Masuk sebagai ' +
      esc(d.email) + '</div>' + baris + '</div>' +
      (kurang.length
        ? (kurang.length === 3 && !d.berkas.some(function (b) { return b.baca; })
            ? '<div class="alert a-bad">Ketiga berkas ditolak sekaligus. Ini biasanya bukan ' +
              'soal berbagi berkas, melainkan izin OAuth yang belum diminta saat Anda memberi ' +
              'otorisasi. Administrator perlu memasang ulang aplikasi lalu Anda memberi ' +
              'otorisasi sekali lagi.</div>'
            : '<div class="alert a-bad">Minta administrator membagikan ' +
              kurang.map(function (b) { return esc(b.nama || b.berkas); }).join(' dan ') +
              ' ke email Anda dengan hak yang tertera.</div>')
        : '<div class="alert a-info">Seluruh akses berkas sudah benar. ' +
          'Penyebabnya bukan izin berkas.</div>');
  }).catch(function (e) {
    box.innerHTML = '<div class="alert a-bad">Pemeriksaan gagal: ' + esc(pesanError(e)) + '</div>';
  });
}

function pesanError(e) {
  if (!e) return 'Terjadi kesalahan.';
  return PESAN[e.kode] || e.pesan || ('Kesalahan: ' + e.kode);
}

/* ── Utilitas tampilan ───────────────────────────────────── */

function rp(n) { return 'Rp' + (Number(n) || 0).toLocaleString('id-ID'); }
function rpk(n) {
  n = Number(n) || 0;
  return n >= 1e6 ? 'Rp' + (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'jt' : rp(n);
}
function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function tgl(iso) {
  if (!iso) return '—';
  var b = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var d = String(iso).slice(0, 10).split('-');
  if (d.length < 3) return iso;
  return Number(d[2]) + ' ' + b[Number(d[1]) - 1] + ' ' + d[0];
}
function waktu(iso) {
  if (!iso) return '';
  return tgl(iso) + ' ' + String(iso).slice(11, 16);
}
function toast(teks, jenis) {
  var t = document.createElement('div');
  t.className = 'toast' + (jenis ? ' ' + jenis : '');
  t.textContent = teks;
  document.getElementById('toast').appendChild(t);
  setTimeout(function () { t.remove(); }, 3200);
}
