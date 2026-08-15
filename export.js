/* ============================================================
   Tahseely — data exchange
   (lazy XLSX, Excel export, JSON backup/restore, Excel import)
   ============================================================ */

let xlsxLoadPromise = null;

function ensureXLSX(){
  if (window.XLSX) return Promise.resolve();
  if (xlsxLoadPromise) return xlsxLoadPromise;
  xlsxLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => resolve();
    script.onerror = () => { xlsxLoadPromise = null; reject(new Error('تعذر تحميل مكتبة الإكسيل')); };
    document.head.appendChild(script);
  });
  return xlsxLoadPromise;
}

/* ----- Excel export ----- */
function getExportFiltered(){
  let filtered = transactions;
  if (exportClient !== 'all') filtered = filtered.filter(t => t.clientId === exportClient);
  if (exportPeriodType === 'day') filtered = filtered.filter(t => t.date === exportDay);
  else if (exportPeriodType === 'month') filtered = filtered.filter(t => t.date.slice(0,7) === exportMonth);
  else if (exportPeriodType === 'year') filtered = filtered.filter(t => t.date.slice(0,4) === String(exportYear));
  return filtered;
}

function buildFileName(){
  const clientPart = exportClient === 'all' ? 'كل_العملاء' : ((clients.find(c => c.id === exportClient) || {}).name || 'عميل').replace(/\s+/g, '_');
  let periodPart = 'الكل';
  if (exportPeriodType === 'day') periodPart = exportDay;
  else if (exportPeriodType === 'month') periodPart = exportMonth;
  else if (exportPeriodType === 'year') periodPart = String(exportYear);
  return 'تحصيل_' + clientPart + '_' + periodPart + '.xlsx';
}

function periodLabel(){
  if (exportPeriodType === 'day') return fmtDateHuman(exportDay);
  if (exportPeriodType === 'month') return exportMonth;
  if (exportPeriodType === 'year') return String(exportYear);
  return 'كل الفترات';
}

