/* ════════════════════════════════════════════════════════════
   FAT — backoffice.js
   Antrian verifikasi untuk Finance, Tax, FAT Manager, Kasir, dan lainnya.

   Bergantung pada api.js yang harus dimuat lebih dulu (KONFIG, S, api,
   token, esc, rp, rpk, tgl, waktu, toast, pesanError, kartuGalat).

   Prinsip pembagian aksi massal vs individu:
     - Approve yang TIDAK butuh data tambahan (RAB di tahap mana pun,
       pengajuan dana di tahap FAT Manager) -> boleh massal.
     - Approve yang WAJIB menetapkan data (Finance atas pengajuan dana
       perlu sumber dana, Tax perlu jenis pajak, Kasir perlu nomor bukti)
       -> harus satu per satu, supaya tidak ada data yang diisi sembarang
       demi mempercepat proses massal.
     - Revisi dan Tolak selalu satu per satu, karena catatannya semestinya
       spesifik untuk tiap dokumen.
   ════════════════════════════════════════════════════════════ */

var BO = { tab: '', daftar: [], terpilih: {}, buka: {}, sumberMassal: '' };

var URUTAN_TAB = ['HC', 'MANAGER_DIVISI', 'FINANCE', 'TAX', 'FAT_MANAGER', 'KASIR', 'CEO'];
var NAMA_TAB = {
  HC: 'HC', MANAGER_DIVISI: 'Manager divisi', FINANCE: 'Finance', TAX: 'Pajak',
  FAT_MANAGER: 'FAT Manager', KASIR: 'Kasir', CEO: 'CEO'
};

/* ── Masuk ───────────────────────────────────────────────── */

function terimaKredensial(resp) {
  var token = resp && resp.credential;
  if (!token) return layarMasuk('Google tidak mengirim token. Coba lagi.');
  simpanToken_(token);
  muatBackoffice();
}

function siapkanGoogle() {
  if (!window.google || !google.accounts || !google.accounts.id) {
    return setTimeout(siapkanGoogle, 200);
  }
  google.accounts.id.initialize({
    client_id: KONFIG.CLIENT_ID, callback: terimaKredensial,
    auto_select: true, cancel_on_tap_outside: false
  });
  var box = document.getElementById('gbox');
  if (box) {
    google.accounts.id.renderButton(box, {
      theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'id'
    });
  }
  google.accounts.id.prompt();
}

function layarMasuk(pesan) {
  document.getElementById('shell').hidden = true;
  document.getElementById('masukWadah').innerHTML =
    '<div class="bo-masuk">' +
    '<div class="merek-besar"><img src="logo.png" alt="Sahada"></div>' +
    '<h2>FAT Backoffice</h2><div class="ket">PT Sahada Laku Utama</div>' +
    (pesan ? '<div class="bo-alert bo-a-warn" style="max-width:300px">' + esc(pesan) + '</div>' : '') +
    '<div id="gbox"></div>' +
    '<div class="xs" style="margin-top:16px;color:var(--faint)">Untuk Finance, Tax, FAT Manager, dan Kasir.</div>' +
    '</div>';
  siapkanGoogle();
}

function keluar(otomatis) {
  try { if (window.google) google.accounts.id.disableAutoSelect(); } catch (e) { }
  hapusToken_();
  BO = { tab: '', daftar: [], terpilih: {}, buka: {}, sumberMassal: '' };
  layarMasuk(otomatis ? 'Sesi berakhir. Masuk lagi untuk melanjutkan.' : null);
}

/* ── Pemuatan ────────────────────────────────────────────── */

function muatBackoffice() {
  document.getElementById('masukWadah').innerHTML = '';
  document.getElementById('shell').hidden = false;
  document.getElementById('main').innerHTML = '<div class="bo-loading"><div class="spin"></div><p>Memuat data…</p></div>';

  api('bootstrap').then(function (b) {
    S.boot = b;
    document.getElementById('namaAkun').textContent = b.pengguna.nama;
    return muatUlangAntrian();
  }).catch(function (e) {
    if (e.kode === 'PENGGUNA_TIDAK_TERDAFTAR') {
      document.getElementById('shell').hidden = true;
      document.getElementById('masukWadah').innerHTML =
        '<div class="bo-masuk"><div class="merek-besar"><img src="logo.png" alt="Sahada"></div>' +
        '<h2>Akun belum terdaftar</h2><div class="ket">Hubungi administrator FAT untuk meminta akses.</div>' +
        '<button class="bo-btn ghost" onclick="keluar(false)">Masuk dengan akun lain</button></div>';
      return;
    }
    document.getElementById('main').innerHTML = kartuGalatBo_(e);
  });
}

