/* ============================================================
   Tahseely — actions
   (CRUD for clients/areas/transactions, location, tour, setters)
   ============================================================ */

/* ----- Clients ----- */
function openNewClient(){ editingClientId = null; showClientModal = true; render(); }
function openEditClient(id){ editingClientId = id; showClientModal = true; render(); }
function closeClientModal(){ showClientModal = false; editingClientId = null; render(); }

function saveClientForm(){
  const name = document.getElementById('cf-name').value.trim();
  const storeName = document.getElementById('cf-store').value.trim();
  const machineNumber = document.getElementById('cf-machine').value.trim();
  const location = document.getElementById('cf-location').value.trim();
  const address = document.getElementById('cf-address').value.trim();
  const phone = document.getElementById('cf-phone').value.trim();
  const latRaw = document.getElementById('cf-lat').value;
  const lngRaw = document.getElementById('cf-lng').value;
  const lat = latRaw !== '' ? parseFloat(latRaw) : null;
  const lng = lngRaw !== '' ? parseFloat(lngRaw) : null;
  if (!name) { alert('أدخل اسم العميل'); return; }
  if (editingClientId) {
    clients = clients.map(c => c.id === editingClientId ? {...c, name, storeName, machineNumber, location, address, phone, lat, lng} : c);
  } else {
    clients.push({id: uid('c'), name, storeName, machineNumber, location, address, phone, lat, lng, createdAt: todayStr()});
  }
  saveData(); showClientModal = false; editingClientId = null; render();
}

function deleteClient(id){
  if (!confirm('حذف هذا العميل؟ سجل معاملاته السابقة سيبقى محفوظاً.')) return;
  clients = clients.filter(c => c.id !== id);
  saveData(); render();
}

/* ----- Areas ----- */
function openNewArea(){ editingAreaId = null; showAreaModal = true; render(); }
function openEditArea(id){ editingAreaId = id; showAreaModal = true; render(); }
function closeAreaModal(){ showAreaModal = false; editingAreaId = null; render(); }

function saveAreaForm(){
  const name = document.getElementById('af-name').value.trim();
  if (!name) { alert('أدخل اسم المنطقة'); return; }
  if (editingAreaId) {
    const area = areas.find(a => a.id === editingAreaId);
    if (area) {
      const oldName = area.name;
      area.name = name;
      if (oldName !== name) {
        clients = clients.map(c => c.location === oldName ? {...c, location: name} : c);
        if (areaFilter === oldName) areaFilter = name;
      }
    }
  } else {
    if (areas.some(a => a.name === name)) { alert('هذه المنطقة مسجلة بالفعل'); return; }
    areas.push({id: uid('a'), name});
  }
  saveData(); showAreaModal = false; editingAreaId = null; render();
}

function deleteArea(id){
  const area = areas.find(a => a.id === id);
  if (!area) return;
  const count = clients.filter(c => c.location === area.name).length;
  const msg = count > 0
    ? ('هذه المنطقة مرتبطة بـ ' + count + ' عميل. حذفها لن يحذف العملاء أو يمسح بيانات مناطقهم، لكنها ستختفي من قائمة المناطق المسجلة. متابعة؟')
    : 'حذف هذه المنطقة؟';
  if (!confirm(msg)) return;
  areas = areas.filter(a => a.id !== id);
  if (areaFilter === area.name) areaFilter = 'all';
  saveData(); render();
}

function handleAreaSelectChange(sel){
  if (sel.value !== '__new__') return;
  const name = prompt('اسم المنطقة الجديدة:');
  if (name && name.trim()) {
    const trimmed = name.trim();
    if (!areas.some(a => a.name === trimmed)) {
      areas.push({id: uid('a'), name: trimmed});
      saveData();
    }
    const opt = document.createElement('option');
    opt.value = trimmed; opt.textContent = trimmed;
    sel.insertBefore(opt, sel.lastElementChild);
    sel.value = trimmed;
  } else {
    sel.value = '';
  }
}

