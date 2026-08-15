/* ============================================================
   Tahseely — rendering
   (buildApp + all HTML builders for every tab and modal)
   ============================================================ */

function render(){
  const active = document.activeElement;
  const activeId = active && active.id;
  const selStart = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
  const selEnd = active && typeof active.selectionEnd === 'number' ? active.selectionEnd : null;

  document.getElementById('root').innerHTML = buildApp();

  if (activeId) {
    const el = document.getElementById(activeId);
    if (el) {
      el.focus();
      if (selStart != null && el.setSelectionRange) { try { el.setSelectionRange(selStart, selEnd); } catch (e) {} }
    }
  }
}

/* ----- App shell ----- */
function buildApp(){
  return '<div class="app-shell">'
    + buildHeader()
    + '<div class="body">' + (tab === 'daily' ? buildDailyTab() : tab === 'clients' ? buildClientsTab() : tab === 'areas' ? buildAreasTab() : tab === 'followup' ? buildFollowupTab() : buildExportTab()) + '</div>'
    + buildBottomNav()
    + '</div>'
    + (showClientModal ? buildClientModal() : '')
    + (amountModalClientId ? buildAmountModal() : '')
    + (payModalTxId ? buildPayModal() : '')
    + (editTxId ? buildEditTxModal() : '')
    + (showAreaModal ? buildAreaModal() : '');
}

/* ----- Header ----- */
function buildPctBadge(pct){
  return '<div class="pct-digital" title="نسبة تحصيل اليوم">'
    + '<span class="pct-digital-icon">' + ICON.chart + '</span>'
    + '<span class="pct-digital-info"><span class="pct-digital-label">محصّل</span><span class="pct-digital-value">' + pct + '%</span></span>'
    + '</div>';
}

function buildHeader(){
  const stats = computeStats(getDayTx());
  const overall = computeStats(transactions);
  return '<div class="header"><div class="header-top">'
    + '<div class="brand-logo">' + ICON.logo + '</div>'
    + '<div style="flex:1"><div class="brand-title">Tahseely</div><div class="brand-sub">' + fmtDateHuman(selectedDate) + '</div></div>'
    + buildPctBadge(stats.pct)
    + (overall.pending > 0 ? '<button class="header-alert" onclick="setTab(\'followup\')">' + fmtMoney(overall.pending) + '</button>' : '')
    + '<button class="theme-toggle" onclick="toggleTheme()" title="تبديل الوضع النهاري والليلي">' + (getTheme() === 'dark' ? '☀️' : '🌙') + '</button>'
    + '</div>'
    + '<div class="h-stats">'
    + '<div class="h-stat"><div class="h-stat-label">إجمالي اليوم</div><div class="h-stat-value">' + fmtMoney(stats.total) + '</div></div>'
    + '<div class="h-stat ok"><div class="h-stat-label">محصّل</div><div class="h-stat-value">' + fmtMoney(stats.collected) + '</div></div>'
    + '<div class="h-stat warn"><div class="h-stat-label">متبقي</div><div class="h-stat-value">' + fmtMoney(stats.pending) + '</div></div>'
    + '</div>'
    + '</div>';
}

/* ----- Shared bits ----- */
function buildOverdueBadge(c){
  const pend = clientPendingTotal(c.id);
  return pend > 0 ? '<div class="client-meta" style="color:var(--danger-text);font-weight:700">⚠️ متأخر عليه: ' + fmtMoney(pend) + '</div>' : '';
}

function buildLocationSortBar(){
  if (locatingInProgress) return '<div class="tour-btn" style="opacity:.7">📍 جاري تحديد موقعك...</div>';
  if (myLocation) return '<button class="tour-btn" onclick="refreshMyLocation(false)">📍 القائمة مرتبة حسب الأقرب لموقعك — تحديث</button>';
  return '<button class="tour-btn" onclick="refreshMyLocation(false)">📍 فعّل تحديد الموقع لترتيب العملاء حسب الأقرب</button>';
}