function muatUlangAntrian() {
  return api('listInbox', {}).then(function (daftar) {
    BO.daftar = daftar;
    var grup = kelompokkan_(daftar);
    var tabAda = URUTAN_TAB.filter(function (t) { return grup[t] && grup[t].length; });

    if (!tabAda.length) {
      document.getElementById('nav').innerHTML = '';
      document.getElementById('main').innerHTML =
        '<div class="bo-panel"><div class="bo-empty"><div class="big">&#10003;</div>' +
        'Tidak ada dokumen yang menunggu Anda.</div></div>';
      return;
    }
    if (tabAda.indexOf(BO.tab) < 0) BO.tab = tabAda[0];
    BO.terpilih = {};
    gambarNav_(grup, tabAda);
    gambarTab_(grup[BO.tab]);
  }).catch(function (e) {
    document.getElementById('main').innerHTML = kartuGalatBo_(e);
  });
}

function kelompokkan_(daftar) {
  var rolesSaya = (S.boot && S.boot.pengguna.roles) || [];
  var grup = {};
  daftar.forEach(function (x) {
    var token = String(x.current_role).split(',')
      .map(function (s) { return s.trim(); })
      .filter(function (r) { return rolesSaya.indexOf(r) > -1; })[0];
    if (!token) return;
    (grup[token] = grup[token] || []).push(x);
  });
  return grup;
}

function gambarNav_(grup, tabAda) {
  document.getElementById('nav').innerHTML = tabAda.map(function (t) {
    return '<button class="' + (t === BO.tab ? 'on' : '') + '" onclick="pindahTab(\'' + t + '\')">' +
      esc(NAMA_TAB[t] || t) + '<span class="n">' + grup[t].length + '</span></button>';
  }).join('');
}

function pindahTab(t) {
  BO.tab = t; BO.terpilih = {}; BO.buka = {};
  var grup = kelompokkan_(BO.daftar);
  gambarNav_(grup, URUTAN_TAB.filter(function (x) { return grup[x] && grup[x].length; }));
  gambarTab_(grup[t] || []);
}

/* ── Tampilan tab ────────────────────────────────────────── */

function gambarTab_(items) {
  var main = document.getElementById('main');

  if (BO.tab === 'FINANCE') {
    var rab = items.filter(function (x) { return x.modul === 'RAB'; });
    var pgj = items.filter(function (x) { return x.modul === 'PENGAJUAN'; });
    main.innerHTML = ringkasBo_(items) +
      (rab.length ? panelBulk_('rab', 'RAB menunggu verifikasi finance', rab, true) : '') +
      (pgj.length ? panelFinancePengajuan_(pgj) : '');
  } else if (BO.tab === 'TAX' || BO.tab === 'KASIR') {
    main.innerHTML = ringkasBo_(items) + panelIndividu_(items);
  } else {
    main.innerHTML = ringkasBo_(items) + panelBulk_('umum', NAMA_TAB[BO.tab] || BO.tab, items, true);
  }
}

function ringkasBo_(items) {
  var total = items.reduce(function (a, x) { return a + angkaBo_(x.nominal); }, 0);
  return '<div class="bo-ringkas">' +
    '<div class="kk"><div class="n">' + items.length + '</div><div class="l">Dokumen menunggu</div></div>' +
    '<div class="kk"><div class="n">' + rpk(total) + '</div><div class="l">Total nominal</div></div>' +
    '</div>';
}

function angkaBo_(v) { return Number(v) || 0; }

/* ── Panel dengan checkbox dan aksi massal ──────────────── */

