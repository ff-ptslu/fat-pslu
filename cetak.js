/* ════════════════════════════════════════════════════════════
   FAT — cetak.js
   Menyusun formulir permohonan dana untuk dicetak.

   Tata letaknya sengaja meniru formulir yang sudah dipakai, sampai
   posisi kotak dan urutan barisnya, agar orang yang menandatangani
   tidak perlu menyesuaikan diri dengan bentuk baru.

   Halaman dibuka lewat cetak.html?id=<pengajuan_id> dari layar detail.
   ════════════════════════════════════════════════════════════ */

function paramId() {
  var m = String(location.search).match(/[?&]id=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function kotakCentang(aktif, label, miring) {
  return '<span class="pilihan"><span class="cb">' + (aktif ? 'X' : '&nbsp;') + '</span>' +
    '<span' + (miring ? ' class="miring"' : '') + '>' + esc(label) + '</span></span>';
}

/** Baris berlabel dengan garis bawah, seperti isian formulir kertas. */
function baris(label, isi, lebarLabel) {
  return '<tr><td class="lb"' + (lebarLabel ? ' style="width:' + lebarLabel + '"' : '') + '>' +
    esc(label) + '</td><td class="ttk">:</td>' +
    '<td class="isian">' + (isi || '&nbsp;') + '</td></tr>';
}

function tglCetak(iso) {
  if (!iso) return '';
  var b = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
           'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var d = String(iso).slice(0, 10).split('-');
  if (d.length < 3) return iso;
  return Number(d[2]) + ' ' + b[Number(d[1]) - 1] + ' ' + d[0];
}

/**
 * Timestamp verifikasi. Yang kosong dibiarkan kosong.
 *
 * Formulir lama mencetak 30/12/1899 untuk kolom yang belum terisi — itu
 * titik nol kalender Sheets, bukan tanggal. Kolom kosong yang terlihat
 * kosong lebih jujur daripada tanggal yang mustahil.
 */
function waktuCetak(iso) {
  if (!iso) return '';
  var t = String(iso);
  if (t.indexOf('1899') > -1 || t.indexOf('1970') === 0) return '';
  var d = t.slice(0, 10).split('-');
  if (d.length < 3) return '';
  return d[2] + '/' + d[1] + '/' + d[0] + ' ' + t.slice(11, 19);
}

function blokOrang(judul, o) {
  if (!o) return '<div class="kepala">' + judul + '</div>';
  return '<div class="kepala">' + judul + '</div>' +
    '<div class="kecil">DETAIL USER :</div>' +
    (o.nip ? '<div class="miring">' + esc(o.nip) + (o.email ? ' - ' + esc(o.email) : '') + '</div>'
           : '<div class="miring">' + esc(o.email || '') + '</div>') +
    '<div class="miring">' + esc(waktuCetak(o.waktu)) + '</div>';
}

function susun(d) {
  var p = d.dokumen;
  var kasbon = String(p.tipe_pengajuan).toUpperCase() === 'KASBON';
  var tipe = String(p.tipe_transaksi_id || '').toUpperCase();
  var bayar = String(p.tipe_pembayaran_id || '').toUpperCase();
  var penerima = String(p.info_penerima || '').toUpperCase();

  var punya = function (teks, cocok) { return teks.indexOf(cocok) > -1; };
  var bruto = Number(p.total_tagihan) || Number(p.nominal_diajukan) || 0;
  var potongan = Number(p.nilai_pph) || 0;
  var dibayar = Number(p.bank_out) || (bruto - potongan);

  var h = '<div class="kertas">';

  h += '<table style="width:100%"><tr>' +
    '<td><div class="judul">FORMULIR PERMOHONAN DANA' + (kasbon ? ' KASBON' : '') + '</div>' +
    '<table class="isi" style="margin-top:5px">' +
    '<tr><td class="lb">Tanggal Permohonan</td><td class="ttk">:</td>' +
    '<td><b>' + esc(tglCetak(p.tanggal_permohonan)) + '</b></td></tr>' +
    '<tr><td class="lb">Kepada</td><td class="ttk">:</td><td><b>FINANCE</b></td></tr>' +
    '</table></td>' +
    '<td style="text-align:right;vertical-align:top;width:80px">' +
    '<img src="logo.png" class="merek" alt="Sahada"></td></tr></table>';

  h += '<div class="kotak"><table style="width:100%"><tr>' +
    '<td style="width:120px;vertical-align:top">' +
    '<span class="kotak-judul">Tipe Transaksi</span><br>' +
    '<span class="kecil miring">(silang salah satu)</span></td>' +
    '<td style="vertical-align:top">' +
    kotakCentang(punya(tipe, 'TAGIHAN'), 'Tagihan') +
    kotakCentang(punya(tipe, 'OVERBOOKING'), 'Overbooking', true) +
    kotakCentang(punya(tipe, 'IKLAN'), 'Iklan') +
    kotakCentang(punya(tipe, 'OPERASIONAL'), 'Operasional') +
    kotakCentang(punya(tipe, 'PAJAK'), 'Pajak') +
    '<br style="line-height:22px">' +
    kotakCentang(punya(tipe, 'PAYROLL'), 'Payroll') +
    kotakCentang(punya(tipe, 'LAINNYA'), 'Transaksi Lainnya', true) +
    '<span class="garis" style="min-width:230px">' + esc(p.tipe_transaksi_lain || '') + '</span>' +
    '</td>' +
    '<td style="width:150px;vertical-align:top">Nomor Bukti&nbsp;:&nbsp;' +
    '<span class="garis" style="min-width:70px">' + esc(p.no_bukti || '') + '</span></td>' +
    '</tr></table></div>';

  h += '<div class="kotak"><table style="width:100%"><tr>' +
    '<td style="width:120px"><span class="kotak-judul">Tipe Pembayaran</span></td>' +
    '<td>' +
    kotakCentang(punya(bayar, 'TUNAI'), 'Tunai') +
    kotakCentang(punya(bayar, 'TRANSFER'), 'Transfer Bank') +
    kotakCentang(punya(bayar, 'CEK') || punya(bayar, 'GIRO'), 'Cek/BG') +
    kotakCentang(punya(bayar, 'VIRTUAL'), 'Virtual Account') +
    kotakCentang(false, 'Lainnya') +
    '&nbsp;:&nbsp;<span class="garis" style="min-width:120px"></span>' +
    '</td></tr></table></div>';

  h += '<div class="kotak"><table style="width:100%"><tr>' +
    '<td style="width:56%;vertical-align:top">' +
    '<div class="kotak-judul" style="margin-bottom:4px">Informasi Penerima</div>' +
    '<table class="isi"><tr><td class="lb" style="width:96px">Jenis Penerima</td>' +
    '<td class="ttk">:</td><td>' +
    kotakCentang(penerima === 'PERORANGAN', 'Perorangan') +
    kotakCentang(penerima === 'PERUSAHAAN', 'Perusahaan') +
    kotakCentang(penerima === 'PEMERINTAH', 'Pemerintah') +
    '</td></tr></table>' +
    '<table class="isi" style="margin-top:4px">' +
    baris('Nama', esc(p.penerima_nama), '96px') +
    baris('Bank', esc(p.bank_penerima), '96px') +
    baris('Nomor Rekening / VA', esc(p.no_rekening || p.va_nomor || p.no_hp), '96px') +
    '</table></td>' +
    '<td style="vertical-align:top;padding-left:10px">' +
    '<div class="biru" style="border:1px solid #0033CC;padding:5px 7px;margin-bottom:6px">' +
    'MOHON BUKTI TRANSFER DIKIRIM KE :<br>' +
    '<span style="text-decoration:underline">' +
    esc(p.email_notifikasi || p.penerima_email || p.email_external || '') + '</span></div>' +
    '<table class="isi">' +
    '<tr><td class="lb" style="width:90px">Nominal</td><td class="ttk">:</td>' +
    '<td class="isian">Rp&nbsp;&nbsp;<b>' + rp(p.nominal_diajukan).slice(2) + '</b></td></tr>' +
    '<tr><td class="lb">Berita Transaksi<br>/ Keterangan</td><td class="ttk">:</td>' +
    '<td class="isian">' + esc(p.keterangan) + '</td></tr>' +
    '</table></td></tr></table></div>';

  var bukanObjek = String(p.bukan_objek_pph).toUpperCase() === 'YA';
  var namaPajak = function (id) {
    var m = (S.boot && S.boot.master && S.boot.master.pajak) || [];
    var x = m.filter(function (y) { return y.pajak_id === id; })[0];
    return x ? String(x.nama).toUpperCase() : '';
  };
  var pph = namaPajak(p.pajak_pph_id);
  var adaPpn = String(p.ada_ppn).toUpperCase() === 'YA';

  h += '<div class="kotak"><table style="width:100%"><tr>' +
    '<td style="vertical-align:top">' +
    '<span class="kotak-judul">Verifikasi Pajak</span>' +
    (bukanObjek ? '<span class="merah" style="margin-left:26px">TRANSAKSI BUKAN OBJEK PPH</span>' : '') +
    '<table class="isi" style="margin-top:4px;width:96%">' +
    baris('NIK / NPWP', esc(p.nik_npwp_penerima), '96px') +
    baris('Nilai Pajak Terutang',
      Number(p.nilai_pajak_total) ? rp(p.nilai_pajak_total) : '', '96px') +
    '</table></td>' +
    '<td style="width:190px;vertical-align:top">' +
    kotakCentang(pph.indexOf('21') > -1, 'PPh Pasal 21') +
    kotakCentang(String(p.skb).toUpperCase() === 'YA', 'SKB') +
    '<br style="line-height:20px">' +
    kotakCentang(pph.indexOf('UNIFIKASI') > -1 || pph.indexOf('23') > -1 ||
      pph.indexOf('26') > -1, 'PPh Unifikasi') +
    kotakCentang(adaPpn, 'PPN') +
    '</td>' +
    '<td style="width:150px;vertical-align:top;border-left:1.5px solid #000;padding-left:7px">' +
    '<div class="pusat" style="margin-bottom:4px">VERIFIKASI TAX</div>' +
    (d.tax
      ? '<div class="miring">' + esc(d.tax.nip || '') + '</div>' +
        '<div class="miring">' + esc(d.tax.email || '') + '</div>' +
        '<div class="miring">' + esc(waktuCetak(d.tax.waktu)) + '</div>'
      : '') +
    '</td></tr></table></div>';

  h += '<div class="kotak" style="padding:0">' +
    '<div class="pusat" style="border-bottom:1.5px solid #000;padding:3px">' +
    'INFORMASI SUMBER DANA &amp; PEMBAYARAN</div>' +
    '<table style="width:100%;padding:5px 8px"><tr>' +
    '<td style="width:50%;padding:5px 8px"><table class="isi">' +
    baris('NOMINAL BRUTO', 'Rp&nbsp;&nbsp;' + rp(bruto).slice(2), '110px') +
    baris('POTONGAN', 'Rp&nbsp;&nbsp;' + (potongan ? rp(potongan).slice(2) : ''), '110px') +
    '</table></td>' +
    '<td style="padding:5px 8px"><table class="isi">' +
    baris('REKENING KAS', esc(p.bank_pengirim), '130px') +
    baris('TOTAL YANG DIBAYAR', rp(dibayar).slice(2), '130px') +
    '</table></td></tr></table></div>';

  h += '<div class="tanda">' +
    '<div>' + blokOrang('APPLIED BY SYSTEM', d.pemohon) + '</div>' +
    '<div>' + blokOrang('VERIFED BY SYSTEM', d.finance) + '</div>' +
    '<div><div class="kepala">Pengesahan oleh Atasan</div></div>' +
    '</div>';

  if (p.nomor_cetak) {
    h += '<div class="kecil" style="margin-top:4px;text-align:right">' +
      'No. urut cetak: ' + esc(p.nomor_cetak) +
      ' &middot; cetakan ke-' + esc(p.jumlah_cetak || 1) + '</div>';
  }

  h += '</div>';
  return h;
}

function cetak() { window.print(); }

function mulaiCetak() {
  var id = paramId();
  if (!id) {
    document.getElementById('wadah').innerHTML =
      '<div class="memuat">Nomor pengajuan tidak disertakan pada alamat halaman.</div>';
    return;
  }

  var token = tokenTersimpan_();
  if (!token) {
    document.getElementById('wadah').innerHTML =
      '<div class="memuat">Sesi berakhir. Buka kembali halaman ini dari aplikasi.</div>';
    return;
  }
  S.token = token;

  // Master data dibutuhkan untuk menerjemahkan id pajak menjadi namanya.
  api('bootstrap').then(function (b) {
    S.boot = b;
    return api('catatCetak', { pengajuan_id: id });
  }).then(function () {
    return api('dataCetak', { pengajuan_id: id });
  }).then(function (d) {
    document.getElementById('wadah').innerHTML = susun(d);
    document.getElementById('bar').hidden = false;
    document.getElementById('info').textContent =
      'No. urut ' + (d.dokumen.nomor_cetak || '—') +
      ' · cetakan ke-' + (d.dokumen.jumlah_cetak || 1);
    setTimeout(function () { window.print(); }, 400);
  }).catch(function (e) {
    document.getElementById('wadah').innerHTML =
      '<div class="memuat">Gagal memuat formulir: ' + esc(pesanError(e)) + '</div>';
  });
}

mulaiCetak();