function buildAreaFilterSelect(){
  if (areas.length === 0) return '';
  return '<select class="select-field" style="margin-top:8px" onchange="setAreaFilter(this.value)">'
    + '<option value="all"' + (areaFilter === 'all' ? ' selected' : '') + '>كل المناطق</option>'
    + sortedAreas().map(a => '<option value="' + esc(a.name) + '" ' + (areaFilter === a.name ? 'selected' : '') + '>' + esc(a.name) + '</option>').join('')
    + '</select>';
}

/* ----- Daily (التحصيل) tab ----- */
function buildDailyTab(){
  const stats = computeStats(getDayTx());
  const list = filteredClientList();
  return '<div class="date-bar">'
    + '<button class="date-arrow" onclick="shiftDate(1)">&#8250;</button>'
    + '<div style="flex:1;text-align:center">'
    + '<input id="date-input" type="date" value="' + selectedDate + '" onchange="setSelectedDate(this.value)" class="date-input">'
    + '<div class="date-human">' + fmtDateHuman(selectedDate) + '</div></div>'
    + '<button class="date-arrow" onclick="shiftDate(-1)">&#8249;</button>'
    + '</div>'
    + '<div class="search-row"><span style="color:var(--muted);display:flex">' + ICON.search + '</span> <input id="search-input" placeholder="ابحث بالاسم أو رقم المكنة..." value="' + esc(search) + '" oninput="setSearch(this.value)" class="search-input">'
    + '<button class="add-client-btn" onclick="openNewClient()">+</button></div>'
    + buildAreaFilterSelect()
    + '<div class="segment-row" style="margin-top:8px">'
    + '<button class="' + (!onlyDebtors ? 'segment-btn-active' : 'segment-btn') + '" onclick="setOnlyDebtors(false)">كل العملاء</button>'
    + '<button class="' + (onlyDebtors ? 'segment-btn-active' : 'segment-btn') + '" onclick="setOnlyDebtors(true)">💸 عليهم متأخرات</button>'
    + '</div>'
    + buildLocationSortBar()
    + '<button class="tour-btn" onclick="startTour()">🧭 ابدأ جولة لعملاء هذه القائمة</button>'
    + '<div id="search-results">' + buildDailyResultsHTML(list) + '</div>';
}

function buildDailyResultsHTML(list){
  return (list.length === 0 ? '<div class="empty-state">لا يوجد عملاء بعد. أضف أول عميل لبدء التحصيل.</div>' : '')
    + '<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">'
    + list.map(buildClientDailyCard).join('')
    + '</div>';
}

function buildClientDailyCard(c){
  const txs = transactions.filter(t => t.clientId === c.id && t.date === selectedDate);
  const lastAmt = lastAmountForClient(c.id);
  const due = clientPendingTotal(c.id);
  return '<div class="client-card"><div class="client-card-top">'
    + '<div class="client-info">'
    + (c.storeName ? '<div class="client-store">' + esc(c.storeName) + '</div>' : '')
    + '<div class="client-name">' + esc(c.name) + '</div>'
    + (c.machineNumber ? '<div class="client-machine">' + ICON.machine + ' ' + esc(c.machineNumber) + '</div>' : '')
    + (c.location ? '<div class="client-meta">' + ICON.pin + ' ' + esc(c.location) + '</div>' : '')
    + (c.phone ? '<div class="phone-row"><span class="client-meta" style="margin-top:0">' + ICON.phone + ' ' + esc(c.phone) + '</span>'
        + '<a href="tel:' + esc(c.phone) + '" class="phone-action" title="اتصال" onclick="event.stopPropagation()">' + ICON.phone + '</a>'
        + '<a href="' + waLink(c.phone) + '" target="_blank" class="phone-action" style="color:#25D366" title="واتساب" onclick="event.stopPropagation()">' + ICON.wa + '</a>'
        + '</div>' : '')
    + buildOverdueBadge(c)
    + '</div>'
    + '<div class="client-due">' + (due > 0 ? '<div class="due-amount">' + fmtMoney(due) + '</div><div class="due-label">متبقي</div>' : '<div class="due-ok">✓</div>') + '</div>'
    + '</div>'
    + '<div class="send-btn-col">'
    + '<button class="send-btn" onclick="openAmountModal(\'' + c.id + '\')">+ إرسال مبلغ</button>'
    + (lastAmt ? '<button class="quick-btn" onclick="quickCollect(\'' + c.id + '\')" title="تسجيل نفس آخر مبلغ فورًا">⚡ ' + fmtMoney(lastAmt) + '</button>' : '')
    + '</div>'
    + (txs.length > 0 ? '<div class="tx-list">' + txs.map(buildTxRow).join('') + '</div>' : '')
    + '</div>';
}

