/* ════════════════════════════════════════════════════════════
   FAT — app.js
   PT Sahada Laku Utama

   Halaman ini statis dan dilayani GitHub Pages. Seluruh data berasal
   dari Apps Script lewat satu endpoint POST, dan setiap permintaan
   membawa ID token Google sebagai bukti identitas.

   ISI DUA NILAI DI BAWAH SEBELUM DIUNGGAH.
   ════════════════════════════════════════════════════════════ */

var KONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzUYDOarNmgkmcKlbMui7wC4ur-8yy5KGA4KX0sHVddaR6m2rAgBm-1QJqqVs6QFNWPZA/exec',
  CLIENT_ID: '365991274172-stp5fpm837khrlkn4fqjurrmk7pciom8.apps.googleusercontent.com',
  MENIT_MENGANGGUR: 30
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
 
function pilKe(status, menunggu) {
  var peta = {
    DRAFT: ['p-draft', 'Draft'], REVISI: ['p-no', 'Perlu revisi'], REJECTED: ['p-no', 'Ditolak'],
    SUBMITTED: ['p-wait', 'Menunggu ' + (menunggu || '')],
    APPROVED_LV1: ['p-wait', 'Menunggu ' + (menunggu || '')],
    VERIFIED_FINANCE: ['p-wait', 'Menunggu ' + (menunggu || '')],
    APPROVED_FAT: ['p-wait', 'Menunggu ' + (menunggu || '')],
    PENDING_CEO: ['p-wait', 'Menunggu CEO'],
    AKTIF: ['p-ok', 'Aktif'], MENUNGGU_TAGIHAN: ['p-wait', 'Menunggu tagihan'],
    CLOSED: ['p-draft', 'Ditutup']
  };
  var m = peta[status] || ['p-draft', status];
  return '<span class="pill ' + m[0] + '">' + esc(m[1]) + '</span>';
}
 
function rail(jejak) {
  return '<ol class="rail">' + jejak.map(function (x, i) {
    var tanda = x.status === 'done' ? '&#10003;' : x.status === 'no' ? '!' : (i + 1);
    var siapa = x.aktor
      ? esc(x.aktor) + (x.atas_nama ? ' a.n. ' + esc(x.atas_nama) : '') +
        (x.waktu ? ' &middot; ' + waktu(x.waktu) : '')
      : (x.status === 'now' ? 'Menunggu keputusan' : '');
    return '<li class="' + x.status + '"><span class="st">' + tanda + '</span>' +
      '<div style="flex:1;min-width:0"><b>' + esc(x.role) + '</b>' +
      (siapa ? '<span class="who">' + siapa + '</span>' : '') +
      (x.catatan ? '<div class="note">' + esc(x.catatan) + '</div>' : '') +
      '</div></li>';
  }).join('') + '</ol>';
}
 
function meter(pagu, terpakai, diproses) {
  var p = Number(pagu) || 1;
  return '<div class="meter"><i class="used" style="width:' +
    Math.min(100, Math.round(terpakai / p * 100)) + '%"></i><i class="cmt" style="width:' +
    Math.min(100, Math.round((diproses || 0) / p * 100)) + '%"></i></div>';
}
 
/* ── Navigasi ────────────────────────────────────────────── */
 
var JUDUL = {
  home: ['Beranda', ''], rab: ['RAB saya', ''], rabdet: ['Detail RAB', ''],
  rabnew: ['Buat RAB', ''], inbox: ['Perlu persetujuan', ''], inboxdet: ['Tinjau dokumen', ''],
  profil: ['Profil', ''], selesai: ['', '']
};
 
function buka(layar, p, dorong) {
  if (dorong !== false && S.layar !== layar) S.stack.push({ l: S.layar, p: S.p });
  S.layar = layar; S.p = p || {};
  gambar();
}
function kembali() {
  var b = S.stack.pop();
  if (b) { S.layar = b.l; S.p = b.p; gambar(); }
}
function keTab(t) {
  S.tab = t; S.stack = []; S.form = {};
  buka(t, {}, false);
}
 
function bolehApprove() {
  var r = S.boot.pengguna.roles;
  return ['MANAGER_DIVISI', 'HC', 'FINANCE', 'FAT_MANAGER', 'CEO'].some(function (x) {
    return r.indexOf(x) > -1;
  });
}
 
function gambarTab() {
  var el = document.getElementById('tabs');
  var daftar = [['home', '&#8962;', 'Beranda'], ['rab', '&#9636;', 'RAB']];
  if (bolehApprove()) daftar.push(['inbox', '&#10003;', 'Setujui']);
 
  el.hidden = false;
  el.style.gridTemplateColumns = 'repeat(' + daftar.length + ',1fr)';
  el.innerHTML = daftar.map(function (d) {
    var lencana = (d[0] === 'inbox' && S.jmlInbox)
      ? '<span class="badge">' + S.jmlInbox + '</span>' : '';
    return '<button class="' + (S.tab === d[0] ? 'on' : '') + '" onclick="keTab(\'' + d[0] + '\')">' +
      lencana + '<span class="ic">' + d[1] + '</span>' + d[2] + '</button>';
  }).join('');
}
 