/* ----- Location & tour ----- */
function captureLocation(){
  if (!navigator.geolocation) { alert('المتصفح ده مش بيدعم تحديد الموقع'); return; }
  const btn = document.getElementById('location-btn');
  if (btn) btn.textContent = '⏳ جاري تحديد الموقع...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById('cf-lat').value = pos.coords.latitude;
      document.getElementById('cf-lng').value = pos.coords.longitude;
      if (btn) btn.textContent = '✅ تم تسجيل موقعك الحالي';
    },
    () => {
      alert('تعذر تحديد الموقع. تأكد إن صلاحية الموقع مفعّلة للمتصفح وجرّب تاني.');
      if (btn) btn.textContent = '📍 سجّل موقعي الحالي';
    },
    {enableHighAccuracy: true, timeout: 15000}
  );
}

function refreshMyLocation(silent){
  if (!navigator.geolocation) { if (!silent) alert('المتصفح ده مش بيدعم تحديد الموقع'); return; }
  locatingInProgress = true;
  if (!silent) render();
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      myLocation = {lat: pos.coords.latitude, lng: pos.coords.longitude};
      locatingInProgress = false;
      render();
    },
    () => {
      locatingInProgress = false;
      if (!silent) alert('تعذر تحديد موقعك الحالي. فعّل صلاحية الموقع من إعدادات المتصفح وحاول تاني.');
      render();
    },
    {enableHighAccuracy: true, timeout: 15000}
  );
}