function panelBulk_(kunci, judul, items, bolehMassal) {
  var terpilih = items.filter(function (x) { return BO.terpilih[kunci + ':' + x.id]; });
  var semuaTercentang = items.length > 0 && terpilih.length === items.length;

  var h = '<div class="bo-panel"><div class="bo-panel-h">' +
    '<h3>' + esc(judul) + '</h3><span class="sub">' + items.length + ' dokumen</span></div>';

  h += '<table class="bo-table"><thead><tr>' +
    (bolehMassal ? '<th class="cb"><input type="checkbox" ' + (semuaTercentang ? 'checked' : '') +
      ' onchange="centangSemua(\'' + kunci + '\',this.checked)"></th>' : '') +
    '<th>Nomor</th><th>Keterangan</th><th>Pemohon</th><th style="text-align:right">Nominal</th>' +
    '<th class="aksi">Aksi</th></tr></thead><tbody>';

  items.forEach(function (x) {
    var id = kunci + ':' + x.id;
    h += '<tr>' +
      (bolehMassal ? '<td class="cb"><input type="checkbox" ' + (BO.terpilih[id] ? 'checked' : '') +
        ' onchange="centangSatu(\'' + kunci + '\',\'' + x.id + '\',this.checked)"></td>' : '') +
      '<td><div class="mono-id">' + esc(x.no) + '</div>' +
      '<span class="bo-pill bo-p-info" style="margin-top:3px">' + esc(x.modul) + '</span></td>' +
      '<td>' + esc(x.judul) + '</td>' +
      '<td>' + esc(x.pemohon) + '</td>' +
      '<td class="num">' + rp(x.nominal) + '</td>' +
      '<td class="aksi"><button class="bo-btn ghost sm" onclick="bukaBaris(\'' + x.modul +
      '\',\'' + x.id + '\')">Buka</button></td>' +
      '</tr>';
    if (BO.buka[x.modul + ':' + x.id]) {
      h += '<tr><td colspan="6" style="padding:0"><div id="detail-' + x.modul + '-' + x.id + '">' +
        '<div class="bo-detail"><div class="sub">Memuat…</div></div></div></td></tr>';
    }
  });

  h += '</tbody></table>';

  if (bolehMassal) {
    h += '<div class="bo-bar">' +
      '<span class="info">' + terpilih.length + ' dipilih' +
      (terpilih.length ? ' · ' + rp(terpilih.reduce(function (a, x) { return a + angkaBo_(x.nominal); }, 0)) : '') +
      '</span>' +
      '<button class="bo-btn ok" ' + (terpilih.length ? '' : 'disabled') +
      ' onclick="jalankanBulkApprove(\'' + kunci + '\')">Setujui ' + terpilih.length + ' dokumen</button>' +
      '</div>';
  }
  h += '</div>';

  items.forEach(function (x) {
    if (BO.buka[x.modul + ':' + x.id]) muatDetail_(x.modul, x.id);
  });
  return h;
}

/**
 * Tahap Finance atas pengajuan dana. Bulk tetap tersedia, tetapi wajib
 * satu sumber dana yang sama untuk seluruh dokumen terpilih — approve
 * di tahap ini SELALU menempuh verifikasiFinance, tidak pernah lewat
 * approve generik, supaya bank_pengirim tidak pernah tertinggal kosong.
 */