function buildTxRow(t){
  const paid = txPaid(t);
  const pending = txPending(t);
  const done = pending <= 0;
  return '<div class="tx-row"><div class="tx-amount">' + fmtMoney(t.amountSent) + '</div>'
    + (t.notes ? '<div class="tx-note">' + esc(t.notes) + '</div>' : '')
    + (paid > 0 ? '<div class="tx-note" style="font-weight:700;color:var(--accent)">' + (done ? 'مدفوع بالكامل ✓' : 'مدفوع ' + fmtMoney(paid)) + (pending > 0 ? ' · متبقي ' + fmtMoney(pending) : '') + '</div>' : '')
    + '<div style="flex:1"></div>'
    + (done
        ? '<button class="collected-pill" onclick="openPayModal(\'' + t.id + '\')">✓ تم التحصيل</button>'
        : '<button class="pending-pill" onclick="collectFull(\'' + t.id + '\')">قيد الانتظار</button>'
          + '<button class="quick-btn" onclick="openPayModal(\'' + t.id + '\')" title="تحصيل مبلغ جزئي">' + ICON.coin + ' جزء</button>')
    + '<button class="icon-btn" onclick="openEditTx(\'' + t.id + '\')" title="تعديل">' + ICON.edit + '</button>'
    + '<button class="trash-btn" onclick="deleteTransaction(\'' + t.id + '\')" title="حذف">' + ICON.trash + '</button>'
    + '</div>';
}

/* ----- Clients (العملاء) tab ----- */
function buildClientsTab(){
  const list = filteredClientList();
  return '<div class="search-row">🔍 <input id="search-input" placeholder="ابحث بالاسم أو رقم المكنة..." value="' + esc(search) + '" oninput="setSearch(this.value)" class="search-input">'
    + '<button class="add-client-btn" title="استيراد من إكسيل" onclick="triggerImport()">📥</button>'
    + '<button class="add-client-btn" onclick="openNewClient()">+</button></div>'
    + '<input id="import-file-input" type="file" accept=".xlsx,.xls" style="display:none" onchange="handleImportFile(event)">'
    + buildAreaFilterSelect()
    + buildLocationSortBar()
    + '<div id="search-results">' + buildClientsResultsHTML(list) + '</div>';
}

function buildClientsResultsHTML(list){
  return (list.length === 0 ? '<div class="empty-state">لا يوجد عملاء بعد. اضغط + لإضافة عميل جديد، أو 📥 لاستيراد قائمة من إكسيل.</div>' : '')
    + '<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">'
    + list.map(buildClientRow).join('')
    + '</div>';
}