function gambar() {
  if (!S.masuk) return;
  var j = JUDUL[S.layar] || ['', ''];
  document.getElementById('ttl').textContent = j[0];
  if (S.boot) {
    var u = S.boot.pengguna;
    var ket = namaDivisi(u.divisi_id);
    if (u.jabatan && u.jabatan !== u.nama) ket = u.jabatan + ' \u00b7 ' + ket;
    document.getElementById('sub').innerHTML = j[1] || esc(ket);
    var av = document.getElementById('btnProfil');
    av.hidden = false;
    av.textContent = inisial(u.nama);
  } else {
    document.getElementById('sub').innerHTML = j[1] || '&nbsp;';
  }
  document.getElementById('back').hidden = !S.stack.length;
  window.scrollTo(0, 0);
 
  var view = document.getElementById('view');
  view.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  gambarTab();
 
  var fn = LAYAR[S.layar];
  if (!fn) { view.innerHTML = '<div class="empty">Layar tidak dikenal.</div>'; return; }
 
  Promise.resolve(fn()).then(function (html) {
    view.innerHTML = html;
  }).catch(function (e) {
    view.innerHTML = kartuGalat(e) +
      '<button class="btn ghost" onclick="gambar()">Coba lagi</button>';
  });
}
 
/* ── Layar ───────────────────────────────────────────────── */
 