async function doExport(){
  try { await ensureXLSX(); }
  catch (e) { alert('تعذر تحميل مكتبة الإكسيل. تأكد إن الإنترنت شغال وجرّب تاني.'); return; }

  // لو العميل المختار سابقًا اتحذف، ارجع تلقائيًا لكل العملاء بدل ما يطلع ملف فاضي
  if (exportClient !== 'all' && !clients.some(c => c.id === exportClient)) {
    exportClient = 'all';
  }

  const filtered = getExportFiltered();

  // حدد قائمة العملاء المطلوب إظهارهم: عميل واحد فقط أو كل العملاء
  const clientsToShow = exportClient === 'all' ? sortedClients() : clients.filter(c => c.id === exportClient);
  if (clientsToShow.length === 0) { alert('لا يوجد عملاء مسجلين لتصديرهم. أضف عميل أولاً من تبويب العملاء.'); return; }

  const rows = clientsToShow.map(c => {
    const ct = filtered.filter(t => t.clientId === c.id);
    const totalSent = ct.reduce((s,t) => s + t.amountSent, 0);
    const totalCollected = ct.reduce((s,t) => s + txPaid(t), 0);
    const totalPending = totalSent - totalCollected;
    return {
      'اسم العميل': c.name,
      'اسم المحل': c.storeName || '-',
      'رقم المكنة': c.machineNumber || '-',
      'المنطقة': c.location || '-',
      'العنوان': c.address || '-',
      'رقم الهاتف': c.phone || '-',
      [('الرصيد المرسل (' + periodLabel() + ')')]: totalSent,
      'تم تحصيله': totalCollected,
      'المتبقي': totalPending
    };
  });

  const grandTotalSent = rows.reduce((s,r) => s + r['الرصيد المرسل (' + periodLabel() + ')'], 0);
  const grandTotalCollected = rows.reduce((s,r) => s + r['تم تحصيله'], 0);
  const grandTotalPending = rows.reduce((s,r) => s + r['المتبقي'], 0);
  const totalRow = {
    'اسم العميل': 'الإجمالي',
    'رقم المكنة': '',
    'المنطقة': '',
    'العنوان': '',
    'رقم الهاتف': '',
    ['الرصيد المرسل (' + periodLabel() + ')']: grandTotalSent,
    'تم تحصيله': grandTotalCollected,
    'المتبقي': grandTotalPending
  };

  const ws = XLSX.utils.json_to_sheet(rows.concat([totalRow]));
  ws['!cols'] = [{wch:22},{wch:14},{wch:18},{wch:24},{wch:15},{wch:22},{wch:14},{wch:14}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'التحصيل');
  const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  const blob = new Blob([wbout], {type:'application/octet-stream'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = buildFileName();
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ----- Full JSON backup / restore ----- */
const BACKUP_FOLDER = 'تحصيل احتياطي';

function buildBackupFileName(){
  return BACKUP_FOLDER + '/نسخة_احتياطية_' + todayStr() + '_' + Date.now() + '.json';
}

function doBackupExport(){
  try {
    const payload = {
      app: 'تحصيل',
      version: 1,
      exportedAt: new Date().toISOString(),
      clients, transactions, areas
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildBackupFileName();
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('تعذر إنشاء النسخة الاحتياطية');
  }
}

function triggerRestoreBackup(){
  const el = document.getElementById('restore-backup-input');
  if (el) el.click();
}

function handleRestoreBackup(event){
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !Array.isArray(data.clients) || !Array.isArray(data.transactions)) {
        alert('ملف النسخة الاحتياطية غير صالح أو تالف');
        event.target.value = '';
        return;
      }
      const summary = 'هذه النسخة تحتوي على:\n'
        + data.clients.length + ' عميل\n'
        + data.transactions.length + ' معاملة\n'
        + (Array.isArray(data.areas) ? data.areas.length : 0) + ' منطقة\n\n'
        + 'استعادتها ستستبدل كل البيانات الحالية في التطبيق بالكامل. متابعة؟';
      if (!confirm(summary)) { event.target.value = ''; return; }
      clients = data.clients || [];
      transactions = data.transactions || [];
      areas = Array.isArray(data.areas) ? data.areas : [];
      saveData();
      render();
      alert('تم استعادة النسخة الاحتياطية بنجاح');
    } catch (err) {
      alert('تعذر قراءة الملف. تأكد أنه ملف نسخة احتياطية صحيح (JSON).');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

/* ----- Import from Excel ----- */
function triggerImport(){
  const el = document.getElementById('import-file-input');
  if (el) el.click();
}

async function handleImportFile(event){
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try { await ensureXLSX(); }
  catch (e) { alert('تعذر تحميل مكتبة الإكسيل. تأكد إن الإنترنت شغال وجرّب تاني.'); event.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function(e){
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type: 'array'});
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {defval: ''});
      importClientsFromRows(rows);
    } catch (err) {
      alert('تعذر قراءة الملف. تأكد أنه ملف إكسيل صحيح (xlsx أو xls).');
    }
    event.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}

function getImportField(row, possibleNames){
  const keys = Object.keys(row);
  for (const wanted of possibleNames) {
    const foundKey = keys.find(k => String(k).trim() === wanted);
    if (foundKey != null && String(row[foundKey]).trim() !== '') return String(row[foundKey]).trim();
  }
  return '';
}

function importClientsFromRows(rows){
  if (!rows || rows.length === 0) { alert('الملف لا يحتوي على بيانات'); return; }
  let added = 0, updated = 0, skipped = 0;
  rows.forEach(row => {
    const name = getImportField(row, ['اسم العميل', 'الاسم', 'اسم', 'Name', 'name']);
    if (!name) { skipped++; return; }
    const storeName = getImportField(row, ['اسم المحل', 'المحل', 'اسم المتجر', 'المتجر', 'Store', 'Store Name', 'Shop', 'Shop Name']);
    const machineNumber = getImportField(row, ['رقم المكنة', 'رقم الماكينة', 'المكنة', 'Machine', 'Machine Number']);
    const location = getImportField(row, ['المنطقة', 'Area', 'Region']);
    const address = getImportField(row, ['العنوان', 'الموقع', 'Address', 'Location']);
    const phone = getImportField(row, ['رقم الهاتف', 'الهاتف', 'تليفون', 'Phone']);

    const existing = clients.find(c =>
      c.name.trim() === name && (!machineNumber || (c.machineNumber || '') === machineNumber)
    );

    if (location && !areas.some(a => a.name === location)) {
      areas.push({id: uid('a'), name: location});
    }

    if (existing) {
      existing.storeName = storeName || existing.storeName;
      existing.machineNumber = machineNumber || existing.machineNumber;
      existing.location = location || existing.location;
      existing.address = address || existing.address;
      existing.phone = phone || existing.phone;
      updated++;
    } else {
      clients.push({id: uid('c'), name, storeName, machineNumber, location, address, phone, createdAt: todayStr()});
      added++;
    }
  });
  saveData();
  render();
  let msg = 'تم الاستيراد بنجاح:\n' + added + ' عميل جديد تمت إضافته';
  if (updated > 0) msg += '\n' + updated + ' عميل موجود تم تحديث بياناته';
  if (skipped > 0) msg += '\n' + skipped + ' صف تم تجاهله (بدون اسم عميل)';
  alert(msg);
}