function buildClientRow(c){
  const ct = transactions.filter(t => t.clientId === c.id);
  const totalSent = ct.reduce((s,t) => s + t.amountSent, 0);
  const totalPending = ct.reduce((s,t) => s + txPending(t), 0);
  return '<div class="client-card"><div class="client-card-top">'
    + '<div class="client-info">'
    + (c.storeName ? '<div class="client-store">' + esc(c.storeName) + '</div>' : '')
    + '<div class="client-name">' + esc(c.name) + '</div>'
    + (c.machineNumber ? '<div class="client-machine">' + ICON.machine + ' ' + esc(c.machineNumber) + '</div>' : '')
    + (c.location ? '<div class="client-meta">' + ICON.pin + ' ' + esc(c.location) + '</div>' : '')
    + buildOverdueBadge(c)
    + '</div>'
    + '<div style="display:flex;gap:6px;align-items:flex-start">'
    + '<button class="icon-btn" onclick="openEditClient(\'' + c.id + '\')" title="تعديل">' + ICON.edit + '</button>'
    + '<button class="icon-btn-danger" onclick="deleteClient(\'' + c.id + '\')" title="حذف">' + ICON.trash + '</button>'
    + '</div>'
    + '</div>'
    + '<div class="client-footer"><span>إجمالي المرسل: <b>' + fmtMoney(totalSent) + '</b></span>'
    + '<span style="color:' + (totalPending > 0 ? 'var(--amber)' : 'var(--accent)') + '">المتبقي: <b>' + fmtMoney(totalPending) + '</b></span></div>'
    + '</div>';
}

/* ----- Areas (المناطق) tab ----- */
function buildAreasTab(){
  const list = sortedAreas();
  return '<div class="section-title">المناطق</div>'
    + '<div class="search-row"><div style="flex:1;font-size:12px;color:var(--hint)">سجّل مناطقك هنا، وهتظهر كاختيار عند إضافة أو تعديل أي عميل</div>'
    + '<button class="add-client-btn" onclick="openNewArea()">+</button></div>'
    + (list.length === 0 ? '<div class="empty-state">لا توجد مناطق مسجلة بعد. اضغط + لإضافة أول منطقة.</div>' : '')
    + '<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">'
    + list.map(buildAreaRow).join('')
    + '</div>';
}

function buildAreaRow(a){
  const count = clients.filter(c => c.location === a.name).length;
  return '<div class="client-card"><div class="client-card-head"><div>'
    + '<div class="client-name">🗺️ ' + esc(a.name) + '</div>'
    + '<div class="client-meta">👥 ' + count + ' عميل مرتبط بهذه المنطقة</div>'
    + '</div><div style="display:flex;gap:6px">'
    + '<button class="icon-btn" onclick="openEditArea(\'' + a.id + '\')">✎</button>'
    + '<button class="icon-btn-danger" onclick="deleteArea(\'' + a.id + '\')">🗑</button>'
    + '</div></div></div>';
}

/* ----- Follow-up (المتابعة) tab ----- */
function buildFollowupTab(){
  let filtered = transactions.slice();
  if (followupFilter === 'pending') filtered = filtered.filter(t => txPending(t) > 0);
  else if (followupFilter === 'collected') filtered = filtered.filter(t => txPending(t) <= 0);

  const byClient = {};
  filtered.forEach(t => {
    if (!byClient[t.clientId]) byClient[t.clientId] = [];
    byClient[t.clientId].push(t);
  });
  const rows = Object.keys(byClient).map(cid => {
    const c = clients.find(x => x.id === cid);
    const txs = byClient[cid].slice().sort((a,b) => b.date.localeCompare(a.date));
    const totalSent = txs.reduce((s,t) => s + t.amountSent, 0);
    const totalPending = txs.reduce((s,t) => s + txPending(t), 0);
    return {client: c, clientId: cid, txs, totalSent, totalPending};
  }).sort((a,b) => b.totalPending - a.totalPending);

  const grandTotal = followupFilter === 'pending'
    ? filtered.reduce((s,t) => s + txPending(t), 0)
    : filtered.reduce((s,t) => s + txPaid(t), 0);

  return '<div class="section-title">المتابعة</div>'
    + '<div class="segment-row">'
    + '<button class="' + (followupFilter === 'pending' ? 'segment-btn-active' : 'segment-btn') + '" onclick="setFollowupFilter(\'pending\')">لم يتم التحصيل</button>'
    + '<button class="' + (followupFilter === 'collected' ? 'segment-btn-active' : 'segment-btn') + '" onclick="setFollowupFilter(\'collected\')">تم التحصيل</button>'
    + '<button class="' + (followupFilter === 'all' ? 'segment-btn-active' : 'segment-btn') + '" onclick="setFollowupFilter(\'all\')">الكل</button>'
    + '</div>'
    + '<div class="preview-box"><div>عدد المعاملات: <b>' + filtered.length + '</b></div>'
    + '<div>الإجمالي: <b>' + fmtMoney(grandTotal) + '</b></div></div>'
    + (rows.length === 0 ? '<div class="empty-state">لا توجد معاملات مطابقة لهذا الفلتر.</div>' : '')
    + '<div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">'
    + rows.map(buildFollowupClientCard).join('')
    + '</div>';
}