var LAYAR = {
 
  home: function () {
    return api('listRab', {}).then(function (daftar) {
      var aktif = daftar.filter(function (r) { return r.status === 'AKTIF'; });
      var proses = daftar.filter(function (r) {
        return ['DRAFT', 'REVISI', 'SUBMITTED', 'APPROVED_LV1',
          'VERIFIED_FINANCE', 'APPROVED_FAT', 'PENDING_CEO'].indexOf(r.status) > -1;
      });
 
      var h = '';
      if (S.jmlInbox) {
        h += '<div class="card tap" onclick="keTab(\'inbox\')" ' +
          'style="border-color:var(--amber);background:var(--amber-50)">' +
          '<div class="rowb"><div><div class="ttl">' + S.jmlInbox +
          ' dokumen menunggu Anda</div>' +
          '<div class="sm" style="margin-top:3px">Ketuk untuk meninjau</div></div>' +
          '<span style="font-size:20px;color:var(--amber)">&rsaquo;</span></div></div>';
      }
 
      h += '<div class="sec">Aksi cepat</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        kartuAksi('&#65291;', 'Buat RAB', "mulaiRabBaru()") +
        kartuAksi('&#9636;', 'RAB saya', "keTab('rab')") +
        '</div>';
 
      h += '<div class="sec">Anggaran aktif</div>';
      h += aktif.length ? aktif.map(kartuRab).join('')
        : '<div class="card"><div class="sm">Belum ada RAB aktif. RAB yang sudah disetujui seluruh tahap akan muncul di sini.</div></div>';
 
      if (proses.length) {
        h += '<div class="sec">Sedang diproses</div>' + proses.map(kartuRab).join('');
      }
      return h;
    });
  },
 
  rab: function () {
    var f = S.p.f || 'semua';
    return api('listRab', {}).then(function (daftar) {
      var saring = {
        semua: function () { return true; },
        aktif: function (r) { return r.status === 'AKTIF'; },
        proses: function (r) {
          return ['SUBMITTED', 'APPROVED_LV1', 'VERIFIED_FINANCE',
            'APPROVED_FAT', 'PENDING_CEO'].indexOf(r.status) > -1;
        },
        draft: function (r) { return ['DRAFT', 'REVISI'].indexOf(r.status) > -1; }
      };
      var list = daftar.filter(saring[f]);
 
      var h = '<div class="chips">' +
        [['semua', 'Semua'], ['aktif', 'Aktif'], ['proses', 'Diproses'], ['draft', 'Draft']]
          .map(function (c) {
            return '<button class="chip ' + (f === c[0] ? 'on' : '') +
              '" onclick="S.p={f:\'' + c[0] + '\'};gambar()">' + c[1] + '</button>';
          }).join('') + '</div>';
 
      h += list.length ? list.map(kartuRab).join('')
        : '<div class="empty"><div class="big">&#9636;</div>Tidak ada RAB di filter ini.</div>';
      h += '<button class="btn" onclick="mulaiRabBaru()" style="margin-top:6px">Buat RAB baru</button>';
      return h;
    });
  },
 
  rabdet: function () {
    return api('getRab', { rab_id: S.p.id }).then(function (d) {
      var r = d.header, k = d.rekap;
      var h = '<div class="card"><div class="rowb"><div style="min-width:0">' +
        '<span class="pill p-info">' + esc(r.tipe) + '</span>' +
        '<div class="ttl" style="margin-top:7px;font-size:16px">' + esc(r.judul) + '</div>' +
        '<div class="id mono" style="margin-top:4px">' + esc(r.no_rab || 'Nomor terbit saat dikirim') + '</div>' +
        '</div>' + pilKe(r.status, r.current_role) + '</div>' +
        '<div class="hr"></div>' +
        kv('Periode anggaran', esc(r.periode)) +
        kv('Masa berlaku', tgl(r.valid_dari) + ' – ' + tgl(r.valid_sampai)) +
        kv('Divisi', esc(namaDivisi(r.divisi_id))) +
        kv('Total pagu efektif', '<span class="amt">' + rp(k.pagu) + '</span>') +
        (k.penyesuaian ? kv('Penyesuaian', '<span class="amt">' + rp(k.penyesuaian) + '</span>') : '') +
        (r.status === 'AKTIF' ? kv('Terserap',
          '<span class="amt">' + rp(k.realisasi) + ' (' +
          Math.round(k.realisasi / (k.pagu || 1) * 100) + '%)</span>') : '') +
        '</div>';
 
      h += '<div class="sec">Rincian item</div>';
      h += d.items.map(function (i) {
        return '<div class="card"><div class="rowb"><div style="min-width:0">' +
          '<div class="ttl">' + esc(i.deskripsi) + '</div>' +
          '<div class="id mono" style="margin-top:3px">' + esc(i.item_id) + '</div>' +
          '<div class="xs" style="margin-top:3px">' + esc(namaKategori(i.kategori_id)) +
          ' &middot; ' + i.qty + ' ' + esc(i.satuan) + ' &times; ' + rp(i.harga_satuan) +
          ' &middot; berlaku sampai ' + tgl(i.valid_sampai) + '</div>' +
          '</div><span class="amt" style="font-size:13px">' + rp(i.pagu_efektif) + '</span></div>' +
          (i.penyesuaian ? '<div class="xs" style="margin-top:6px;color:' +
            (i.penyesuaian > 0 ? 'var(--green)' : 'var(--amber)') + '">' +
            (i.penyesuaian > 0 ? '&#9650;' : '&#9660;') + ' Penyesuaian ' +
            rp(Math.abs(i.penyesuaian)) + ' &middot; pagu awal ' + rp(i.pagu_awal) + '</div>' : '') +
          (r.status === 'AKTIF'
            ? meter(i.pagu_efektif, i.realisasi, i.committed) +
              '<div class="legend">' +
              '<span><i class="dotc" style="background:var(--brand)"></i>Terpakai ' + rpk(i.realisasi) + '</span>' +
              (i.committed ? '<span><i class="dotc" style="background:var(--amber)"></i>Diproses ' + rpk(i.committed) + '</span>' : '') +
              '<span><i class="dotc" style="background:#EDF0F4;border:1px solid var(--line)"></i>Sisa ' + rpk(i.sisa) + '</span>' +
              '</div>'
            : '') +
          '</div>';
      }).join('');
 
      if (d.jejak && d.jejak.length) {
        h += '<div class="sec">Jejak persetujuan</div><div class="card">' + rail(d.jejak) + '</div>';
      }
 
      if (['DRAFT', 'REVISI'].indexOf(r.status) > -1) {
        h += '<button class="btn" onclick="kirimRab(\'' + r.rab_id + '\')">Kirim untuk persetujuan</button>' +
          '<div class="btnrow"><button class="btn ghost" onclick="ubahDraft(\'' + r.rab_id + '\')">Ubah item</button></div>';
      } else if (r.status === 'AKTIF') {
        h += '<button class="btn ghost" onclick="duplikat(\'' + r.rab_id + '\')">Duplikat jadi draft baru</button>';
      } else if (['SUBMITTED', 'APPROVED_LV1', 'VERIFIED_FINANCE', 'APPROVED_FAT'].indexOf(r.status) > -1) {
        h += '<div class="alert a-info">Menunggu persetujuan ' + esc(r.current_role) +
          '. Item belum bisa dipakai untuk pengajuan dana.</div>';
      }
      return h;
    });
  },
 
  rabnew: function () {
    var f = S.form;
    var langkah = S.p.step || 1;
    var h = '<div class="steps"><i class="' + (langkah >= 1 ? 'on' : '') + '"></i>' +
      '<i class="' + (langkah >= 2 ? 'on' : '') + '"></i>' +
      '<i class="' + (langkah >= 3 ? 'on' : '') + '"></i></div>';
 
    if (langkah === 1) {
      h += '<div class="field"><label>Jenis RAB</label><select id="fTipe" onchange="S.form.tipe=this.value;gambar()">' +
        opsi([['BULANAN', 'Bulanan — ATK, P3K, Operasional'],
              ['IKLAN', 'Iklan — Meta, Google, TikTok, Snack Video, Marketplace, CRM']], f.tipe) +
        '</select></div>';
 
      h += '<div class="field"><label>Divisi</label><select id="fDivisi">' +
        S.boot.master.divisi.map(function (d) {
          return '<option value="' + d.divisi_id + '"' +
            (f.divisi_id === d.divisi_id ? ' selected' : '') + '>' + esc(d.nama) + '</option>';
        }).join('') + '</select></div>';
 
      h += '<div class="field"><label>Periode anggaran</label>' +
        '<input type="month" id="fPeriode" value="' + esc(f.periode || bulanDepan()) + '"></div>';
 
      h += '<div class="field"><label>Judul RAB</label>' +
        '<input id="fJudul" value="' + esc(f.judul || '') + '" placeholder="Contoh: Operasional & ATK September"></div>';
 
      h += '<div class="field"><label>Masa berlaku pengajuan ' +
        '<span class="hint">— di luar rentang ini item tidak bisa dipakai</span></label>' +
        '<div style="display:flex;gap:8px">' +
        '<input type="date" id="fDari" value="' + esc(f.valid_dari || '') + '">' +
        '<input type="date" id="fSampai" value="' + esc(f.valid_sampai || '') + '"></div></div>';
 
      h += '<div class="alert a-warn">Persetujuan ' +
        ((f.tipe || 'BULANAN') === 'BULANAN'
          ? 'HC &rarr; Finance &rarr; FAT Manager'
          : 'Manager Divisi &rarr; Finance &rarr; FAT Manager &rarr; CEO') + '.</div>';
      h += '<button class="btn" onclick="simpanLangkah1()">Lanjut isi item</button>';
 
    } else if (langkah === 2) {
      var items = f.items || [];
      h += '<div class="sec">Item anggaran</div>';
      h += items.length ? items.map(kartuItemDraft).join('')
        : '<div class="card"><div class="sm">Belum ada item.</div></div>';
      h += '<div class="card tap" style="border-style:dashed;text-align:center;color:var(--brand);' +
        'font-weight:600;font-size:13px" onclick="tambahItem()">&#65291; Tambah item</div>';
      h += '<div class="card" style="background:var(--brand-50);border-color:var(--brand-50)">' +
        '<div class="rowb"><span style="font-weight:600;font-size:13px">Total pagu</span>' +
        '<span class="amt" style="font-size:16px">' + rp(totalDraft()) + '</span></div></div>';
      h += '<button class="btn" onclick="buka(\'rabnew\',{step:3})"' +
        (items.length ? '' : ' disabled') + '>Lanjut ke ringkasan</button>';
 
    } else {
      h += '<div class="card">' +
        '<div class="ttl" style="font-size:16px">' + esc(f.judul) + '</div>' +
        '<div class="id mono" style="margin-top:4px">Nomor RAB terbit setelah dikirim</div>' +
        '<div class="hr"></div>' +
        kv('Jenis', f.tipe === 'IKLAN' ? 'Iklan' : 'Bulanan') +
        kv('Divisi', esc(namaDivisi(f.divisi_id))) +
        kv('Periode', esc(f.periode)) +
        kv('Berlaku', tgl(f.valid_dari) + ' – ' + tgl(f.valid_sampai)) +
        kv('Jumlah item', (f.items || []).length + ' item') +
        kv('Total pagu', '<span class="amt">' + rp(totalDraft()) + '</span>') +
        '</div>';
      h += '<div class="alert a-info">Menyimpan draft belum menerbitkan nomor. ' +
        'Nomor RAB baru terbit saat dokumen dikirim untuk persetujuan.</div>';
      h += '<button class="btn" onclick="simpanDanKirim()">Simpan dan kirim</button>' +
        '<div class="btnrow"><button class="btn ghost" onclick="simpanSaja()">Simpan draft dulu</button></div>';
    }
    return h;
  },
 
  inbox: function () {
    return api('listInbox').then(function (daftar) {
      S.jmlInbox = daftar.length;
      gambarTab();
      if (!daftar.length) {
        return '<div class="empty"><div class="big">&#10003;</div>' +
          'Tidak ada dokumen yang menunggu persetujuan Anda.</div>';
      }
      return daftar.map(function (x) {
        return '<div class="card tap" onclick="buka(\'inboxdet\',{modul:\'' + x.modul +
          '\',id:\'' + x.id + '\'})">' +
          '<div class="rowb"><div style="min-width:0">' +
          '<span class="pill p-info">' + esc(x.modul) + '</span>' +
          '<div class="ttl" style="margin-top:7px">' + esc(x.judul) + '</div>' +
          '<div class="sm" style="margin-top:3px">' + esc(x.pemohon) + '</div>' +
          '<div class="id mono" style="margin-top:3px">' + esc(x.no || '') + '</div>' +
          (x.atas_nama ? '<div class="xs" style="margin-top:3px">Anda menyetujui a.n. ' +
            esc(x.atas_nama) + '</div>' : '') +
          '</div><div style="text-align:right;flex-shrink:0">' +
          '<div class="amt" style="font-size:13.5px">' + rpk(x.nominal) + '</div>' +
          '<div class="xs" style="margin-top:4px">' + tgl(x.menunggu_sejak) + '</div>' +
          '</div></div></div>';
      }).join('');
    });
  },
 
  inboxdet: function () {
    return api('getRab', { rab_id: S.p.id }).then(function (d) {
      var r = d.header, k = d.rekap;
      var h = '<div class="card">' +
        '<span class="pill p-info">' + esc(r.tipe) + '</span>' +
        '<div class="ttl" style="font-size:16px;margin-top:7px">' + esc(r.judul) + '</div>' +
        '<div class="id mono" style="margin-top:4px">' + esc(r.no_rab) + '</div>' +
        '<div class="hr"></div>' +
        kv('Pemohon', esc(r.pemohon_email)) +
        kv('Divisi', esc(namaDivisi(r.divisi_id))) +
        kv('Periode', esc(r.periode)) +
        kv('Masa berlaku', tgl(r.valid_dari) + ' – ' + tgl(r.valid_sampai)) +
        kv('Total pagu', '<span class="amt">' + rp(k.pagu) + '</span>') +
        kv('Jumlah item', k.jumlah_item + ' item') +
        '</div>';
 
      h += '<div class="sec">Rincian item</div><div class="card">' +
        d.items.map(function (i, n) {
          return (n ? '<div class="hr"></div>' : '') +
            '<div class="rowb"><div style="min-width:0">' +
            '<div style="font-weight:600;font-size:13px">' + esc(i.deskripsi) + '</div>' +
            '<div class="xs" style="margin-top:2px">' + esc(namaKategori(i.kategori_id)) +
            ' &middot; ' + i.qty + ' ' + esc(i.satuan) + ' &times; ' + rp(i.harga_satuan) + '</div>' +
            '</div><span class="amt" style="font-size:12.5px">' + rp(i.pagu_efektif) + '</span></div>';
        }).join('') + '</div>';
 
      h += '<div class="sec">Jejak persetujuan</div><div class="card">' + rail(d.jejak) + '</div>';
 
      h += '<div class="field"><label>Catatan ' +
        '<span class="hint">— wajib jika menolak atau meminta revisi</span></label>' +
        '<textarea id="fCatatan" rows="3" placeholder="Tulis catatan untuk pemohon"></textarea></div>';
 
      h += '<button class="btn ok" onclick="putuskan(\'APPROVE\')">Setujui</button>' +
        '<div class="btnrow">' +
        '<button class="btn ghost" onclick="putuskan(\'REVISI\')">Minta revisi</button>' +
        '<button class="btn no" onclick="putuskan(\'REJECT\')">Tolak</button></div>';
      return h;
    });
  },
 
  profil: function () { return isiProfil(); },
 
  selesai: function () {
    return '<div class="empty" style="padding-top:56px">' +
      '<div style="width:56px;height:56px;border-radius:50%;background:var(--green-50);' +
      'color:var(--green);display:grid;place-items:center;font-size:26px;margin:0 auto 18px">&#10003;</div>' +
      '<div style="font-size:17px;font-weight:600;color:var(--ink)">' + esc(S.p.msg) + '</div>' +
      '<div class="sm" style="margin-top:8px;max-width:290px;margin-inline:auto">' +
      esc(S.p.sub || '') + '</div></div>' +
      '<button class="btn" onclick="keTab(\'home\')">Kembali ke beranda</button>';
  }
};
 