function nearestNeighborOrder(start, list){
  const remaining = list.slice();
  const ordered = [];
  let current = start;
  while (remaining.length) {
    let bestIdx = 0, bestDist = Infinity;
    remaining.forEach((c, i) => {
      const d = distanceKm(current, {lat: c.lat, lng: c.lng});
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    current = {lat: next.lat, lng: next.lng};
  }
  return ordered;
}

function openMapsRoute(ordered){
  const CHUNK = 9; // أقصى عدد محطات تقريبي مدعوم في رابط جوجل ماب الواحد
  for (let i = 0; i < ordered.length; i += CHUNK) {
    const chunk = ordered.slice(i, i + CHUNK);
    const dest = chunk[chunk.length - 1];
    const waypoints = chunk.slice(0, -1).map(c => c.lat + ',' + c.lng).join('|');
    let url = 'https://www.google.com/maps/dir/?api=1&destination=' + dest.lat + ',' + dest.lng;
    if (waypoints) url += '&waypoints=' + encodeURIComponent(waypoints);
    url += '&travelmode=driving';
    window.open(url, '_blank');
  }
}

function startTour(){
  const list = filteredClientList();
  if (list.length === 0) { alert('لا يوجد عملاء في القائمة الحالية'); return; }
  const withLoc = list.filter(c => c.lat != null && c.lng != null);
  const withoutLoc = list.filter(c => c.lat == null || c.lng == null);
  if (withLoc.length === 0) { alert('لا يوجد عميل في القائمة الحالية له موقع مسجل بعد. سجّل موقع العميل من فورم تعديله الأول.'); return; }
  if (withoutLoc.length > 0) {
    const names = withoutLoc.map(c => c.name).join('، ');
    if (!confirm('تنبيه: ' + withoutLoc.length + ' عميل من غير موقع مسجل (' + names + ') مش هيدخلوا الجولة. متابعة بالباقي (' + withLoc.length + ' عميل)؟')) return;
  }
  if (!navigator.geolocation) { alert('المتصفح مش بيدعم تحديد الموقع'); return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const start = {lat: pos.coords.latitude, lng: pos.coords.longitude};
      const ordered = nearestNeighborOrder(start, withLoc);
      openMapsRoute(ordered);
    },
    () => alert('تعذر تحديد موقعك الحالي. فعّل صلاحية الموقع وحاول تاني.'),
    {enableHighAccuracy: true, timeout: 15000}
  );
}

/* ----- Transactions ----- */
function lastAmountForClient(clientId){
  const list = transactions.filter(t => t.clientId === clientId).sort((a,b) => (a.createdAt||'').localeCompare(b.createdAt||''));
  return list.length ? list[list.length - 1].amountSent : null;
}

function quickCollect(clientId){
  const amt = lastAmountForClient(clientId);
  if (!amt) return;
  transactions.push({id: uid('t'), clientId, date: selectedDate, amountSent: amt, paid: 0, collectedDate: null, notes: '', createdAt: new Date().toISOString()});
  saveData(); render();
}

function openAmountModal(clientId){ amountModalClientId = clientId; render(); }
function closeAmountModal(){ amountModalClientId = null; render(); }

function saveAmountForm(){
  const amount = parseFloat(document.getElementById('am-amount').value);
  const note = document.getElementById('am-note').value.trim();
  if (!amount || amount <= 0) { alert('أدخل مبلغاً صحيحاً'); return; }
  transactions.push({id: uid('t'), clientId: amountModalClientId, date: selectedDate, amountSent: amount, paid: 0, collectedDate: null, notes: note, createdAt: new Date().toISOString()});
  saveData(); amountModalClientId = null; render();
}

function openPayModal(txId){ payModalTxId = txId; render(); }
function closePayModal(){ payModalTxId = null; render(); }

function collectFull(txId){
  transactions = transactions.map(t => t.id === txId && txPending(t) > 0 ? {...t, paid: t.amountSent, collectedDate: todayStr()} : t);
  saveData(); render();
}

function fillPayAmount(){
  const t = transactions.find(x => x.id === payModalTxId);
  const el = document.getElementById('pm-amount');
  if (t && el) el.value = txPending(t) > 0 ? txPending(t) : t.amountSent;
}

function savePayForm(){
  const t = transactions.find(x => x.id === payModalTxId);
  if (!t) { payModalTxId = null; render(); return; }
  const amount = parseFloat(document.getElementById('pm-amount').value);
  if (!amount || amount <= 0) { alert('أدخل مبلغًا صحيحًا'); return; }
  const newPaid = Math.min(txPaid(t) + amount, t.amountSent);
  transactions = transactions.map(x => x.id === t.id
    ? {...x, paid: newPaid, collectedDate: newPaid >= x.amountSent ? todayStr() : (x.collectedDate || null)}
    : x);
  saveData(); payModalTxId = null; render();
}

function deleteTransaction(txId){
  if (!confirm('حذف هذه المعاملة؟')) return;
  transactions = transactions.filter(t => t.id !== txId);
  saveData(); render();
}

function openEditTx(txId){ editTxId = txId; render(); }
function closeEditTx(){ editTxId = null; render(); }

function saveEditTx(){
  const t = transactions.find(x => x.id === editTxId);
  if (!t) { editTxId = null; render(); return; }
  const amount = parseFloat(document.getElementById('et-amount').value);
  const note = document.getElementById('et-note').value.trim();
  if (!amount || amount <= 0) { alert('أدخل مبلغًا صحيحًا'); return; }
  const newPaid = Math.min(txPaid(t), amount);
  transactions = transactions.map(x => x.id === t.id
    ? {...x, amountSent: amount, paid: newPaid, notes: note, collectedDate: newPaid >= amount ? todayStr() : (x.collectedDate || null)}
    : x);
  saveData(); editTxId = null; render();
}

/* ----- Navigation & filter setters ----- */
function setTab(t){ tab = t; render(); }
function setSelectedDate(v){ selectedDate = v; render(); }

function shiftDate(days){
  const d = new Date(selectedDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  selectedDate = d.getFullYear() + '-' + m + '-' + day;
  render();
}

function setSearch(v){
  search = v;
  const container = document.getElementById('search-results');
  if (container) {
    const list = filteredClientList();
    container.innerHTML = (tab === 'clients') ? buildClientsResultsHTML(list) : buildDailyResultsHTML(list);
  } else {
    render();
  }
}

function setAreaFilter(v){ areaFilter = v; render(); }
function setOnlyDebtors(v){ onlyDebtors = v; render(); }
function setFollowupFilter(v){ followupFilter = v; render(); }

function setExportClient(v){ exportClient = v; render(); }
function setExportPeriodType(v){ exportPeriodType = v; render(); }
function setExportDay(v){ exportDay = v; render(); }
function setExportMonth(v){ exportMonth = v; render(); }
function setExportYear(v){ exportYear = v; render(); }