function panelFinancePengajuan_(items) {
  var kunci = 'pgj';
  var terpilih = items.filter(function (x) { return BO.terpilih[kunci + ':' + x.id]; });
  var semuaTercentang = items.length > 0 && terpilih.length === items.length;
  var sd = (S.boot && S.boot.master.sumber_dana) || [];

  var h = '<div class="bo-panel"><div class="bo-panel-h">' +
    '<h3>Pengajuan dana menunggu verifikasi finance</h3>' +
    '<span class="sub">' + items.length + ' dokumen &middot; approve di sini menetapkan sumber dana</span></div>';

  h += '<table class="bo-table"><thead><tr>' +
    '<th class="cb"><input type="checkbox" ' + (semuaTercentang ? 'checked' : '') +
    ' onchange="centangSemua(\'' + kunci + '\',this.checked)"></th>' +
    '<th>Nomor</th><th>Keterangan</th><th>Pemohon</th><th style="text-align:right">Beban pagu</th>' +
    '<th class="aksi">Aksi</th></tr></thead><tbody>';

  items.forEach(function (x) {
    var id = kunci + ':' + x.id;
    h += '<tr>' +
      '<td class="cb"><input type="checkbox" ' + (BO.terpilih[id] ? 'checked' : '') +
      ' onchange="centangSatu(\'' + kunci + '\',\'' + x.id + '\',this.checked)"></td>' +
      '<td><div class="mono-id">' + esc(x.no) + '</div></td>' +
      '<td>' + esc(x.judul) + '</td>' +
      '<td>' + esc(x.pemohon) + '</td>' +
      '<td class="num">' + rp(x.nominal) + '</td>' +
      '<td class="aksi"><button class="bo-btn ghost sm" onclick="bukaBaris(\'PENGAJUAN\',\'' + x.id + '\')">Buka</button></td>' +
      '</tr>';
    if (BO.buka['PENGAJUAN:' + x.id]) {
      h += '<tr><td colspan="6" style="padding:0"><div id="detail-PENGAJUAN-' + x.id + '">' +
        '<div class="bo-detail"><div class="sub">Memuat…</div></div></div></td></tr>';
    }
  });

  h += '</tbody></table>';

  h += '<div class="bo-bar">' +
    '<span class="info">' + terpilih.length + ' dipilih</span>' +
    '<select id="sumberBulk" onchange="BO.sumberMassal=this.value">' +
    '<option value="">— pilih sumber dana —</option>' +
    sd.map(function (s) {
      return '<option value="' + s.sumber_id + '"' + (BO.sumberMassal === s.sumber_id ? ' selected' : '') +
        '>' + esc(s.nama) + '</option>';
    }).join('') + '</select>' +
    '<button class="bo-btn ok" ' + (terpilih.length && BO.sumberMassal ? '' : 'disabled') +
    ' onclick="jalankanBulkFinance()">Verifikasi ' + terpilih.length + ' dokumen</button>' +
    '</div></div>';

  items.forEach(function (x) {
    if (BO.buka['PENGAJUAN:' + x.id]) muatDetail_('PENGAJUAN', x.id);
  });
  return h;
}

/** Panel tanpa checkbox untuk tahap yang wajib diproses satu per satu. */
function panelIndividu_(items) {
  var h = '<div class="bo-panel"><div class="bo-panel-h">' +
    '<h3>' + esc(NAMA_TAB[BO.tab]) + '</h3>' +
    '<span class="sub">' + items.length +
    ' dokumen &middot; diproses satu per satu karena butuh data khusus</span></div>';

  h += '<table class="bo-table"><thead><tr>' +
    '<th>Nomor</th><th>Keterangan</th><th>Pemohon</th><th style="text-align:right">Nominal</th>' +
    '<th class="aksi">Aksi</th></tr></thead><tbody>';

  items.forEach(function (x) {
    h += '<tr><td><div class="mono-id">' + esc(x.no) + '</div></td>' +
      '<td>' + esc(x.judul) + '</td><td>' + esc(x.pemohon) + '</td>' +
      '<td class="num">' + rp(x.nominal) + '</td>' +
      '<td class="aksi"><button class="bo-btn ghost sm" onclick="bukaBaris(\'PENGAJUAN\',\'' + x.id + '\')">Buka</button></td></tr>';
    if (BO.buka['PENGAJUAN:' + x.id]) {
      h += '<tr><td colspan="5" style="padding:0"><div id="detail-PENGAJUAN-' + x.id + '">' +
        '<div class="bo-detail"><div class="sub">Memuat…</div></div></div></td></tr>';
    }
  });
  h += '</tbody></table></div>';

  items.forEach(function (x) {
    if (BO.buka['PENGAJUAN:' + x.id]) muatDetail_('PENGAJUAN', x.id);
  });
  return h;
}

/* ── Pilihan baris ───────────────────────────────────────── */