function buildFollowupClientCard(row){
  const c = row.client;
  const name = c ? c.name : 'عميل محذوف';
  const showTotal = followupFilter === 'collected' ? row.totalSent : row.totalPending;
  const color = followupFilter === 'collected' ? 'var(--accent)' : 'var(--amber)';
  return '<div class="client-card"><div class="client-card-top">'
    + '<div class="client-info">'
    + (c && c.storeName ? '<div class="client-store">' + esc(c.storeName) + '</div>' : '')
    + '<div class="client-name">' + esc(name) + '</div>'
    + (c && c.machineNumber ? '<div class="client-machine">' + ICON.machine + ' ' + esc(c.machineNumber) + '</div>' : '')
    + (c && c.location ? '<div class="client-meta">' + ICON.pin + ' ' + esc(c.location) + '</div>' : '')
    + '</div><div class="client-due"><div class="due-amount" style="color:' + color + '">' + fmtMoney(showTotal) + '</div></div>'
    + '</div>'
    + '<div class="tx-list">' + row.txs.map(buildFollowupTxRow).join('') + '</div>'
    + '</div>';
}

function buildFollowupTxRow(t){
  const paid = txPaid(t);
  const pending = txPending(t);
  const done = pending <= 0;
  return '<div class="tx-row"><div class="tx-note" style="font-weight:700;color:var(--text)">' + fmtDateHuman(t.date) + '</div>'
    + '<div class="tx-amount">' + fmtMoney(t.amountSent) + '</div>'
    + (t.notes ? '<div class="tx-note">' + esc(t.notes) + '</div>' : '')
    + (paid > 0 ? '<div class="tx-note" style="font-weight:700;color:var(--accent)">مدفوع ' + fmtMoney(paid) + '</div>' : '')
    + (pending > 0 ? '<div class="tx-note" style="font-weight:700;color:var(--amber)">متبقي ' + fmtMoney(pending) + '</div>' : '')
    + '<div style="flex:1"></div>'
    + (done
        ? '<button class="collected-pill">✓ تم</button>'
        : '<button class="pending-pill" onclick="collectFull(\'' + t.id + '\')">قيد الانتظار</button>'
          + '<button class="quick-btn" onclick="openPayModal(\'' + t.id + '\')" title="تحصيل مبلغ جزئي">' + ICON.coin + ' جزء</button>')
    + '<button class="icon-btn" onclick="openEditTx(\'' + t.id + '\')" title="تعديل">' + ICON.edit + '</button>'
    + '</div>';
}

