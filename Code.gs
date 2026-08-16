/****************************************************************
 * Notifikasi Awal Insiden — Backend Google Apps Script
 * Menyimpan data aplikasi ke Google Sheet sebagai "database".
 *
 * CARA PAKAI (ringkas — panduan lengkap ada di chat):
 * 1. Buat Google Sheet baru.
 * 2. Menu: Extensions > Apps Script.
 * 3. Hapus isi Code.gs bawaan, tempel SELURUH kode ini.
 * 4. Ganti nilai SECRET di bawah dengan kata sandi rahasia Anda sendiri.
 * 5. Klik Deploy > New deployment > pilih "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Saat otorisasi, IZINKAN akses Google Drive (untuk simpan foto insiden).
 * 7. Salin "Web app URL", berikan ke aplikasi (menu Setting).
 *
 * CATATAN: foto insiden disimpan sebagai file PRIVAT di folder Drive
 * "Notifikasi Insiden - Foto" dan hanya bisa diambil lewat aksi getPhoto
 * dengan SECRET yang benar. Sheet hanya menyimpan ID foto (pendek).
 ****************************************************************/

// GANTI dengan kunci rahasia buatan Anda (huruf/angka acak, panjang).
// Kunci yang sama harus dimasukkan di aplikasi (Setting > Integrasi Google Sheet).
var SECRET = 'adiputri123';

// Nama-nama sheet (tab) yang dipakai sebagai tabel.
var TABS = {
  incidents: 'incidents',
  users: 'users',
  ccow: 'ccow',
  company: 'company',
  classm: 'classm',
  locm: 'locm',
  meta: 'meta'
};

// Nama folder di Google Drive tempat menyimpan foto insiden.
// Folder dibuat otomatis bila belum ada. File di dalamnya bersifat PRIVAT
// (tidak dibagikan publik) dan hanya bisa diambil lewat aksi 'getPhoto' + SECRET.
var PHOTO_FOLDER = 'Notifikasi Insiden - Foto';

function _photoFolder() {
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(PHOTO_FOLDER);
}

// Simpan foto (data URL base64) -> kembalikan fileId. File tetap privat.
function _savePhoto(dataUrl, name) {
  var m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
  var mime = m ? m[1] : 'image/jpeg';
  var b64 = m ? m[2] : String(dataUrl);
  var bytes = Utilities.base64Decode(b64);
  var blob = Utilities.newBlob(bytes, mime, name || ('foto_' + Date.now()));
  var file = _photoFolder().createFile(blob);
  // biarkan privat (owner saja); akses hanya lewat getPhoto + SECRET
  return file.getId();
}

// Ambil foto berdasarkan fileId -> kembalikan data URL base64.
function _getPhoto(fileId) {
  var file = DriveApp.getFileById(fileId);
  var blob = file.getBlob();
  var b64 = Utilities.base64Encode(blob.getBytes());
  return 'data:' + blob.getContentType() + ';base64,' + b64;
}

function _sheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

// Setiap tabel disimpan sebagai baris: [id, json, json2, json3, ...].
// JSON dipecah per <= 45.000 karakter agar tidak menabrak batas 50.000/sel.
var CELL_MAX = 45000;

function _readTable(name) {
  var sh = _sheet(name);
  var rng = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rng.length; i++) { // baris 0 = header
    // gabungkan kolom 2..n (index 1..) sebagai potongan json
    var parts = [];
    for (var c = 1; c < rng[i].length; c++) {
      if (rng[i][c] !== '' && rng[i][c] != null) parts.push(rng[i][c]);
    }
    var joined = parts.join('');
    if (joined) {
      try { out.push(JSON.parse(joined)); } catch (e) {}
    }
  }
  return out;
}