function centangSatu(kunci, id, nilai) {
  BO.terpilih[kunci + ':' + id] = nilai;
  refreshTab_();
}
function centangSemua(kunci, nilai) {
  var grup = kelompokkan_(BO.daftar);
  (grup[BO.tab] || []).forEach(function (x) {
    var cocokKunci = kunci === 'pgj' ? x.modul === 'PENGAJUAN'
      : kunci === 'rab' ? x.modul === 'RAB' : true;
    if (cocokKunci) BO.terpilih[kunci + ':' + x.id] = nilai;
  });
  refreshTab_();
}
function refreshTab_() {
  var grup = kelompokkan_(BO.daftar);
  gambarTab_(grup[BO.tab] || []);
}

function bukaBaris(modul, id) {
  var kunci = modul + ':' + id;
  BO.buka[kunci] = !BO.buka[kunci];
  refreshTab_();
}

/* ── Aksi massal ─────────────────────────────────────────── */

function daftarTerpilih_(kunci) {
  return BO.daftar.filter(function (x) { return BO.terpilih[kunci + ':' + x.id]; });
}

function jalankanBulkApprove(kunci) {
  var pilih = daftarTerpilih_(kunci);
  if (!pilih.length) return;

  api('prosesApprovalMassal', {
    daftar: pilih.map(function (x) { return { ref_type: x.modul, ref_id: x.id }; }),
    aksi: 'APPROVE', catatan: ''
  }).then(function (r) {
    laporkanHasilMassal_(r, pilih.length);
    return muatUlangAntrian();
  }).catch(function (e) { toast(pesanError(e), 'bad'); });
}

function jalankanBulkFinance() {
  var pilih = daftarTerpilih_('pgj');
  if (!pilih.length || !BO.sumberMassal) return;

  api('verifikasiFinanceMassal', {
    daftar: pilih.map(function (x) { return x.id; }),
    data: { sumber_dana_id: BO.sumberMassal }
  }).then(function (r) {
    laporkanHasilMassal_(r, pilih.length);
    BO.sumberMassal = '';
    return muatUlangAntrian();
  }).catch(function (e) { toast(pesanError(e), 'bad'); });
}

function laporkanHasilMassal_(r, total) {
  var ok = (r.berhasil || []).length, gagal = (r.gagal || []).length;
  if (gagal === 0) {
    toast(ok + ' dokumen berhasil diproses.', 'good');
  } else {
    toast(ok + ' berhasil, ' + gagal + ' gagal — ' +
      r.gagal.slice(0, 2).map(function (g) { return pesanError(g); }).join('; ') +
      (gagal > 2 ? ', dan lainnya' : '') + '.', 'bad');
  }
}

/* ── Detail satu dokumen ─────────────────────────────────── */

function muatDetail_(modul, id) {
  var target = document.getElementById('detail-' + modul + '-' + id);
  if (!target) return;

  var pemanggil = modul === 'RAB' ? api('getRab', { rab_id: id }) : api('getPengajuan', { pengajuan_id: id });
  pemanggil.then(function (r) {
    target.innerHTML = modul === 'RAB' ? detailRab_(id, r) : detailPengajuan_(id, r);
  }).catch(function (e) {
    target.innerHTML = '<div class="bo-detail"><div class="bo-alert bo-a-bad">' +
      esc(pesanError(e)) + '</div></div>';
  });
}

function detailRab_(id, r) {
  var h = r.header;
  return '<div class="bo-detail"><div class="grid2">' +
    '<div><div class="kv"><span>Judul</span><span>' + esc(h.judul) + '</span></div>' +
    '<div class="kv"><span>Divisi</span><span>' + esc(namaDivisiBo_(h.divisi_id)) + '</span></div>' +
    '<div class="kv"><span>Periode</span><span>' + esc(h.periode) + '</span></div>' +
    '<div class="kv"><span>Total pagu</span><span>' + rp(r.rekap.pagu) + '</span></div></div>' +
    '<div><div class="fld"><label>Catatan <span style="font-weight:400">— wajib untuk revisi/tolak</span></label>' +
    '<textarea id="cat-RAB-' + id + '" rows="2"></textarea></div>' +
    '<div style="display:flex;gap:8px">' +
    '<button class="bo-btn ok" onclick="putusIndividu(\'RAB\',\'' + id + '\',\'APPROVE\')">Setujui</button>' +
    '<button class="bo-btn ghost" onclick="putusIndividu(\'RAB\',\'' + id + '\',\'REVISI\')">Revisi</button>' +
    '<button class="bo-btn no" onclick="putusIndividu(\'RAB\',\'' + id + '\',\'REJECT\')">Tolak</button>' +
    '</div></div></div></div>';
}

