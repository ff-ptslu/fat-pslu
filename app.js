/* ════════════════════════════════════════════════════════════
   FAT — app.js
   Aplikasi pengguna. Konfigurasi dan lapisan komunikasi ada di api.js,
   yang harus dimuat lebih dulu.
   ════════════════════════════════════════════════════════════ */

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
  rabnew: ['Buat RAB', ''],
  dana: ['Pengajuan dana', ''], danadet: ['Detail pengajuan', ''],
  pgjpick: ['Pilih RAB', 'Langkah 1 dari 3'], pgjitem: ['Pilih item', 'Langkah 1 dari 3'],
  pgjform: ['Ajukan dana', 'Langkah 2 dari 3'], pgjrev: ['Ajukan dana', 'Langkah 3 dari 3'],
  inbox: ['Perlu persetujuan', ''], inboxdet: ['Tinjau dokumen', ''],
  pgjverif: ['Tinjau pengajuan', ''],
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

/** Peran yang boleh memproses pengajuan pada tahap tertentu. */
function peranSaya_(role) {
  return S.boot && S.boot.pengguna.roles.indexOf(role) > -1;
}

function bolehApprove() {
  var r = S.boot.pengguna.roles;
  return ['MANAGER_DIVISI', 'HC', 'FINANCE', 'FAT_MANAGER', 'CEO'].some(function (x) {
    return r.indexOf(x) > -1;
  });
}