/* ----- Export (التقارير) tab ----- */
function buildExportTab(){
  const filtered = getExportFiltered();
  const total = filtered.reduce((s,t) => s + t.amountSent, 0);
  const clientOptions = sortedClients().map(c => '<option value="' + c.id + '" ' + (exportClient === c.id ? 'selected' : '') + '>' + esc(c.name) + '</option>').join('');
  return '<div class="section-title">تصدير بيانات إلى Excel</div>'
    + '<label class="field-label">العميل</label>'
    + '<select class="select-field" onchange="setExportClient(this.value)">'
    + '<option value="all" ' + (exportClient === 'all' ? 'selected' : '') + '>كل العملاء</option>' + clientOptions
    + '</select>'
    + '<label class="field-label">الفترة</label>'
    + '<div class="segment-row">'
    + '<button class="' + (exportPeriodType === 'day' ? 'segment-btn-active' : 'segment-btn') + '" onclick="setExportPeriodType(\'day\')">يوم</button>'
    + '<button class="' + (exportPeriodType === 'month' ? 'segment-btn-active' : 'segment-btn') + '" onclick="setExportPeriodType(\'month\')">شهر</button>'
    + '<button class="' + (exportPeriodType === 'year' ? 'segment-btn-active' : 'segment-btn') + '" onclick="setExportPeriodType(\'year\')">سنة</button>'
    + '<button class="' + (exportPeriodType === 'all' ? 'segment-btn-active' : 'segment-btn') + '" onclick="setExportPeriodType(\'all\')">الكل</button>'
    + '</div>'
    + (exportPeriodType === 'day' ? '<input type="date" class="select-field" value="' + exportDay + '" onchange="setExportDay(this.value)">' : '')
    + (exportPeriodType === 'month' ? '<input type="month" class="select-field" value="' + exportMonth + '" onchange="setExportMonth(this.value)">' : '')
    + (exportPeriodType === 'year' ? '<input id="export-year-input" type="number" class="select-field" value="' + exportYear + '" onchange="setExportYear(this.value)">' : '')
    + '<div class="preview-box"><div>عدد المعاملات المطابقة: <b>' + filtered.length + '</b></div>'
    + '<div>الإجمالي: <b>' + fmtMoney(total) + '</b></div></div>'
    + '<button class="export-btn" onclick="doExport()">⬇ تصدير ملف Excel</button>'
    + '<div class="section-title" style="margin-top:22px">نسخة احتياطية كاملة</div>'
    + '<div style="font-size:12px;color:var(--hint);margin-bottom:10px;line-height:1.6">'
    + 'نسخة احتياطية بكل بيانات التطبيق (العملاء، المعاملات، المناطق) في ملف واحد، تقدر تستخدمها لاسترجاع بياناتك لو حصل أي مشكلة أو غيّرت جهازك. تتنزل داخل مجلد "' + BACKUP_FOLDER + '" جوّه التنزيلات.'
    + '</div>'
    + '<button class="export-btn" style="background:var(--accent);color:var(--accent-ink)" onclick="doBackupExport()">💾 تنزيل نسخة احتياطية</button>'
    + '<button class="export-btn" style="background:var(--panel);color:var(--accent);border:1.5px solid var(--accent-border);margin-top:8px" onclick="triggerRestoreBackup()">♻️ استعادة من نسخة احتياطية</button>'
    + '<input id="restore-backup-input" type="file" accept="application/json,.json" style="display:none" onchange="handleRestoreBackup(event)">';
}

/* ----- Bottom navigation ----- */
function buildBottomNav(){
  const navs = [
    {id:'daily', label:'التحصيل', icon:'calendar'},
    {id:'clients', label:'العملاء', icon:'users'},
    {id:'followup', label:'المتابعة', icon:'bell'},
    {id:'areas', label:'المناطق', icon:'map'},
    {id:'export', label:'التقارير', icon:'chart'}
  ];
  return '<div class="bottom-nav">'
    + navs.map(n => '<button class="' + (tab === n.id ? 'nav-btn-active' : 'nav-btn') + '" onclick="setTab(\'' + n.id + '\')"><span>' + ICON[n.icon] + '</span><span class="nav-label">' + n.label + '</span></button>').join('')
    + '</div>';
}

/* ----- Modals ----- */
function buildAreaOptionsForClient(currentLocation){
  let names = sortedAreas().map(a => a.name);
  if (currentLocation && !names.includes(currentLocation)) names = [currentLocation].concat(names);
  let opts = '<option value=""' + (currentLocation ? '' : ' selected') + '>بدون منطقة</option>';
  opts += names.map(n => '<option value="' + esc(n) + '" ' + (n === currentLocation ? 'selected' : '') + '>' + esc(n) + '</option>').join('');
  opts += '<option value="__new__">+ إضافة منطقة جديدة</option>';
  return opts;
}