function detailPengajuan_(id, r) {
  var d = r.header;
  var tahap = String(d.current_role).split(',')[0];

  var h = '<div class="bo-detail"><div class="grid2"><div>' +
    '<div class="kv"><span>Nominal diajukan</span><span>' + rp(d.nominal_diajukan) + '</span></div>' +
    '<div class="kv"><span>Penerima</span><span>' + esc(d.penerima_nama) + ' (' + esc(d.info_penerima) + ')</span></div>' +
    (d.bank_penerima ? '<div class="kv"><span>Bank</span><span>' + esc(d.bank_penerima) + ' ' + esc(d.no_rekening) + '</span></div>' : '') +
    (d.rab_item_id ? '<div class="kv"><span>Sumber anggaran</span><span class="mono-id">' + esc(d.rab_item_id) + '</span></div>' : '') +
    '<div class="kv"><span>Pagu ditahan</span><span>' + rp(d.beban_pagu) + '</span></div>' +
    (d.lampiran_finance ? '<div class="kv"><span>Lampiran finance</span><span><a href="' +
      esc(d.lampiran_finance) + '" target="_blank">buka</a></span></div>' : '') +
    (d.lampiran_tax ? '<div class="kv"><span>Lampiran tax</span><span><a href="' +
      esc(d.lampiran_tax) + '" target="_blank">buka</a></span></div>' : '') +
    (bolehCetakBo_(d.status) ? '<button class="bo-btn ghost sm" style="margin-top:8px" ' +
      'onclick="window.open(\'cetak.html?id=' + id + '\',\'_blank\')">Cetak formulir' +
      (Number(d.jumlah_cetak) ? ' (sudah ' + d.jumlah_cetak + '&times;)' : '') + '</button>' : '') +
    '</div><div id="formTahap-' + id + '">' + formTahap_(tahap, id, d) + '</div></div></div>';
  return h;
}