function _writeTable(name, rows, idField) {
  var sh = _sheet(name);
  sh.clear();
  var maxCols = 2;
  var values = [];
  (rows || []).forEach(function (r) {
    var id = (r && r[idField] != null) ? String(r[idField]) : Utilities.getUuid();
    var json = JSON.stringify(r);
    var row = [id];
    // pecah json menjadi potongan <= CELL_MAX
    for (var p = 0; p < json.length; p += CELL_MAX) {
      row.push(json.substring(p, p + CELL_MAX));
    }
    if (row.length < 2) row.push('');
    if (row.length > maxCols) maxCols = row.length;
    values.push(row);
  });
  // header
  var header = ['id'];
  for (var h = 1; h < maxCols; h++) header.push('json' + h);
  // ratakan panjang tiap baris
  values.forEach(function (row) { while (row.length < maxCols) row.push(''); });
  sh.getRange(1, 1, 1, maxCols).setValues([header]);
  if (values.length) {
    sh.getRange(2, 1, values.length, maxCols).setValues(values);
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Merge dua array berdasar idField; jika bentrok, updatedAt terbaru menang.
function _merge(serverRows, clientRows, idField) {
  var map = {};
  function put(r) {
    if (!r) return;
    var id = String(r[idField] != null ? r[idField] : '');
    if (!id) { id = Utilities.getUuid(); r[idField] = id; }
    var ex = map[id];
    if (!ex) { map[id] = r; return; }
    var a = ex.updatedAt || ex.createdAt || '';
    var b = r.updatedAt || r.createdAt || '';
    map[id] = (b >= a) ? r : ex; // yang lebih baru menang
  }
  (serverRows || []).forEach(put);
  (clientRows || []).forEach(put);
  return Object.keys(map).map(function (k) { return map[k]; });
}

function doGet(e) {
  return _handle(e);
}
function doPost(e) {
  return _handle(e);
}

function _handle(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (err) {}
    }
    var secret = body.secret || params.secret || '';
    var action = body.action || params.action || 'ping';

    if (secret !== SECRET) {
      return _json({ ok: false, error: 'UNAUTHORIZED' });
    }

    if (action === 'ping') {
      return _json({ ok: true, message: 'connected' });
    }

    if (action === 'uploadPhoto') {
      // body: { photos: [ {name, data(dataURL)} , ... ] } -> kembalikan [fileId,...]
      var arr = body.photos || [];
      var ids = arr.map(function (p) { return _savePhoto(p.data, p.name); });
      return _json({ ok: true, ids: ids });
    }

    if (action === 'getPhoto') {
      // body: { ids: [fileId,...] } -> kembalikan { fileId: dataURL, ... }
      var wanted = body.ids || [];
      var out = {};
      wanted.forEach(function (id) {
        try { out[id] = _getPhoto(id); } catch (e) { out[id] = ''; }
      });
      return _json({ ok: true, photos: out });
    }

    if (action === 'pull') {
      return _json({
        ok: true,
        data: {
          incidents: _readTable(TABS.incidents),
          users: _readTable(TABS.users),
          ccow: _readTable(TABS.ccow),
          company: _readTable(TABS.company),
          classm: _readTable(TABS.classm),
          locm: _readTable(TABS.locm)
        }
      });
    }

    if (action === 'sync') {
      // gabungkan data client dengan yang di server, lalu simpan hasil merge.
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        var c = body.data || {};

        var incidents = _merge(_readTable(TABS.incidents), c.incidents, 'id');
        _writeTable(TABS.incidents, incidents, 'id');

        var users = _merge(_readTable(TABS.users), c.users, 'id');
        _writeTable(TABS.users, users, 'id');

        var ccow = _merge(_readTable(TABS.ccow), c.ccow, 'id');
        _writeTable(TABS.ccow, ccow, 'id');

        var company = _merge(_readTable(TABS.company), c.company, 'id');
        _writeTable(TABS.company, company, 'id');

        // classm & locm berupa daftar string sederhana -> gabung & unikkan
        var classm = _mergeStrings(_readStringsSafe(TABS.classm), c.classm);
        _writeStrings(TABS.classm, classm);

        var locm = _mergeStrings(_readStringsSafe(TABS.locm), c.locm);
        _writeStrings(TABS.locm, locm);

        return _json({
          ok: true,
          data: {
            incidents: incidents,
            users: users,
            ccow: ccow,
            company: company,
            classm: classm,
            locm: locm
          }
        });
      } finally {
        lock.releaseLock();
      }
    }

    return _json({ ok: false, error: 'UNKNOWN_ACTION' });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

// ---- helper khusus daftar string (classm, locm) ----
function _readStringsSafe(name) {
  try {
    var sh = _sheet(name);
    var rng = sh.getDataRange().getValues();
    var out = [];
    for (var i = 1; i < rng.length; i++) { // baris 0 = header
      if (rng[i][0] !== '' && rng[i][0] != null) out.push(String(rng[i][0]));
    }
    return out;
  } catch (e) { return []; }
}
function _mergeStrings(serverArr, clientArr) {
  var seen = {};
  var out = [];
  function add(v) {
    if (v == null) return;
    var t = String(v).trim();
    if (!t) return;
    var k = t.toLowerCase();
    if (!seen[k]) { seen[k] = true; out.push(t); }
  }
  (serverArr || []).forEach(add);
  (clientArr || []).forEach(add);
  return out;
}
function _writeStrings(name, arr) {
  var sh = _sheet(name);
  sh.clear();
  sh.getRange(1, 1, 1, 1).setValues([['value']]);
  if (arr && arr.length) {
    sh.getRange(2, 1, arr.length, 1).setValues(arr.map(function (v) { return [v]; }));
  }
}