function buildClientModal(){
  const c = editingClientId ? clients.find(x => x.id === editingClientId) : null;
  const hasLoc = c && c.lat != null && c.lng != null;
  return '<div class="modal-overlay" onclick="closeClientModal()"><div class="modal-card" onclick="event.stopPropagation()">'
    + '<div class="modal-head"><div class="modal-title">' + (c ? 'تعديل بيانات العميل' : 'عميل جديد') + '</div>'
    + '<button class="icon-btn" onclick="closeClientModal()">✕</button></div>'
    + '<label class="field-label">اسم العميل</label>'
    + '<input id="cf-name" class="select-field" value="' + (c ? esc(c.name) : '') + '" placeholder="مثال: أحمد محمد">'
    + '<label class="field-label">اسم المحل (اختياري)</label>'
    + '<input id="cf-store" class="select-field" value="' + (c ? esc(c.storeName||'') : '') + '" placeholder="مثال: محل النور">'
    + '<label class="field-label">رقم المكنة</label>'
    + '<input id="cf-machine" class="select-field" value="' + (c ? esc(c.machineNumber||'') : '') + '" placeholder="مثال: 12">'
    + '<label class="field-label">المنطقة</label>'
    + '<select id="cf-location" class="select-field" onchange="handleAreaSelectChange(this)">' + buildAreaOptionsForClient(c ? (c.location||'') : '') + '</select>'
    + '<label class="field-label">العنوان (اختياري)</label>'
    + '<input id="cf-address" class="select-field" value="' + (c ? esc(c.address||'') : '') + '" placeholder="مثال: شارع 10 - عمارة 5 - الدور 3">'
    + '<label class="field-label">رقم الهاتف (اختياري)</label>'
    + '<input id="cf-phone" class="select-field" value="' + (c ? esc(c.phone||'') : '') + '" placeholder="01xxxxxxxxx">'
    + '<label class="field-label">موقع العميل (لاستخدامه في الجولات)</label>'
    + '<input id="cf-lat" type="hidden" value="' + (hasLoc ? c.lat : '') + '">'
    + '<input id="cf-lng" type="hidden" value="' + (hasLoc ? c.lng : '') + '">'
    + '<button type="button" id="location-btn" class="location-btn" onclick="captureLocation()">' + (hasLoc ? '✅ الموقع مسجّل — اضغط للتحديث' : '📍 سجّل موقعي الحالي') + '</button>'
    + '<button class="export-btn" onclick="saveClientForm()">✓ حفظ</button>'
    + '</div></div>';
}

function buildAmountModal(){
  const c = clients.find(x => x.id === amountModalClientId);
  if (!c) return '';
  return '<div class="modal-overlay" onclick="closeAmountModal()"><div class="modal-card" onclick="event.stopPropagation()">'
    + '<div class="modal-head"><div class="modal-title">إرسال مبلغ لـ ' + esc(c.name) + '</div>'
    + '<button class="icon-btn" onclick="closeAmountModal()">✕</button></div>'
    + '<div style="font-size:12px;color:var(--hint);margin-bottom:8px">🕐 ' + fmtDateHuman(selectedDate) + '</div>'
    + '<label class="field-label">المبلغ المرسل (ج.م)</label>'
    + '<input id="am-amount" type="number" class="select-field" placeholder="0.00" autofocus>'
    + '<label class="field-label">ملاحظات (اختياري)</label>'
    + '<input id="am-note" class="select-field" placeholder="مثال: دفعة أولى">'
    + '<button class="export-btn" onclick="saveAmountForm()">✓ حفظ المعاملة</button>'
    + '</div></div>';
}