function formTahap_(tahap, id, d) {
  if (tahap === 'FINANCE') {
    var sd = (S.boot && S.boot.master.sumber_dana) || [];
    return '<div class="fld"><label>Sumber dana</label><select id="fdSumber-' + id + '">' +
      sd.map(function (s) { return '<option value="' + s.sumber_id + '">' + esc(s.nama) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="fld"><label>Catatan</label><textarea id="cat-PENGAJUAN-' + id + '" rows="2"></textarea></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="bo-btn ok" onclick="simpanFinanceSatu(\'' + id + '\')">Verifikasi</button>' +
      '<button class="bo-btn ghost" onclick="putusIndividu(\'PENGAJUAN\',\'' + id + '\',\'REVISI\')">Revisi</button>' +
      '<button class="bo-btn no" onclick="putusIndividu(\'PENGAJUAN\',\'' + id + '\',\'REJECT\')">Tolak</button></div>';
  }

  if (tahap === 'TAX') {
    var pajak = (S.boot && S.boot.master.pajak) || [];
    var ppn = pajak.filter(function (p) { return p.jenis === 'PPN'; });
    var pph = pajak.filter(function (p) { return p.jenis === 'PPH'; });
    return '<div class="fld"><label>Jenis PPN</label><select id="txPpn-' + id + '" onchange="pratinjauPajakBo(\'' + id + '\')">' +
      '<option value="">Tanpa PPN</option>' +
      ppn.map(function (p) { return '<option value="' + p.pajak_id + '">' + esc(p.nama) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="fld"><label>Jenis PPh</label><select id="txPph-' + id + '" onchange="pratinjauPajakBo(\'' + id + '\')">' +
      '<option value="">Tanpa PPh</option>' +
      pph.map(function (p) { return '<option value="' + p.pajak_id + '">' + esc(p.nama) + '</option>'; }).join('') +
      '</select></div>' +
      '<div id="hasilPajakBo-' + id + '"></div>' +
      '<div class="fld"><label>NIK / NPWP penerima</label><input id="txNik-' + id + '" value="' + esc(d.nik_npwp_penerima || '') + '"></div>' +
      '<div class="fld"><label>Catatan</label><textarea id="cat-PENGAJUAN-' + id + '" rows="2"></textarea></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="bo-btn ok" onclick="simpanTaxSatu(\'' + id + '\')">Verifikasi</button>' +
      '<button class="bo-btn ghost" onclick="putusIndividu(\'PENGAJUAN\',\'' + id + '\',\'REVISI\')">Revisi</button>' +
      '<button class="bo-btn no" onclick="putusIndividu(\'PENGAJUAN\',\'' + id + '\',\'REJECT\')">Tolak</button></div>';
  }

  if (tahap === 'KASIR') {
    return '<div class="bo-alert bo-a-info">Ditransfer ke penerima ' +
      rp(d.bank_out || d.nominal_diajukan) + ' dari ' + esc(d.bank_pengirim) + '.</div>' +
      '<div class="fld"><label>Tanggal realisasi</label><input type="date" id="ksTgl-' + id + '" value="' + hariIniBo_() + '"></div>' +
      '<div class="fld"><label>Nomor bukti transfer</label><input id="ksBukti-' + id + '"></div>' +
      '<div class="fld"><label>Biaya admin bank</label><input id="ksAdmin-' + id + '" inputmode="numeric" placeholder="Rp0" oninput="formatUangBo(this)"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="bo-btn ok" onclick="simpanKasirSatu(\'' + id + '\')">Catat pencairan</button>' +
      '<button class="bo-btn ghost" onclick="putusIndividu(\'PENGAJUAN\',\'' + id + '\',\'REVISI\')">Revisi</button>' +
      '<button class="bo-btn no" onclick="putusIndividu(\'PENGAJUAN\',\'' + id + '\',\'REJECT\')">Tolak</button></div>';
  }

  // FAT_MANAGER dan tahap generik lain: cukup setuju/revisi/tolak.
  return '<div class="fld"><label>Catatan</label><textarea id="cat-PENGAJUAN-' + id + '" rows="2"></textarea></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="bo-btn ok" onclick="putusIndividu(\'PENGAJUAN\',\'' + id + '\',\'APPROVE\')">Setujui</button>' +
    '<button class="bo-btn ghost" onclick="putusIndividu(\'PENGAJUAN\',\'' + id + '\',\'REVISI\')">Revisi</button>' +
    '<button class="bo-btn no" onclick="putusIndividu(\'PENGAJUAN\',\'' + id + '\',\'REJECT\')">Tolak</button></div>';
}

function hariIniBo_() { return new Date().toISOString().slice(0, 10); }

/** Sama seperti aturan di app.js: cetak baru berguna sejak tahap manager. */
function bolehCetakBo_(status) {
  return ['MENUNGGU_MANAGER', 'MENUNGGU_PENCAIRAN', 'SELESAI'].indexOf(status) > -1;
}

function formatUangBo(el) {
  var digit = String(el.value).replace(/\D/g, '');
  el.value = digit ? 'Rp' + Number(digit).toLocaleString('id-ID') : '';
}
function bacaUangBo_(id) {
  var el = document.getElementById(id);
  return el ? Number(String(el.value).replace(/\D/g, '')) || 0 : 0;
}

function namaDivisiBo_(id) {
  var d = ((S.boot && S.boot.master.divisi) || []).filter(function (x) { return x.divisi_id === id; })[0];
  return d ? d.nama : id;
}

function pratinjauPajakBo(id) {
  var d = BO.daftar.filter(function (x) { return x.id === id; })[0];
  var kotak = document.getElementById('hasilPajakBo-' + id);
  if (!kotak) return;
  kotak.innerHTML = '<div class="sub">Menghitung…</div>';

  api('hitungPajak', {
    nominal: angkaBo_(d && d.nominal), skema_ppn: (d && d.skema_ppn) || 'NON_PPN',
    pajak_ppn_id: (document.getElementById('txPpn-' + id) || {}).value || '',
    pajak_pph_id: (document.getElementById('txPph-' + id) || {}).value || ''
  }).then(function (h) {
    kotak.innerHTML = '<div class="kv"><span>DPP</span><span>' + rp(h.dpp) + '</span></div>' +
      (h.nilai_ppn ? '<div class="kv"><span>PPN</span><span>+ ' + rp(h.nilai_ppn) + '</span></div>' : '') +
      (h.nilai_pph ? '<div class="kv"><span>PPh</span><span>&minus; ' + rp(h.nilai_pph) + '</span></div>' : '') +
      '<div class="kv"><span><b>Ditransfer</b></span><span><b>' + rp(h.bank_out) + '</b></span></div>';
  }).catch(function (e) { kotak.innerHTML = '<div class="bo-alert bo-a-bad">' + esc(pesanError(e)) + '</div>'; });
}

/* ── Aksi individu ───────────────────────────────────────── */

function simpanFinanceSatu(id) {
  var sumber = (document.getElementById('fdSumber-' + id) || {}).value;
  if (!sumber) return toast('Pilih sumber dana lebih dulu.', 'bad');
  api('verifikasiFinance', {
    pengajuan_id: id,
    data: { sumber_dana_id: sumber, catatan: (document.getElementById('cat-PENGAJUAN-' + id) || {}).value || '' }
  }).then(function () {
    toast('Verifikasi finance selesai.', 'good');
    return muatUlangAntrian();
  }).catch(function (e) { toast(pesanError(e), 'bad'); });
}

function simpanTaxSatu(id) {
  api('verifikasiTax', {
    pengajuan_id: id,
    data: {
      pajak_ppn_id: (document.getElementById('txPpn-' + id) || {}).value || '',
      pajak_pph_id: (document.getElementById('txPph-' + id) || {}).value || '',
      nik_npwp: (document.getElementById('txNik-' + id) || {}).value || '',
      catatan: (document.getElementById('cat-PENGAJUAN-' + id) || {}).value || ''
    }
  }).then(function () {
    toast('Verifikasi pajak selesai.', 'good');
    return muatUlangAntrian();
  }).catch(function (e) { toast(pesanError(e), 'bad'); });
}

function simpanKasirSatu(id) {
  var bukti = (document.getElementById('ksBukti-' + id) || {}).value || '';
  if (!bukti.trim()) return toast('Nomor bukti transfer wajib diisi.', 'bad');
  api('cairkanDana', {
    pengajuan_id: id,
    data: {
      tanggal_realisasi: (document.getElementById('ksTgl-' + id) || {}).value || hariIniBo_(),
      no_bukti: bukti, admin_bank: bacaUangBo_('ksAdmin-' + id)
    }
  }).then(function () {
    toast('Pencairan tercatat.', 'good');
    return muatUlangAntrian();
  }).catch(function (e) { toast(pesanError(e), 'bad'); });
}

function putusIndividu(modul, id, aksi) {
  var catatan = (document.getElementById('cat-' + modul + '-' + id) || {}).value || '';
  if (aksi !== 'APPROVE' && !catatan.trim()) {
    return toast('Catatan wajib diisi saat menolak atau meminta revisi.', 'bad');
  }
  api('prosesApproval', { ref_type: modul, ref_id: id, aksi: aksi, catatan: catatan })
    .then(function () {
      toast('Dokumen diproses.', 'good');
      return muatUlangAntrian();
    }).catch(function (e) { toast(pesanError(e), 'bad'); });
}

/* ── Galat ───────────────────────────────────────────────── */

function kartuGalatBo_(e) {
  return '<div class="bo-panel"><div style="padding:20px">' +
    '<div class="bo-alert bo-a-bad">' + esc(pesanError(e)) + '</div>' +
    '<button class="bo-btn ghost" onclick="muatBackoffice()">Coba lagi</button></div></div>';
}

/* ── Mulai ───────────────────────────────────────────────── */

if (KONFIG.CLIENT_ID.indexOf('GANTI') === 0 || KONFIG.API_URL.indexOf('GANTI') === 0) {
  document.getElementById('masukWadah').innerHTML =
    '<div class="bo-alert bo-a-bad" style="margin:20px">Aplikasi belum dikonfigurasi. ' +
    'Isi API_URL dan CLIENT_ID di api.js.</div>';
} else {
  var tokenAda = tokenTersimpan_();
  if (tokenAda) { S.token = tokenAda; muatBackoffice(); }
  else { layarMasuk(null); }
}