/* ── Potongan tampilan ───────────────────────────────────── */
 
function kv(label, isi) {
  return '<div class="kv"><span>' + label + '</span><span>' + isi + '</span></div>';
}
function kartuAksi(ikon, teks, aksi) {
  return '<div class="card tap" style="margin:0;text-align:center;padding:16px 10px" onclick="' +
    aksi + '"><div style="font-size:20px;margin-bottom:6px">' + ikon + '</div>' +
    '<div style="font-size:12.5px;font-weight:600">' + teks + '</div></div>';
}
function kartuRab(r) {
  var pakai = r.pagu ? Math.round(r.realisasi / r.pagu * 100) : 0;
  return '<div class="card tap" onclick="buka(\'rabdet\',{id:\'' + r.rab_id + '\'})">' +
    '<div class="rowb"><div style="min-width:0">' +
    '<span class="pill p-info">' + esc(r.tipe) + '</span>' +
    '<div class="ttl" style="margin-top:7px">' + esc(r.judul) + '</div>' +
    '<div class="id mono" style="margin-top:3px">' + esc(r.no_rab || 'Belum bernomor') + '</div>' +
    '</div>' + pilKe(r.status, r.current_role) + '</div>' +
    '<div class="hr"></div>' +
    '<div class="rowb"><span class="sm">' + esc(r.periode) + ' &middot; ' + r.jumlah_item + ' item</span>' +
    '<span class="amt" style="font-size:13px">' + rpk(r.pagu) + '</span></div>' +
    (r.status === 'AKTIF'
      ? meter(r.pagu, r.realisasi, 0) +
        '<div class="rowb"><span class="xs">Terserap ' + pakai + '% &middot; sampai ' +
        tgl(r.valid_sampai) + '</span>' +
        '<span class="xs">' + rpk(r.sisa) + ' tersisa</span></div>'
      : '') + '</div>';
}
function kartuItemDraft(it, idx) {
  return '<div class="card"><div class="rowb"><div style="min-width:0">' +
    '<div class="ttl">' + esc(it.deskripsi) + '</div>' +
    '<div class="xs" style="margin-top:3px">' + esc(namaKategori(it.kategori_id)) +
    ' &middot; ' + it.qty + ' ' + esc(it.satuan) + ' &times; ' + rp(it.harga_satuan) + '</div>' +
    '</div><div style="text-align:right;flex-shrink:0">' +
    '<div class="amt" style="font-size:13px">' + rp(it.qty * it.harga_satuan) + '</div>' +
    '<button onclick="hapusItem(' + idx + ')" style="background:none;border:0;font-family:inherit;' +
    'font-size:11px;color:var(--muted);cursor:pointer;padding:6px 0 0">Hapus</button>' +
    '</div></div></div>';
}
function opsi(pasangan, terpilih) {
  return pasangan.map(function (p) {
    return '<option value="' + p[0] + '"' + (terpilih === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
  }).join('');
}
function namaDivisi(id) {
  var d = (S.boot.master.divisi || []).filter(function (x) { return x.divisi_id === id; })[0];
  return d ? d.nama : id;
}
function namaKategori(id) {
  var k = (S.boot.master.kategori || []).filter(function (x) { return x.kategori_id === id; })[0];
  return k ? k.nama : id;
}
function bulanDepan() {
  var d = new Date(); d.setMonth(d.getMonth() + 1);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}
function totalDraft() {
  return (S.form.items || []).reduce(function (a, i) {
    return a + (Number(i.qty) || 0) * (Number(i.harga_satuan) || 0);
  }, 0);
}
 
/* ── Tindakan ────────────────────────────────────────────── */
 
function mulaiRabBaru() {
  var awal = new Date(); awal.setMonth(awal.getMonth() + 1); awal.setDate(1);
  var akhir = new Date(awal.getFullYear(), awal.getMonth() + 1, 0);
  var iso = function (d) { return d.toISOString().slice(0, 10); };
  S.form = {
    tipe: 'BULANAN', divisi_id: S.boot.pengguna.divisi_id, periode: bulanDepan(),
    judul: '', valid_dari: iso(awal), valid_sampai: iso(akhir), items: []
  };
  S.stack = [];
  buka('rabnew', { step: 1 }, false);
}
 
function simpanLangkah1() {
  var f = S.form;
  f.tipe = document.getElementById('fTipe').value;
  f.divisi_id = document.getElementById('fDivisi').value;
  f.periode = document.getElementById('fPeriode').value;
  f.judul = document.getElementById('fJudul').value.trim();
  f.valid_dari = document.getElementById('fDari').value;
  f.valid_sampai = document.getElementById('fSampai').value;
 
  if (!f.judul) return toast('Judul RAB wajib diisi.', 'bad');
  if (!f.periode) return toast('Periode anggaran wajib dipilih.', 'bad');
  if (!f.valid_dari || !f.valid_sampai) return toast('Masa berlaku wajib diisi.', 'bad');
  if (f.valid_dari > f.valid_sampai) return toast('Tanggal akhir harus setelah tanggal mulai.', 'bad');
 
  buka('rabnew', { step: 2 });
}
 
function tambahItem() {
  var kat = S.boot.master.kategori.filter(function (k) { return k.tipe_rab === S.form.tipe; });
  if (!kat.length) return toast('Belum ada kategori untuk jenis RAB ini.', 'bad');
 
  var view = document.getElementById('view');
  var box = document.createElement('div');
  box.className = 'card';
  box.style.borderColor = 'var(--brand)';
  box.innerHTML =
    '<div class="sec" style="margin-top:0">Item baru</div>' +
    '<div class="field"><label>Kategori</label><select id="iKat">' +
    kat.map(function (k) { return '<option value="' + k.kategori_id + '">' + esc(k.nama) + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="field"><label>Deskripsi</label><input id="iDesk" placeholder="Contoh: Kertas A4 80gsm"></div>' +
    '<div style="display:flex;gap:8px">' +
    '<div class="field" style="flex:1"><label>Jumlah</label><input id="iQty" type="number" value="1" min="1"></div>' +
    '<div class="field" style="flex:1"><label>Satuan</label><input id="iSatuan" value="unit"></div>' +
    '</div>' +
    '<div class="field"><label>Harga satuan</label><input id="iHarga" class="mono" type="number" placeholder="0"></div>' +
    '<div class="btnrow"><button class="btn ghost" onclick="gambar()">Batal</button>' +
    '<button class="btn" onclick="simpanItem()">Tambahkan</button></div>';
  view.appendChild(box);
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
 
function simpanItem() {
  var desk = document.getElementById('iDesk').value.trim();
  var harga = Number(document.getElementById('iHarga').value) || 0;
  var qty = Number(document.getElementById('iQty').value) || 0;
  if (!desk) return toast('Deskripsi item wajib diisi.', 'bad');
  if (qty <= 0) return toast('Jumlah harus lebih dari nol.', 'bad');
  if (harga <= 0) return toast('Harga satuan harus lebih dari nol.', 'bad');
 
  S.form.items = S.form.items || [];
  S.form.items.push({
    kategori_id: document.getElementById('iKat').value,
    deskripsi: desk, qty: qty,
    satuan: document.getElementById('iSatuan').value.trim() || 'unit',
    harga_satuan: harga,
    coa_id: (S.boot.master.kategori.filter(function (k) {
      return k.kategori_id === document.getElementById('iKat').value;
    })[0] || {}).coa_default || '',
    pola_realisasi: 'LANGSUNG'
  });
  gambar();
}
 
function hapusItem(i) { S.form.items.splice(i, 1); gambar(); }
 
function payloadRab() {
  var f = S.form;
  return {
    rab_id: f.rab_id || null, tipe: f.tipe, divisi_id: f.divisi_id, periode: f.periode,
    judul: f.judul, valid_dari: f.valid_dari, valid_sampai: f.valid_sampai, items: f.items
  };
}
 
function simpanSaja() {
  if (S.sibuk) return;
  S.sibuk = true;
  api('simpanDraftRab', { payload: payloadRab() }).then(function (d) {
    S.sibuk = false;
    buka('selesai', {
      msg: 'Draft tersimpan',
      sub: 'Belum bernomor dan belum masuk antrian persetujuan. Bisa dilanjutkan kapan saja dari daftar RAB.'
    });
  }).catch(function (e) { S.sibuk = false; toast(pesanError(e), 'bad'); });
}
 
function simpanDanKirim() {
  if (S.sibuk) return;
  S.sibuk = true;
  api('simpanDraftRab', { payload: payloadRab() }).then(function (d) {
    return api('kirimRab', { rab_id: d.rab_id });
  }).then(function (k) {
    S.sibuk = false;
    buka('selesai', {
      msg: 'RAB terkirim',
      sub: 'Nomor ' + k.no_rab + ' sudah terbit. Sekarang menunggu persetujuan ' + k.menunggu + '.'
    });
  }).catch(function (e) { S.sibuk = false; toast(pesanError(e), 'bad'); });
}
 
function kirimRab(id) {
  if (S.sibuk) return;
  S.sibuk = true;
  api('kirimRab', { rab_id: id }).then(function (k) {
    S.sibuk = false;
    buka('selesai', {
      msg: 'RAB terkirim',
      sub: 'Nomor ' + k.no_rab + ' sudah terbit. Sekarang menunggu persetujuan ' + k.menunggu + '.'
    });
  }).catch(function (e) { S.sibuk = false; toast(pesanError(e), 'bad'); });
}
 
function ubahDraft(id) {
  api('getRab', { rab_id: id }).then(function (d) {
    S.form = {
      rab_id: d.header.rab_id, tipe: d.header.tipe, divisi_id: d.header.divisi_id,
      periode: String(d.header.periode), judul: d.header.judul,
      valid_dari: String(d.header.valid_dari).slice(0, 10),
      valid_sampai: String(d.header.valid_sampai).slice(0, 10),
      items: d.items.map(function (i) {
        return {
          kategori_id: i.kategori_id, deskripsi: i.deskripsi, coa_id: i.coa_id,
          qty: Number(i.qty), satuan: i.satuan, harga_satuan: Number(i.harga_satuan),
          pola_realisasi: i.pola_realisasi
        };
      })
    };
    buka('rabnew', { step: 2 });
  }).catch(function (e) { toast(pesanError(e), 'bad'); });
}
 
function duplikat(id) {
  if (S.sibuk) return;
  S.sibuk = true;
  api('duplikatRab', { rab_id: id }).then(function (d) {
    S.sibuk = false;
    toast('Draft baru dibuat', 'good');
    keTab('rab');
  }).catch(function (e) { S.sibuk = false; toast(pesanError(e), 'bad'); });
}
 
function putuskan(aksi) {
  if (S.sibuk) return;
  var catatan = (document.getElementById('fCatatan') || {}).value || '';
  if (aksi !== 'APPROVE' && !catatan.trim()) {
    return toast('Catatan wajib diisi saat menolak atau meminta revisi.', 'bad');
  }
  S.sibuk = true;
  api('prosesApproval', { ref_type: S.p.modul, ref_id: S.p.id, aksi: aksi, catatan: catatan }).then(function (r) {
    S.sibuk = false;
    S.jmlInbox = Math.max(0, (S.jmlInbox || 1) - 1);
    var pesan = {
      APPROVE: ['Dokumen disetujui', r.status === 'AKTIF'
        ? 'Seluruh tahap selesai. RAB sekarang aktif dan itemnya bisa dipakai untuk pengajuan dana.'
        : 'Diteruskan ke ' + (r.current_role || 'tahap berikutnya') + '.'],
      REVISI: ['Dikembalikan untuk revisi', 'Pemohon dapat memperbaiki tanpa membuat dokumen baru.'],
      REJECT: ['Dokumen ditolak', 'Pemohon perlu membuat dokumen baru jika ingin mengajukan lagi.']
    }[aksi];
    S.stack = [];
    buka('selesai', { msg: pesan[0], sub: pesan[1] }, false);
  }).catch(function (e) { S.sibuk = false; toast(pesanError(e), 'bad'); });
}
 
/* ── Akun ────────────────────────────────────────────────── */
 
 
/** Membuka URL aplikasi pada indeks akun tertentu, tanpa menyentuh sesi lain. */
 
 
/* ── Masuk dan keluar ────────────────────────────────────── */
 
/**
 * Dipanggil Google Identity Services setelah pengguna memilih akun.
 * Token belum dipercaya di sini — server yang memverifikasinya.
 */
function terimaKredensial(resp) {
  var token = resp && resp.credential;
  if (!token) return layarMasuk('Google tidak mengirim token. Coba lagi.');
  simpanToken_(token);
  S.masuk = true;
  muatAplikasi();
}
 
function siapkanGoogle() {
  if (!window.google || !google.accounts || !google.accounts.id) {
    return setTimeout(siapkanGoogle, 200);
  }
  google.accounts.id.initialize({
    client_id: KONFIG.CLIENT_ID,
    callback: terimaKredensial,
    auto_select: true,
    cancel_on_tap_outside: false
  });
  var box = document.getElementById('gbox');
  if (box) {
    google.accounts.id.renderButton(box, {
      theme: 'filled_blue', size: 'large', shape: 'pill',
      text: 'signin_with', locale: 'id', width: 260
    });
  }
  google.accounts.id.prompt();
}
 
/**
 * Keluar sungguhan: token dibuang, pemilihan otomatis dimatikan,
 * seluruh data dihapus dari memori. Membuka halaman lagi akan
 * meminta pemilihan akun dari awal.
 */
function keluar(otomatis) {
  try {
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
  } catch (e) { }
 
  hapusToken_();
  S.masuk = false; S.boot = null; S.jmlInbox = 0;
  S.stack = []; S.form = {}; S.p = {}; S.layar = 'home'; S.tab = 'home';
  if (IDLE.timer) { clearInterval(IDLE.timer); IDLE.timer = null; }
 
  layarMasuk(otomatis
    ? 'Sesi berakhir. Masuk lagi untuk melanjutkan.'
    : null);
}
 
function layarMasuk(pesan) {
  document.getElementById('topbar').hidden = true;
  document.getElementById('tabs').hidden = true;
  document.getElementById('view').innerHTML =
    '<div class="masuk">' +
    '<div class="merek-besar"><img src="logo.png" alt="PT Sahada Laku Utama"></div>' +
    '<h2>Pengajuan FAT</h2>' +
    '<div class="ket">PT Sahada Laku Utama</div>' +
    (pesan ? '<div class="alert a-warn" style="max-width:300px">' + esc(pesan) + '</div>' : '') +
    '<div class="gbox" id="gbox"></div>' +
    '<div class="kaki">Masuk dengan akun Google yang sudah didaftarkan ' +
    'administrator. Akun lain akan ditolak.</div></div>';
  siapkanGoogle();
}
 
/* ── Pemuatan ────────────────────────────────────────────── */
 
function muatAplikasi() {
  document.getElementById('topbar').hidden = false;
  document.getElementById('view').innerHTML =
    '<div class="loading"><div class="spin"></div><p>Memuat data…</p></div>';
 
  api('bootstrap').then(function (b) {
    S.boot = b;
    return bolehApprove() ? api('listInbox').catch(function () { return []; }) : [];
  }).then(function (inbox) {
    S.jmlInbox = inbox.length;
    pantauMenganggur();
    keTab('home');
  }).catch(function (e) {
    if (e.kode === 'PENGGUNA_TIDAK_TERDAFTAR') return layarBelumTerdaftar(e);
    document.getElementById('ttl').textContent = 'Tidak bisa masuk';
    document.getElementById('sub').innerHTML = '&nbsp;';
    document.getElementById('view').innerHTML = kartuGalat(e) +
      '<div class="btnrow"><button class="btn ghost" onclick="muatAplikasi()">Coba lagi</button>' +
      '<button class="btn ghost" onclick="keluar(false)">Ganti akun</button></div>';
  });
}
 
/**
 * Akun Google mana pun bisa memperoleh token yang sah, jadi layar ini
 * akan sering muncul. Nadanya sengaja tenang: ini bukan kesalahan sistem,
 * hanya akun yang belum didaftarkan.
 */
function layarBelumTerdaftar(e) {
  var email = (e.detail && e.detail.email) || '';
  document.getElementById('topbar').hidden = true;
  document.getElementById('tabs').hidden = true;
  document.getElementById('view').innerHTML =
    '<div class="masuk">' +
    '<div class="merek-besar"><img src="logo.png" alt="PT Sahada Laku Utama"></div>' +
    '<h2>Akun belum terdaftar</h2>' +
    '<div class="ket">Identitas Anda sudah terverifikasi, tetapi email ini belum ' +
    'didaftarkan di sistem. Hubungi administrator FAT untuk meminta akses.</div>' +
    (email ? '<div class="card" style="width:100%;max-width:300px"><div class="xs">Email Anda</div>' +
      '<div class="mono" style="font-size:12.5px;margin-top:4px">' + esc(email) + '</div></div>' : '') +
    '<button class="btn ghost" style="max-width:300px;margin-top:14px" ' +
    'onclick="keluar(false)">Masuk dengan akun lain</button></div>';
}
 
/* ── Keluar otomatis saat menganggur ─────────────────────── */
 
function catatAktivitas() { IDLE.terakhir = Date.now(); }
 
function pantauMenganggur() {
  ['click', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) {
    document.addEventListener(ev, catatAktivitas, { passive: true });
  });
  catatAktivitas();
  if (IDLE.timer) clearInterval(IDLE.timer);
  IDLE.timer = setInterval(function () {
    if (!S.masuk) return;
    if (Date.now() - IDLE.terakhir > KONFIG.MENIT_MENGANGGUR * 60000) keluar(true);
  }, 30000);
}
 
/* ── Bagian profil ───────────────────────────────────────── */
 
function isiProfil() {
  var u = S.boot.pengguna;
  return '<div class="card">' +
    '<div class="ttl" style="font-size:16px">' + esc(u.nama) + '</div>' +
    '<div class="sm" style="margin-top:3px">' + esc(u.email) + '</div>' +
    '<div class="hr"></div>' +
    kv('Jabatan', esc(u.jabatan || '—')) +
    kv('Divisi', esc(namaDivisi(u.divisi_id))) +
    '</div>' +
    '<div class="sec">Peran Anda</div><div class="card">' +
    u.roles.map(function (r) {
      return '<span class="pill p-info" style="margin:0 5px 5px 0">' + esc(r) + '</span>';
    }).join('') + '</div>' +
    '<div class="sec">Tentang</div><div class="card">' +
    kv('Aplikasi', 'FAT — Pengajuan') +
    kv('Versi', esc(S.boot.versi)) +
    kv('Batas lampiran', S.boot.param.maks_lampiran_mb + ' MB') +
    '</div>' +
    '<div class="sec">Keluar</div>' +
    '<div class="card"><div class="sm">Keluar menghapus sesi Anda dari perangkat ini. ' +
    'Untuk masuk lagi Anda perlu memilih akun Google kembali.</div>' +
    '<div class="xs" style="margin-top:8px">Sesi berakhir sendiri setelah ' +
    KONFIG.MENIT_MENGANGGUR + ' menit tanpa aktivitas, saat tab ditutup, atau ' +
    'ketika token Google habis masa berlakunya' + sisaSesi_() + '.</div></div>' +
    '<button class="btn ghost" onclick="keluar(false)">Keluar dari aplikasi</button>';
}
 
/** Sisa masa berlaku token, untuk ditampilkan di layar profil. */
function sisaSesi_() {
  if (!S.token) return '';
  var sisa = kedaluwarsaToken_(S.token) - Date.now();
  if (sisa <= 0) return '';
  var menit = Math.round(sisa / 60000);
  return ' — sekitar ' + menit + ' menit lagi';
}
 
/* ── Mulai ───────────────────────────────────────────────── */
 
if (KONFIG.CLIENT_ID.indexOf('GANTI') === 0 || KONFIG.API_URL.indexOf('GANTI') === 0) {
  document.getElementById('view').innerHTML =
    '<div class="alert a-bad" style="margin:20px">Aplikasi belum dikonfigurasi. ' +
    'Isi <span class="mono">API_URL</span> dan <span class="mono">CLIENT_ID</span> ' +
    'di bagian atas <span class="mono">app.js</span>.</div>';
} else {
  // Token yang masih berlaku membuat pemuatan ulang halaman tidak
  // memaksa login lagi. Server tetap memverifikasinya dari awal.
  var tokenLama = tokenTersimpan_();
  if (tokenLama) {
    S.token = tokenLama;
    S.masuk = true;
    muatAplikasi();
  } else {
    layarMasuk(null);
  }
}