function buildPayModal(){
  const t = transactions.find(x => x.id === payModalTxId);
  const c = t ? clients.find(x => x.id === t.clientId) : null;
  if (!t) return '';
  const paid = txPaid(t);
  const pending = txPending(t);
  return '<div class="modal-overlay" onclick="closePayModal()"><div class="modal-card" onclick="event.stopPropagation()">'
    + '<div class="modal-head"><div class="modal-title">تحصيل من ' + esc(c ? c.name : 'عميل') + '</div>'
    + '<button class="icon-btn" onclick="closePayModal()">✕</button></div>'
    + '<div style="font-size:12px;color:var(--hint);margin-bottom:10px">🕐 ' + fmtDateHuman(t.date) + '</div>'
    + '<div class="preview-box">'
    + '<div>مبلغ المرسل: <b>' + fmtMoney(t.amountSent) + '</b></div>'
    + '<div>المسدد سابقًا: <b>' + fmtMoney(paid) + '</b></div>'
    + '<div>المتبقي: <b style="color:var(--amber)">' + fmtMoney(pending) + '</b></div>'
    + '</div>'
    + (pending > 0
        ? '<label class="field-label">المبلغ المدفوع الآن (ج.م)</label>'
          + '<input id="pm-amount" type="number" class="select-field" value="' + pending + '" autofocus>'
          + '<button type="button" class="location-btn" style="margin-top:8px" onclick="fillPayAmount()">🔁 تعبئة كامل المتبقي</button>'
          + '<button class="export-btn" onclick="savePayForm()">✓ تسجيل الدفعة</button>'
        : '<div style="text-align:center;color:var(--ok-ink);font-weight:700;margin-top:12px">✓ تم تحصيل هذا المبلغ بالكامل</div>')
    + '</div></div>';
}

function buildEditTxModal(){
  const t = transactions.find(x => x.id === editTxId);
  const c = t ? clients.find(x => x.id === t.clientId) : null;
  if (!t) return '';
  return '<div class="modal-overlay" onclick="closeEditTx()"><div class="modal-card" onclick="event.stopPropagation()">'
    + '<div class="modal-head"><div class="modal-title">تعديل المعاملة</div>'
    + '<button class="icon-btn" onclick="closeEditTx()">✕</button></div>'
    + '<div style="font-size:12px;color:var(--hint);margin-bottom:8px">' + esc(c ? c.name : '') + ' · ' + fmtDateHuman(t.date) + '</div>'
    + '<label class="field-label">المبلغ المرسل (ج.م)</label>'
    + '<input id="et-amount" type="number" class="select-field" value="' + t.amountSent + '" autofocus>'
    + (txPaid(t) > 0 ? '<div style="font-size:12px;color:var(--amber);font-weight:700;margin-top:6px">مسدد سابقًا: ' + fmtMoney(txPaid(t)) + ' (لن يتغير عند التعديل)</div>' : '')
    + '<label class="field-label">ملاحظات</label>'
    + '<input id="et-note" class="select-field" value="' + esc(t.notes||'') + '" placeholder="اختياري">'
    + '<button class="export-btn" onclick="saveEditTx()">✓ حفظ التعديل</button>'
    + '</div></div>';
}

function buildAreaModal(){
  const a = editingAreaId ? areas.find(x => x.id === editingAreaId) : null;
  return '<div class="modal-overlay" onclick="closeAreaModal()"><div class="modal-card" onclick="event.stopPropagation()">'
    + '<div class="modal-head"><div class="modal-title">' + (a ? 'تعديل المنطقة' : 'منطقة جديدة') + '</div>'
    + '<button class="icon-btn" onclick="closeAreaModal()">✕</button></div>'
    + '<label class="field-label">اسم المنطقة</label>'
    + '<input id="af-name" class="select-field" value="' + (a ? esc(a.name) : '') + '" placeholder="مثال: حي الأربعين">'
    + '<button class="export-btn" onclick="saveAreaForm()">✓ حفظ</button>'
    + '</div></div>';
}