function gambarTab() {
  var el = document.getElementById('tabs');
  var daftar = [['home', '&#8962;', 'Beranda'], ['rab', '&#9636;', 'RAB'],
                ['dana', '&#8377;', 'Dana']];
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
        kartuAksi('&#8377;', 'Ajukan dana', "buka('pgjpick')") +
        kartuAksi('&#65291;', 'Buat RAB', "mulaiRabBaru()") +
        kartuAksi('&#9636;', 'RAB saya', "keTab('rab')") +
        kartuAksi('&#9200;', 'Lacak status', "keTab('dana')") +
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
        var layar = x.modul === 'PENGAJUAN' ? 'pgjverif' : 'inboxdet';
        return '<div class="card tap" onclick="buka(\'' + layar + '\',{modul:\'' + x.modul +
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


  /* ── Pengajuan dana ──────────────────────────────────── */

  dana: function () {
    return api('listPengajuan', {}).then(function (daftar) {
      var h = '';
      if (!daftar.length) {
        h += '<div class="empty"><div class="big">&#8377;</div>' +
          'Belum ada pengajuan dana.</div>';
      } else {
        h += daftar.map(function (d) {
          return '<div class="card tap" onclick="buka(\'danadet\',{id:\'' + d.pengajuan_id + '\'})">' +
            '<div class="rowb"><div style="min-width:0">' +
            '<div class="ttl">' + esc(d.keterangan) + '</div>' +
            '<div class="id mono" style="margin-top:3px">' + esc(d.no_pengajuan) + '</div>' +
            (d.rab_item_id ? '<div class="id mono">' + esc(d.rab_item_id) + '</div>' : '') +
            '</div><div style="text-align:right;flex-shrink:0">' +
            '<div class="amt" style="font-size:13.5px">' + rp(d.nominal_diajukan) + '</div>' +
            '<div style="margin-top:6px">' + pilPgj(d.status, d.current_role) + '</div>' +
            '</div></div></div>';
        }).join('');
      }
      h += '<button class="btn" onclick="buka(\'pgjpick\')" style="margin-top:6px">' +
        'Ajukan dana baru</button>';
      return h;
    });
  },

  danadet: function () {
    return api('getPengajuan', { pengajuan_id: S.p.id }).then(function (r) {
      var d = r.header;
      var h = '<div class="card"><div class="rowb"><div style="min-width:0">' +
        '<div class="ttl" style="font-size:16px">' + esc(d.keterangan) + '</div>' +
        '<div class="id mono" style="margin-top:4px">' + esc(d.no_pengajuan) + '</div>' +
        '</div>' + pilPgj(d.status, d.current_role) + '</div>' +
        '<div class="hr"></div>' +
        kv('Nominal diajukan', '<span class="amt">' + rp(d.nominal_diajukan) + '</span>') +
        kv('Penerima', esc(d.penerima_nama)) +
        (d.rab_item_id ? kv('Sumber anggaran',
          '<span class="mono" style="font-size:11px">' + esc(d.rab_item_id) + '</span>') : '') +
        kv('Tanggal permohonan', tgl(d.tanggal_permohonan)) +
        kv('Jenis', d.tipe_pengajuan === 'KASBON' ? 'Kasbon' : 'Non kasbon') +
        kv('Pagu ditahan', '<span class="amt">' + rp(d.beban_pagu) + '</span>') +
        '</div>';

      if (angka(d.total_tagihan)) {
        h += '<div class="sec">Perhitungan pajak</div><div class="card">' +
          kv('DPP', '<span class="amt">' + rp(d.dpp) + '</span>') +
          (angka(d.nilai_ppn) ? kv('PPN (menambah)',
            '<span class="amt" style="color:var(--green)">+ ' + rp(d.nilai_ppn) + '</span>') : '') +
          kv('Total tagihan', '<span class="amt">' + rp(d.total_tagihan) + '</span>') +
          (angka(d.nilai_pph) ? kv('PPh (memotong)',
            '<span class="amt" style="color:var(--red)">&minus; ' + rp(d.nilai_pph) + '</span>') : '') +
          '<div class="hr"></div>' +
          kv('Ditransfer ke penerima', '<span class="amt" style="font-size:14px">' +
            rp(d.bank_out) + '</span>') + '</div>';
      }

      if (d.tanggal_realisasi) {
        h += '<div class="sec">Pencairan</div><div class="card">' +
          kv('Tanggal', tgl(d.tanggal_realisasi)) +
          kv('Nominal', '<span class="amt">' + rp(d.nominal_realisasi) + '</span>') +
          kv('Nomor bukti', esc(d.no_bukti)) +
          kv('Sumber dana', esc(d.bank_pengirim)) + '</div>';
      }

      if (d.status === 'REVISI') {
        h += '<div class="alert a-bad">Dokumen dikembalikan. Perbaiki sesuai catatan ' +
          'di bawah, lalu ajukan ulang. Nomor pengajuan tidak berubah.</div>';
      }

      h += '<div class="sec">Jejak dokumen</div><div class="card">' + rail(r.jejak) + '</div>';

      if (d.status === 'REVISI') {
        h += '<button class="btn" onclick="mulaiAjukanUlang(\'' + d.pengajuan_id + '\',' +
          angka(d.nominal_diajukan) + ')">Perbaiki dan ajukan ulang</button>';
      }

      // Formulir dibawa ke atasan untuk ditandatangani, jadi baru berguna
      // setelah verifikasi pajak selesai dan seluruh angkanya pasti.
      if (['MENUNGGU_MANAGER', 'MENUNGGU_PENCAIRAN', 'SELESAI'].indexOf(d.status) > -1) {
        h += '<button class="btn ghost" onclick="bukaCetak(\'' + d.pengajuan_id + '\')">' +
          'Cetak formulir' +
          (angka(d.jumlah_cetak) ? ' (sudah ' + angka(d.jumlah_cetak) + '&times;)' : '') +
          '</button>';
      }
      return h;
    });
  },

  pgjpick: function () {
    return api('listRab', {}).then(function (daftar) {
      var aktif = daftar.filter(function (r) { return r.status === 'AKTIF'; });
      if (!aktif.length) {
        return '<div class="empty"><div class="big">&#9636;</div>' +
          'Belum ada RAB aktif yang bisa dibebani.<br><br>' +
          '<span class="xs">RAB harus melewati seluruh tahap persetujuan lebih dulu.</span></div>';
      }
      return '<div class="alert a-info">Pilih RAB yang akan dibebani. Hanya RAB aktif ' +
        'dan masih dalam masa berlaku yang muncul di sini.</div>' +
        aktif.map(function (r) {
          var pakai = r.pagu ? Math.round((r.pagu - r.sisa) / r.pagu * 100) : 0;
          return '<div class="card tap" onclick="buka(\'pgjitem\',{id:\'' + r.rab_id + '\'})">' +
            '<div class="rowb"><div style="min-width:0">' +
            '<span class="pill p-info">' + esc(r.tipe) + '</span>' +
            '<div class="ttl" style="margin-top:7px">' + esc(r.judul) + '</div>' +
            '<div class="id mono" style="margin-top:3px">' + esc(r.no_rab) + '</div>' +
            '</div><div style="text-align:right;flex-shrink:0">' +
            '<div class="amt" style="font-size:13.5px;color:var(--green)">' + rp(r.sisa) + '</div>' +
            '<div class="xs">sisa total</div></div></div>' +
            meter(r.pagu, r.pagu - r.sisa, 0) +
            '<div class="rowb"><span class="xs">Terserap ' + pakai + '%</span>' +
            '<span class="xs">' + esc(namaDivisi(r.divisi_id)) + ' &middot; sampai ' +
            tgl(r.valid_sampai) + '</span></div></div>';
        }).join('');
    });
  },

  pgjitem: function () {
    return api('getRab', { rab_id: S.p.id }).then(function (r) {
      var hariIni = new Date().toISOString().slice(0, 10);

      // Daftar item disimpan di state, dan tombol hanya membawa indeksnya.
      // Menyisipkan JSON ke dalam atribut onclick tampak praktis tetapi
      // rusak begitu isinya mengandung tanda kutip.
      S.p.items = r.items;
      S.p.noRab = r.header.no_rab;

      return '<div class="card" style="background:var(--brand-50);border-color:var(--brand-50)">' +
        '<div class="ttl">' + esc(r.header.judul) + '</div>' +
        '<div class="id mono" style="margin-top:3px">' + esc(r.header.no_rab) + '</div>' +
        '<div class="xs" style="margin-top:5px">' + esc(namaDivisi(r.header.divisi_id)) +
        ' &middot; ' + esc(r.header.periode) + '</div></div>' +
        '<div class="sec">Item yang tersedia</div>' +
        r.items.map(function (i, idx) {
          var lewat = i.valid_sampai && i.valid_sampai < hariIni;
          var off = i.sisa <= 0 || lewat || i.status_item === 'EXPIRED' || i.status_item === 'CLOSED';
          var alasan = i.sisa <= 0 ? 'Pagu habis'
            : lewat ? 'Masa berlaku sudah lewat' : 'Item sudah ditutup';
          return '<div class="pick ' + (off ? 'off' : '') + '"' +
            (off ? '' : ' onclick="pilihItem(' + idx + ')"') + '>' +
            '<div class="rowb"><div style="min-width:0">' +
            '<div style="font-weight:600;font-size:13.5px">' + esc(i.deskripsi) + '</div>' +
            '<div class="id mono" style="margin-top:3px">' + esc(i.item_id) + '</div>' +
            '<div class="xs" style="margin-top:3px">Berlaku sampai ' + tgl(i.valid_sampai) + '</div>' +
            '</div><div style="text-align:right;flex-shrink:0">' +
            '<div class="amt" style="font-size:13px;color:' +
            (off ? 'var(--red)' : 'var(--green)') + '">' + rp(i.sisa) + '</div>' +
            '<div class="xs">sisa</div></div></div>' +
            meter(i.pagu_efektif, i.realisasi, i.committed) +
            (i.penyesuaian ? '<div class="xs" style="color:' +
              (i.penyesuaian > 0 ? 'var(--green)' : 'var(--amber)') + '">' +
              (i.penyesuaian > 0 ? '&#9650;' : '&#9660;') + ' Penyesuaian ' +
              rp(Math.abs(i.penyesuaian)) + ' &middot; pagu awal ' + rp(i.pagu_awal) + '</div>' : '') +
            (off ? '<div class="xs" style="color:var(--red)">' + alasan + '</div>' :
              '<div class="legend">' +
              '<span><i class="dotc" style="background:var(--brand)"></i>Terpakai ' + rpk(i.realisasi) + '</span>' +
              (i.committed ? '<span><i class="dotc" style="background:var(--amber)"></i>Diproses ' +
                rpk(i.committed) + '</span>' : '') +
              '<span><i class="dotc" style="background:#EDF0F4;border:1px solid var(--line)"></i>Sisa ' +
              rpk(i.sisa) + '</span></div>') +
            '</div>';
        }).join('');
    });
  },

  pgjform: function () {
    var f = S.form;
    var m = S.boot.master;
    var bayar = f.tipe_pembayaran_nama || 'TRANSFER BANK';
    var jenis = f.tipe_pengajuan || 'NON_KASBON';

    var h = '';
    if (f.item_id) {
      h += '<div class="card" style="background:var(--brand-50);border-color:var(--brand-50)">' +
        '<div class="rowb"><div style="min-width:0">' +
        '<div class="xs">Dibebankan ke</div>' +
        '<div style="font-weight:600;font-size:13.5px;margin-top:2px">' + esc(f.nama) + '</div>' +
        '<div class="id mono" style="margin-top:3px">' + esc(f.item_id) + '</div>' +
        '</div><div style="text-align:right"><div class="amt" style="font-size:13px">' +
        rp(f.sisa) + '</div><div class="xs">sisa pagu</div></div></div></div>';
    }
    if (f.pola === 'TERTUNDA') {
      h += '<div class="alert a-info">Item ini pascabayar. Beban tercatat di periode ini, ' +
        'tetapi dana baru cair setelah tagihan platform masuk bulan depan.</div>';
    }

    h += '<div class="field"><label>Tanggal permohonan</label>' +
      '<input type="date" id="fTgl" value="' + esc(f.tanggal_permohonan || hariIni_()) + '"></div>';

    h += '<div class="field"><label>Tipe transaksi</label><select id="fTipeTrx">' +
      m.tipe_transaksi.filter(function (t) {
        return t.pembebanan_default === 'RAB' || !f.item_id;
      }).map(function (t) {
        return '<option value="' + t.tipe_id + '"' +
          (f.tipe_transaksi_id === t.tipe_id ? ' selected' : '') + '>' + esc(t.nama) + '</option>';
      }).join('') + '</select></div>';

    h += '<div class="field"><label>Berita transaksi</label>' +
      '<input id="fKet" value="' + esc(f.keterangan || '') +
      '" placeholder="Contoh: Beli kertas A4 10 rim"></div>';

    h += '<div class="field"><label>Nominal' +
      (f.item_id ? ' <span class="hint">— maksimal ' + rp(f.sisa) + '</span>' : '') + '</label>' +
      '<input class="mono" id="fNominal" inputmode="numeric" placeholder="Rp0" ' +
      'value="' + (f.nominal_diajukan ? rp(f.nominal_diajukan) : '') + '" ' +
      'oninput="formatUang(this);cekNominal()">' +
      '<div id="cekNom"></div></div>';

    h += '<div class="field"><label>Harga sudah termasuk PPN? ' +
      '<span class="hint">— menentukan cara pajak dihitung</span></label>' +
      '<select id="fSkema" onchange="S.form.skema_ppn=this.value;cekNominal()">' +
      opsi([['NON_PPN', 'Tidak ada PPN'],
            ['EXCLUDE', 'Belum termasuk PPN — PPN ditambahkan'],
            ['INCLUDE', 'Sudah termasuk PPN — DPP dipisahkan']], f.skema_ppn || 'NON_PPN') +
      '</select></div>';

    h += '<div class="field"><label>Tipe pengajuan</label>' +
      '<select id="fJenis" onchange="S.form.tipe_pengajuan=this.value;simpanForm();gambar()">' +
      opsi([['NON_KASBON', 'Non kasbon'], ['KASBON', 'Kasbon']], jenis) + '</select></div>';

    h += '<div class="sec">Penerima</div>';
    h += '<div class="field"><label>Informasi penerima ' +
      '<span class="hint">— menentukan usulan jenis pajak</span></label>' +
      '<select id="fInfo">' +
      opsi([['PERORANGAN', 'PERORANGAN'], ['PERUSAHAAN', 'PERUSAHAAN'],
            ['PEMERINTAH', 'PEMERINTAH']], f.info_penerima || 'PERUSAHAAN') + '</select></div>';
    h += '<div class="field"><label>Nama penerima</label>' +
      '<input id="fPenerima" style="text-transform:uppercase" value="' +
      esc(f.penerima_nama || '') + '" placeholder="Nama orang atau vendor"></div>';
    h += '<div class="field"><label>Email penerima ' +
      '<span class="hint">— diverifikasi finance sebelum bukti transfer dikirim</span></label>' +
      '<input type="email" id="fEmail" value="' + esc(f.penerima_email || '') +
      '" placeholder="nama@perusahaan.com"></div>';

    h += '<div class="field"><label>Tipe pembayaran</label>' +
      '<select id="fBayar" onchange="gantiBayar(this.value)">' +
      m.tipe_pembayaran.map(function (t) {
        return '<option value="' + esc(t.nama) + '"' +
          (bayar === t.nama ? ' selected' : '') + '>' + esc(t.nama) + '</option>';
      }).join('') + '</select></div>';

    var cfg = (m.tipe_pembayaran.filter(function (t) { return t.nama === bayar; })[0]) || {};
    if (cfg.butuh_rekening === 'YA') {
      h += '<div class="field"><label>Bank penerima</label>' +
        '<select id="fBank" onchange="gantiBank(this.value)">' + opsiBank(f.bank_penerima) +
        '</select></div>' +
        (f.bank_lain ? '<div class="field"><label>Nama bank ' +
          '<span class="hint">— tidak ada di daftar</span></label>' +
          '<input id="fBankLain" style="text-transform:uppercase" value="' +
          esc(f.bank_penerima_lain || '') + '" placeholder="Tulis nama banknya"></div>' : '') +
        '<div class="field"><label>Nomor rekening</label>' +
        '<input class="mono" id="fRek" inputmode="numeric" value="' + esc(f.no_rekening || '') +
        '" placeholder="1234-5678-9000" oninput="formatRekening(this)"></div>';
    }
    if (cfg.butuh_no_hp === 'YA') {
      h += '<div class="field"><label>Nomor handphone ' +
        '<span class="hint">— untuk konfirmasi pengambilan</span></label>' +
        '<input class="mono" id="fHp" inputmode="tel" value="' + esc(f.no_hp || '') +
        '" placeholder="0812-3456-7890" oninput="formatRekening(this)"></div>';
    }
    if (cfg.butuh_warkat === 'YA') {
      h += '<div class="field"><label>Nomor warkat</label>' +
        '<input class="mono" id="fWarkat" value="' + esc(f.no_cek_bg || '') + '" placeholder="AB123456"></div>' +
        '<div class="field"><label>Tanggal jatuh tempo</label>' +
        '<input type="date" id="fJatuhTempo" value="' + esc(f.tgl_jatuh_tempo_bg || '') + '"></div>';
    }
    if (cfg.butuh_va === 'YA') {
      h += '<div class="field"><label>Biller</label>' +
        '<input id="fBiller" value="' + esc(f.va_biller || '') + '" placeholder="Contoh: BNI VA"></div>' +
        '<div class="field"><label>Nomor virtual account</label>' +
        '<input class="mono" id="fVa" inputmode="numeric" value="' + esc(f.va_nomor || '') +
        '" oninput="formatRekening(this)"></div>';
    }

    h += '<div class="sec">Lampiran pendukung</div>';
    h += kotakUnggah('finance', 'Lampiran finance', 'wajib',
      jenis === 'KASBON'
        ? 'Untuk kasbon, lampirkan tangkapan layar atau dokumen yang menjelaskan rencana penggunaan dana.'
        : 'Invoice, nota, atau surat penawaran. Boleh PDF, foto, atau dokumen.');
    h += kotakUnggah('tax', 'Lampiran tax', 'opsional',
      'Faktur pajak, KTP, atau SPK bila ada.');

    h += '<div class="alert a-warn">Jenis pajak, sumber dana, dan bank pengirim ' +
      'ditentukan tim FAT saat verifikasi, bukan di sini.</div>';
    h += '<button class="btn" onclick="lanjutRingkasan()">Lanjut ke ringkasan</button>';
    return h;
  },

  pgjrev: function () {
    var f = S.form;
    var estimasi = estimasiBeban(f.nominal_diajukan, f.skema_ppn);
    var adaSisa = f.item_id && f.sisa !== null && f.sisa !== undefined;
    var sisaSetelah = adaSisa ? f.sisa - estimasi : null;

    var h = '<div class="card">' +
      '<div class="ttl" style="font-size:16px">' + esc(f.keterangan) + '</div>' +
      '<div class="id mono" style="margin-top:4px">Nomor pengajuan terbit setelah dikirim</div>' +
      '<div class="hr"></div>' +
      (f.item_id ? kv('Dibebankan ke',
        '<span class="mono" style="font-size:11px">' + esc(f.item_id) + '</span>') : '') +
      kv('Nominal', '<span class="amt">' + rp(f.nominal_diajukan) + '</span>') +
      kv('Skema PPN', f.skema_ppn === 'EXCLUDE' ? 'Belum termasuk PPN'
        : f.skema_ppn === 'INCLUDE' ? 'Sudah termasuk PPN' : 'Tidak ada PPN') +
      kv('Pagu yang ditahan', '<span class="amt">' + rp(estimasi) + '</span>') +
      (f.ajukan_ulang ? kv('Nomor pengajuan', 'tidak berubah') : '') +
      (sisaSetelah !== null ? kv('Sisa pagu setelah ini',
        '<span class="amt">' + rp(sisaSetelah) + '</span>') : '') +
      kv('Penerima', esc(f.penerima_nama)) +
      kv('Jenis', f.tipe_pengajuan === 'KASBON' ? 'Kasbon' : 'Non kasbon') +
      '</div>';

    if (estimasi > angka(f.nominal_diajukan)) {
      h += '<div class="alert a-warn">Pagu yang ditahan lebih besar dari nominal karena ' +
        'harga belum termasuk PPN. Kelebihannya dikembalikan bila tim pajak menetapkan ' +
        'angka yang lebih kecil.</div>';
    }

    h += '<div class="sec">Akan melewati</div><div class="card">' + rail([
      { role: 'Verifikasi finance', status: 'wait', aktor: '' },
      { role: 'Verifikasi pajak', status: 'wait', aktor: '' },
      { role: 'Persetujuan FAT Manager', status: 'wait', aktor: '' },
      { role: 'Pencairan oleh kasir', status: 'wait', aktor: '' }
    ]) + '</div>';

    h += '<button class="btn" id="btnKirim" onclick="kirimPengajuan()">' +
      (f.ajukan_ulang ? 'Ajukan ulang' : 'Kirim pengajuan') + '</button>';
    return h;
  },


  /** Layar tinjau untuk pengajuan dana. Isinya menyesuaikan tahap dan peran. */
  pgjverif: function () {
    return api('getPengajuan', { pengajuan_id: S.p.id }).then(function (r) {
      var d = r.header;
      var tahap = String(d.current_role).split(',')[0];
      S.p.nominal = angka(d.nominal_diajukan);
      S.p.skema = d.skema_ppn;

      var h = '<div class="card">' +
        '<span class="pill p-info">Pengajuan dana</span>' +
        '<div class="ttl" style="font-size:16px;margin-top:7px">' + esc(d.keterangan) + '</div>' +
        '<div class="id mono" style="margin-top:4px">' + esc(d.no_pengajuan) + '</div>' +
        '<div class="hr"></div>' +
        kv('Pemohon', esc(d.pemohon_email)) +
        kv('Nominal diajukan', '<span class="amt">' + rp(d.nominal_diajukan) + '</span>') +
        kv('Skema PPN', d.skema_ppn === 'EXCLUDE' ? 'Belum termasuk PPN'
          : d.skema_ppn === 'INCLUDE' ? 'Sudah termasuk PPN' : 'Tidak ada PPN') +
        kv('Penerima', esc(d.penerima_nama) + ' (' + esc(d.info_penerima) + ')') +
        (d.bank_penerima ? kv('Bank penerima', esc(d.bank_penerima) + ' ' + esc(d.no_rekening)) : '') +
        (d.rab_item_id ? kv('Sumber anggaran',
          '<span class="mono" style="font-size:11px">' + esc(d.rab_item_id) + '</span>') : '') +
        kv('Pagu ditahan', '<span class="amt">' + rp(d.beban_pagu) + '</span>') +
        (d.lampiran_finance ? kv('Lampiran finance',
          '<a href="' + esc(d.lampiran_finance) + '" target="_blank" ' +
          'style="color:var(--brand)">buka</a>') : '') +
        (d.lampiran_tax ? kv('Lampiran tax',
          '<a href="' + esc(d.lampiran_tax) + '" target="_blank" ' +
          'style="color:var(--brand)">buka</a>') : '') +
        '</div>';

      h += '<div class="sec">Jejak dokumen</div><div class="card">' + rail(r.jejak) + '</div>';

      if (tahap === 'FINANCE' && peranSaya_('FINANCE')) {
        h += '<div class="sec">Verifikasi finance</div>' +
          '<div class="field"><label>Sumber dana ' +
          '<span class="hint">— hanya finance yang tahu saldo tiap rekening</span></label>' +
          '<select id="vSumber">' + S.boot.master.sumber_dana.map(function (x) {
            return '<option value="' + x.sumber_id + '">' + esc(x.nama) + '</option>';
          }).join('') + '</select></div>' +
          '<div class="field"><label>Catatan</label>' +
          '<textarea id="vCatatan" rows="2" placeholder="Opsional untuk menyetujui, ' +
          'wajib untuk menolak"></textarea></div>' +
          '<button class="btn ok" onclick="simpanFinance()">Verifikasi dan teruskan</button>';

      } else if (tahap === 'TAX' && peranSaya_('TAX')) {
        var ppn = S.boot.master.pajak.filter(function (x) { return x.jenis === 'PPN'; });
        var pph = S.boot.master.pajak.filter(function (x) { return x.jenis === 'PPH'; });
        h += '<div class="sec">Verifikasi pajak</div>' +
          '<div class="alert a-info" id="usulPajak">Memuat usulan pajak…</div>' +
          '<div class="field"><label>Jenis PPN</label><select id="vPpn" onchange="pratinjauPajak()">' +
          '<option value="">Tanpa PPN</option>' +
          ppn.map(function (x) {
            return '<option value="' + x.pajak_id + '">' + esc(x.nama) + '</option>';
          }).join('') + '</select></div>' +
          '<div class="field"><label>Jenis PPh</label><select id="vPph" onchange="pratinjauPajak()">' +
          '<option value="">Tanpa PPh</option>' +
          pph.map(function (x) {
            return '<option value="' + x.pajak_id + '">' + esc(x.nama) + '</option>';
          }).join('') + '</select></div>' +
          '<div id="hasilPajak"></div>' +
          '<div class="field"><label>NIK atau NPWP penerima ' +
          '<span class="hint">— tercetak di formulir</span></label>' +
          '<input class="mono" id="vNik" value="' + esc(d.nik_npwp_penerima || '') + '"></div>' +
          '<div class="field"><label>Penanda</label>' +
          '<label class="xs" style="display:block;font-weight:400;margin-bottom:4px">' +
          '<input type="checkbox" id="vBukanObjek" style="width:auto;margin-right:6px">' +
          'Transaksi bukan objek PPh</label>' +
          '<label class="xs" style="display:block;font-weight:400">' +
          '<input type="checkbox" id="vSkb" style="width:auto;margin-right:6px">' +
          'Punya Surat Keterangan Bebas</label></div>' +
          '<div class="field"><label>Catatan</label>' +
          '<textarea id="vCatatan" rows="2"></textarea></div>' +
          '<button class="btn ok" onclick="simpanTax()">Verifikasi dan teruskan</button>';

      } else if (tahap === 'KASIR' && peranSaya_('KASIR')) {
        h += '<div class="sec">Pencairan</div>' +
          '<div class="card" style="background:var(--brand-50);border-color:var(--brand-50)">' +
          kv('Ditransfer ke penerima', '<span class="amt" style="font-size:15px">' +
            rp(d.bank_out || d.nominal_diajukan) + '</span>') +
          kv('Dari', esc(d.bank_pengirim)) + '</div>' +
          '<div class="field"><label>Tanggal realisasi</label>' +
          '<input type="date" id="vTgl" value="' + hariIni_() + '"></div>' +
          '<div class="field"><label>Nomor bukti transfer</label>' +
          '<input id="vBukti" placeholder="Nomor referensi dari bank"></div>' +
          '<div class="field"><label>Biaya admin bank <span class="hint">— bila ada</span></label>' +
          '<input class="mono" id="vAdmin" inputmode="numeric" placeholder="Rp0" ' +
          'oninput="formatUang(this)"></div>' +
          '<div class="field"><label>Tautan invoice <span class="hint">— opsional</span></label>' +
          '<input id="vInvoice"></div>' +
          '<button class="btn ok" onclick="simpanPencairan()">Catat pencairan</button>';

        setTimeout(function () { muatUsulPajak_(d.info_penerima); }, 50);

      } else if (peranSaya_(tahap)) {
        h += '<div class="field"><label>Catatan ' +
          '<span class="hint">— wajib jika menolak atau meminta revisi</span></label>' +
          '<textarea id="vCatatan" rows="3" placeholder="Tulis catatan untuk pemohon"></textarea></div>' +
          '<button class="btn ok" onclick="putusPgj(\'APPROVE\')">Setujui</button>';
      } else {
        h += '<div class="alert a-info">Dokumen ini sedang menunggu ' + esc(d.current_role) +
          '. Anda hanya bisa melihat.</div>';
        return h;
      }

      h += '<div class="btnrow">' +
        '<button class="btn ghost" onclick="putusPgj(\'REVISI\')">Minta revisi</button>' +
        '<button class="btn no" onclick="putusPgj(\'REJECT\')">Tolak</button></div>';
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



/* ── Pemformatan masukan ─────────────────────────────────── */

/**
 * Memformat kolom nominal sambil diketik: 100000 menjadi Rp100.000.
 *
 * Angka mentah tidak pernah disimpan di elemen; setiap pembacaan
 * membersihkan kembali seluruh karakter selain digit. Dengan begitu
 * tidak ada kemungkinan titik pemisah ikut terkirim ke server.
 */
function formatUang(el) {
  var digit = String(el.value).replace(/\D/g, '');
  el.value = digit ? 'Rp' + Number(digit).toLocaleString('id-ID') : '';
  // Kursor selalu di ujung, karena memformat ulang menggeser posisinya.
  try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { }
}

/** Membaca angka murni dari kolom yang sudah diformat. */
function bacaUang(id) {
  var el = document.getElementById(id);
  if (!el) return 0;
  return Number(String(el.value).replace(/\D/g, '')) || 0;
}

/** Memberi tanda hubung tiap empat angka pada nomor rekening dan telepon. */
function formatRekening(el) {
  el.value = String(el.value).replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1-');
}

function angka(v) { return Number(v) || 0; }

function hariIni_() { return new Date().toISOString().slice(0, 10); }

/** Perkiraan pagu yang ditahan, mengikuti aturan yang sama dengan server. */
function estimasiBeban(nominal, skema) {
  var n = angka(nominal);
  var tarif = (S.boot && S.boot.param.tarif_ppn) || 0.11;
  var basis = (S.boot && S.boot.param.basis_beban) || 'TOTAL';
  if (basis === 'DPP') {
    return skema === 'INCLUDE' ? Math.round(n / (1 + tarif)) : n;
  }
  return skema === 'EXCLUDE' ? Math.round(n * (1 + tarif)) : n;
}

/**
 * Memberi tahu pemohon akibat nominal yang diketik, sebelum dikirim.
 * Yang diperiksa adalah pagu yang ditahan, bukan nominal mentah —
 * skema EXCLUDE menahan lebih besar daripada yang diketik.
 */
function cekNominal() {
  var el = document.getElementById('cekNom');
  if (!el) return;
  var n = bacaUang('fNominal');
  var skema = (document.getElementById('fSkema') || {}).value || 'NON_PPN';
  if (!n) { el.innerHTML = ''; return; }

  var beban = estimasiBeban(n, skema);
  var catatan = beban > n
    ? '<div class="xs" style="margin-top:6px">Pagu yang ditahan ' + rp(beban) +
      ' karena PPN ditambahkan di atas nominal.</div>'
    : '';

  if (!S.form.item_id || S.form.sisa === null || S.form.sisa === undefined) {
    el.innerHTML = catatan + (S.form.ajukan_ulang
      ? '<div class="xs" style="margin-top:6px">Selisih terhadap pagu yang sudah ditahan ' +
        'akan dihitung server saat dikirim.</div>' : '');
    return;
  }

  if (beban > S.form.sisa) {
    el.innerHTML = '<div class="alert a-bad" style="margin:8px 0 0">Melebihi sisa pagu ' +
      rp(S.form.sisa) + ' sebesar ' + rp(beban - S.form.sisa) + '. Kurangi nominal, ' +
      'atau pilih item lain yang masih bersisa.</div>';
  } else {
    el.innerHTML = catatan +
      '<div class="xs" style="margin-top:6px">Sisa setelah pengajuan ini ' +
      rp(S.form.sisa - beban) + '.</div>';
  }
}


/* ── Pilihan bank ────────────────────────────────────────── */

function opsiBank(terpilih) {
  var daftar = (S.boot && S.boot.master.bank) || [];
  var bank = daftar.filter(function (b) { return b.jenis === 'BANK'; });
  var ewallet = daftar.filter(function (b) { return b.jenis === 'EWALLET'; });

  var opt = function (b) {
    return '<option value="' + esc(b.nama) + '"' +
      (terpilih === b.nama ? ' selected' : '') + '>' + esc(b.nama) + '</option>';
  };

  return '<option value="">— pilih bank —</option>' +
    (bank.length ? '<optgroup label="Bank">' + bank.map(opt).join('') + '</optgroup>' : '') +
    (ewallet.length ? '<optgroup label="Dompet digital">' + ewallet.map(opt).join('') + '</optgroup>' : '') +
    '<option value="__LAIN__"' + (S.form.bank_lain ? ' selected' : '') + '>Lainnya…</option>';
}

/** Memilih "Lainnya" memunculkan kolom teks untuk bank yang belum terdaftar. */
function gantiBank(nilai) {
  simpanForm();
  if (nilai === '__LAIN__') {
    S.form.bank_lain = true;
    S.form.bank_penerima = '';
  } else {
    S.form.bank_lain = false;
    S.form.bank_penerima = nilai;
  }
  gambar();
}

/* ── Unggah lampiran ─────────────────────────────────────── */

/**
 * Kotak unggah untuk satu slot lampiran.
 * Menampilkan tombol pilih berkas, atau keterangan berkas yang sudah terunggah.
 */
function kotakUnggah(slot, judul, sifat, bantuan) {
  var url = S.form['lampiran_' + slot];
  var nama = S.form['nama_' + slot];

  var isi;
  if (url) {
    isi = '<div class="card" style="margin:0;border-color:var(--green)">' +
      '<div class="rowb"><div style="min-width:0">' +
      '<div style="font-weight:600;font-size:12.5px">&#10003; ' + esc(nama || 'Berkas terunggah') + '</div>' +
      '<a href="' + esc(url) + '" target="_blank" class="xs" ' +
      'style="color:var(--brand)">Buka berkas</a></div>' +
      '<button class="btn ghost" style="width:auto;padding:7px 12px;font-size:12px" ' +
      'onclick="hapusLampiran(\'' + slot + '\')">Ganti</button></div></div>';
  } else {
    isi = '<div class="upload" onclick="document.getElementById(\'file_' + slot + '\').click()" ' +
      'id="drop_' + slot + '">Ketuk untuk pilih berkas<br>' +
      '<span class="xs">PDF, foto, atau dokumen &middot; maks ' +
      ((S.boot && S.boot.param.maks_lampiran_mb) || 25) + ' MB</span></div>' +
      '<input type="file" id="file_' + slot + '" style="display:none" ' +
      'accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx" ' +
      'onchange="unggahBerkas(this,\'' + slot + '\')">';
  }

  return '<div class="field"><label>' + judul +
    ' <span class="hint">— ' + sifat + '</span></label>' + isi +
    '<div class="xs" style="margin-top:6px">' + bantuan + '</div></div>';
}

/**
 * Membaca berkas menjadi base64 lalu mengirimkannya ke server.
 *
 * Isi berkas dikirim di dalam badan permintaan, bukan sebagai unggahan
 * multipart, karena Apps Script tidak bisa menjawab permintaan preflight
 * yang dipicu oleh header multipart.
 */
function unggahBerkas(input, slot) {
  var berkas = input.files && input.files[0];
  if (!berkas) return;

  var maksMb = (S.boot && S.boot.param.maks_lampiran_mb) || 25;
  if (berkas.size > maksMb * 1024 * 1024) {
    input.value = '';
    return toast('Berkas ' + (berkas.size / 1048576).toFixed(1) +
      ' MB, melebihi batas ' + maksMb + ' MB.', 'bad');
  }

  simpanForm();
  var kotak = document.getElementById('drop_' + slot);
  if (kotak) kotak.innerHTML = 'Mengunggah ' + esc(berkas.name) + '…';

  var pembaca = new FileReader();
  pembaca.onerror = function () {
    if (kotak) kotak.innerHTML = 'Gagal membaca berkas. Coba lagi.';
  };
  pembaca.onload = function () {
    var base64 = String(pembaca.result).split(',')[1];
    api('unggahLampiran', {
      nama: berkas.name,
      mime: berkas.type || 'application/octet-stream',
      base64: base64
    }).then(function (r) {
      S.form['lampiran_' + slot] = r.url;
      S.form['nama_' + slot] = r.nama + ' (' + r.ukuran_teks + ')';
      gambar();
      toast('Berkas terunggah.', 'good');
    }).catch(function (e) {
      if (kotak) kotak.innerHTML = 'Ketuk untuk pilih berkas';
      toast(pesanError(e), 'bad');
    });
  };
  pembaca.readAsDataURL(berkas);
}

function hapusLampiran(slot) {
  simpanForm();
  S.form['lampiran_' + slot] = '';
  S.form['nama_' + slot] = '';
  gambar();
}

/* ── Alur pengajuan ──────────────────────────────────────── */

/**
 * Memilih item anggaran yang akan dibebani.
 * Menerima indeks pada daftar yang sedang ditampilkan, bukan datanya,
 * agar tidak ada data yang perlu diselipkan ke dalam atribut HTML.
 */
function pilihItem(idx) {
  var daftar = S.p.items || [];
  var i = daftar[idx];
  if (!i) return toast('Item tidak ditemukan, coba muat ulang halaman.', 'bad');

  S.form = {
    item_id: i.item_id, nama: i.deskripsi, sisa: i.sisa, coa_id: i.coa_id,
    pola: i.pola_realisasi, tanggal_permohonan: hariIni_(),
    skema_ppn: 'NON_PPN', tipe_pengajuan: 'NON_KASBON',
    info_penerima: 'PERUSAHAAN', tipe_pembayaran_nama: 'TRANSFER BANK'
  };
  buka('pgjform');
}

function gantiBayar(nama) {
  simpanForm();
  S.form.tipe_pembayaran_nama = nama;
  gambar();
}

/** Menyalin isi formulir ke state agar tidak hilang saat layar digambar ulang. */
function simpanForm() {
  var ambil = function (id) {
    var el = document.getElementById(id);
    return el ? el.value : undefined;
  };
  var f = S.form;
  var peta = {
    tanggal_permohonan: 'fTgl', tipe_transaksi_id: 'fTipeTrx', keterangan: 'fKet',
    skema_ppn: 'fSkema', tipe_pengajuan: 'fJenis', info_penerima: 'fInfo',
    penerima_nama: 'fPenerima', penerima_email: 'fEmail',
    bank_penerima: 'fBank', no_rekening: 'fRek', no_hp: 'fHp',
    no_cek_bg: 'fWarkat', tgl_jatuh_tempo_bg: 'fJatuhTempo',
    va_biller: 'fBiller', va_nomor: 'fVa'
  };
  // Lampiran tidak dibaca dari kolom teks: nilainya ditetapkan
  // saat unggahan berhasil, dan kolomnya tidak ada di layar.
  Object.keys(peta).forEach(function (k) {
    var v = ambil(peta[k]);
    if (v !== undefined) f[k] = v;
  });
  var n = bacaUang('fNominal');
  if (n) f.nominal_diajukan = n;

  var lain = document.getElementById('fBankLain');
  if (lain) f.bank_penerima_lain = lain.value;
  if (f.bank_lain) f.bank_penerima = (f.bank_penerima_lain || '').toUpperCase();
}

function lanjutRingkasan() {
  simpanForm();
  var f = S.form;

  if (!f.keterangan) return toast('Berita transaksi wajib diisi.', 'bad');
  if (!f.nominal_diajukan) return toast('Nominal wajib diisi.', 'bad');
  if (!f.penerima_nama) return toast('Nama penerima wajib diisi.', 'bad');
  if (!f.lampiran_finance) return toast('Lampiran finance wajib diisi.', 'bad');

  var beban = estimasiBeban(f.nominal_diajukan, f.skema_ppn);
  if (f.item_id && f.sisa !== null && f.sisa !== undefined && beban > f.sisa) {
    return toast('Pagu yang ditahan ' + rp(beban) + ' melebihi sisa ' + rp(f.sisa) + '.', 'bad');
  }
  buka('pgjrev');
}

function kirimPengajuan() {
  if (S.sibuk) return;
  S.sibuk = true;
  var tombol = document.getElementById('btnKirim');
  if (tombol) { tombol.disabled = true; tombol.textContent = 'Mengirim…'; }

  var f = S.form;
  var isi = {
      pembebanan: f.item_id ? 'RAB' : 'NON_RAB',
      rab_item_id: f.item_id || '', coa_id: f.coa_id || '',
      keterangan: f.keterangan, nominal_diajukan: f.nominal_diajukan,
      skema_ppn: f.skema_ppn, tanggal_permohonan: f.tanggal_permohonan,
      tipe_transaksi_id: f.tipe_transaksi_id, tipe_pengajuan: f.tipe_pengajuan,
      tipe_pembayaran_id: f.tipe_pembayaran_nama,
      info_penerima: f.info_penerima, penerima_nama: f.penerima_nama,
      penerima_email: f.penerima_email, bank_penerima: f.bank_penerima,
      no_rekening: f.no_rekening, no_hp: f.no_hp,
      no_cek_bg: f.no_cek_bg, tgl_jatuh_tempo_bg: f.tgl_jatuh_tempo_bg,
      va_biller: f.va_biller, va_nomor: f.va_nomor,
      lampiran_finance: f.lampiran_finance, lampiran_tax: f.lampiran_tax
  };

  // Dokumen yang diminta revisi diperbaiki lewat jalur berbeda: nomornya
  // dipertahankan, versinya naik, dan pagu yang sudah ditahan disesuaikan
  // alih-alih ditahan dua kali.
  var panggilan = f.ajukan_ulang
    ? api('ajukanUlangPengajuan', { pengajuan_id: f.ajukan_ulang, payload: isi })
    : api('kirimPengajuan', { payload: isi });

  panggilan.then(function (r) {
    S.sibuk = false;
    S.stack = [];
    buka('selesai', {
      msg: f.ajukan_ulang ? 'Pengajuan diajukan ulang' : 'Pengajuan terkirim',
      sub: f.ajukan_ulang
        ? 'Nomor ' + r.no_pengajuan + ' tidak berubah. Sekarang menunggu ' + r.menunggu + ' lagi.'
        : 'Nomor ' + r.no_pengajuan + ' sudah terbit. Pagu sebesar ' + rp(r.beban_pagu) +
          ' ditahan sampai dana cair atau pengajuan ditolak. Sekarang menunggu ' + r.menunggu + '.'
    }, false);
  }).catch(function (e) {
    S.sibuk = false;
    if (tombol) { tombol.disabled = false; tombol.textContent = 'Kirim pengajuan'; }
    toast(pesanError(e), 'bad');
  });
}

function mulaiAjukanUlang(id, nominal) {
  S.form = { ajukan_ulang: id, nominal_diajukan: nominal };
  api('getPengajuan', { pengajuan_id: id }).then(function (r) {
    var d = r.header;
    S.form = {
      ajukan_ulang: id, item_id: d.rab_item_id, nama: d.keterangan,
      // Sisa dibiarkan kosong: pagu lama masih ditahan dokumen ini sendiri,
      // jadi angka sisa item tidak menggambarkan batas yang sebenarnya.
      // Server yang memutuskan, dengan menghitung selisihnya saja.
      sisa: null, coa_id: d.coa_id,
      keterangan: d.keterangan, nominal_diajukan: angka(d.nominal_diajukan),
      skema_ppn: d.skema_ppn, tipe_pengajuan: d.tipe_pengajuan,
      info_penerima: d.info_penerima, penerima_nama: d.penerima_nama,
      penerima_email: d.penerima_email, tipe_pembayaran_nama: d.tipe_pembayaran_id,
      bank_penerima: d.bank_penerima, no_rekening: d.no_rekening,
      lampiran_finance: d.lampiran_finance, lampiran_tax: d.lampiran_tax,
      tanggal_permohonan: d.tanggal_permohonan
    };
    buka('pgjform');
  }).catch(function (e) { toast(pesanError(e), 'bad'); });
}

/** Pil status khusus pengajuan dana. */
function pilPgj(status, menunggu) {
  var peta = {
    MENUNGGU_FINANCE: ['p-wait', 'Verifikasi finance'],
    MENUNGGU_TAX: ['p-wait', 'Verifikasi pajak'],
    MENUNGGU_MANAGER: ['p-wait', 'Menunggu manager'],
    MENUNGGU_PENCAIRAN: ['p-wait', 'Menunggu pencairan'],
    SELESAI: ['p-ok', 'Selesai'],
    REVISI: ['p-no', 'Perlu revisi'],
    REJECTED: ['p-no', 'Ditolak']
  };
  var m = peta[status] || ['p-draft', status];
  return '<span class="pill ' + m[0] + '">' + esc(m[1]) + '</span>';
}


/** Membuka formulir cetak di tab baru. Nomor arsip terbit di sana. */
function bukaCetak(id) {
  window.open('cetak.html?id=' + encodeURIComponent(id), '_blank');
}

/* ── Verifikasi bertahap ─────────────────────────────────── */

function pratinjauPajak() {
  var kotak = document.getElementById('hasilPajak');
  if (!kotak) return;
  kotak.innerHTML = '<div class="card"><div class="sm">Menghitung…</div></div>';

  api('hitungPajak', {
    nominal: S.p.nominal, skema_ppn: S.p.skema,
    pajak_ppn_id: (document.getElementById('vPpn') || {}).value || '',
    pajak_pph_id: (document.getElementById('vPph') || {}).value || ''
  }).then(function (h) {
    kotak.innerHTML = '<div class="card">' +
      kv('DPP', '<span class="amt">' + rp(h.dpp) + '</span>') +
      (h.nilai_ppn ? kv('PPN (menambah)',
        '<span class="amt" style="color:var(--green)">+ ' + rp(h.nilai_ppn) + '</span>') : '') +
      kv('Total tagihan', '<span class="amt">' + rp(h.total_tagihan) + '</span>') +
      (h.nilai_pph ? kv('PPh (memotong)',
        '<span class="amt" style="color:var(--red)">&minus; ' + rp(h.nilai_pph) + '</span>') : '') +
      '<div class="hr"></div>' +
      kv('Ditransfer ke penerima', '<span class="amt" style="font-size:14px">' +
        rp(h.bank_out) + '</span>') +
      kv('Beban ke pagu', '<span class="amt">' + rp(h.beban_pagu) + '</span>') +
      '</div>';
  }).catch(function (e) {
    kotak.innerHTML = '<div class="alert a-bad">' + esc(pesanError(e)) + '</div>';
  });
}

/**
 * Mengisi usulan jenis pajak dari status penerima.
 * Hanya usulan — tim pajak tetap yang memutuskan.
 */
function muatUsulPajak_(infoPenerima) {
  var kotak = document.getElementById('usulPajak');
  if (!kotak) return;
  api('usulPajak', { info_penerima: infoPenerima }).then(function (u) {
    kotak.innerHTML = esc(u.alasan) + ' Usulan sudah dipilihkan, silakan ubah bila perlu.';
    var ppn = document.getElementById('vPpn'), pph = document.getElementById('vPph');
    if (ppn && u.pajak_ppn_id) ppn.value = u.pajak_ppn_id;
    if (pph && u.pajak_pph_id) pph.value = u.pajak_pph_id;
    pratinjauPajak();
  }).catch(function () {
    kotak.innerHTML = 'Pilih jenis pajak secara manual.';
    pratinjauPajak();
  });
}

function simpanFinance() {
  if (S.sibuk) return;
  S.sibuk = true;
  api('verifikasiFinance', {
    pengajuan_id: S.p.id,
    data: {
      sumber_dana_id: (document.getElementById('vSumber') || {}).value,
      catatan: (document.getElementById('vCatatan') || {}).value || ''
    }
  }).then(function (r) {
    S.sibuk = false; S.jmlInbox = Math.max(0, (S.jmlInbox || 1) - 1); S.stack = [];
    buka('selesai', { msg: 'Verifikasi finance selesai',
      sub: 'Diteruskan ke ' + (r.current_role || 'tahap berikutnya') + '.' }, false);
  }).catch(function (e) { S.sibuk = false; toast(pesanError(e), 'bad'); });
}

function simpanTax() {
  if (S.sibuk) return;
  S.sibuk = true;
  api('verifikasiTax', {
    pengajuan_id: S.p.id,
    data: {
      pajak_ppn_id: (document.getElementById('vPpn') || {}).value || '',
      pajak_pph_id: (document.getElementById('vPph') || {}).value || '',
      nik_npwp: (document.getElementById('vNik') || {}).value || '',
      bukan_objek_pph: (document.getElementById('vBukanObjek') || {}).checked || false,
      skb: (document.getElementById('vSkb') || {}).checked || false,
      catatan: (document.getElementById('vCatatan') || {}).value || ''
    }
  }).then(function (r) {
    S.sibuk = false; S.jmlInbox = Math.max(0, (S.jmlInbox || 1) - 1); S.stack = [];
    buka('selesai', { msg: 'Verifikasi pajak selesai',
      sub: 'Diteruskan ke ' + (r.current_role || 'tahap berikutnya') + '.' }, false);
  }).catch(function (e) { S.sibuk = false; toast(pesanError(e), 'bad'); });
}

function simpanPencairan() {
  if (S.sibuk) return;
  var bukti = (document.getElementById('vBukti') || {}).value || '';
  if (!bukti.trim()) return toast('Nomor bukti transfer wajib diisi.', 'bad');

  S.sibuk = true;
  api('cairkanDana', {
    pengajuan_id: S.p.id,
    data: {
      tanggal_realisasi: (document.getElementById('vTgl') || {}).value || hariIni_(),
      no_bukti: bukti,
      admin_bank: bacaUang('vAdmin'),
      invoice: (document.getElementById('vInvoice') || {}).value || ''
    }
  }).then(function () {
    S.sibuk = false; S.jmlInbox = Math.max(0, (S.jmlInbox || 1) - 1); S.stack = [];
    buka('selesai', { msg: 'Dana dicairkan',
      sub: 'Pagu yang ditahan sekarang berpindah menjadi realisasi, ' +
        'dan saldo sumber dana sudah berkurang.' }, false);
  }).catch(function (e) { S.sibuk = false; toast(pesanError(e), 'bad'); });
}

function putusPgj(aksi) {
  if (S.sibuk) return;
  var catatan = (document.getElementById('vCatatan') || {}).value || '';
  if (aksi !== 'APPROVE' && !catatan.trim()) {
    return toast('Catatan wajib diisi saat menolak atau meminta revisi.', 'bad');
  }
  S.sibuk = true;
  api('prosesApproval', {
    ref_type: 'PENGAJUAN', ref_id: S.p.id, aksi: aksi, catatan: catatan
  }).then(function (r) {
    S.sibuk = false; S.jmlInbox = Math.max(0, (S.jmlInbox || 1) - 1); S.stack = [];
    var pesan = {
      APPROVE: ['Dokumen disetujui', r.status === 'SELESAI'
        ? 'Seluruh tahap selesai.'
        : 'Diteruskan ke ' + (r.current_role || 'tahap berikutnya') + '.'],
      REVISI: ['Dikembalikan untuk revisi',
        'Pemohon dapat memperbaiki tanpa membuat dokumen baru. Pagu tetap ditahan.'],
      REJECT: ['Dokumen ditolak',
        'Pagu yang ditahan sudah dilepas kembali ke item anggaran.']
    }[aksi];
    buka('selesai', { msg: pesan[0], sub: pesan[1] }, false);
  }).catch(function (e) { S.sibuk = false; toast(pesanError(e), 'bad'); });
}

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
    kv('Versi server', esc(S.boot.versi)) +
    kv('Versi tampilan', esc(KONFIG.BUILD)) +
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
