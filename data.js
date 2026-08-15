/* ============================================================
   Tahseely — application state & persistence
   (global state, localStorage read/write, derived data)
   ============================================================ */

let clients = [];
let transactions = [];
let areas = [];

let tab = 'daily';
let selectedDate = todayStr();
let search = '';
let areaFilter = 'all';
let onlyDebtors = false;
let followupFilter = 'pending';

let showClientModal = false;
let editingClientId = null;
let amountModalClientId = null;
let payModalTxId = null;
let editTxId = null;
let showAreaModal = false;
let editingAreaId = null;

let exportClient = 'all';
let exportPeriodType = 'day';
let exportDay = todayStr();
let exportMonth = monthStr();
let exportYear = yearNum();

let myLocation = null;
let locatingInProgress = false;

/* ----- Persistence ----- */
function loadData(){
  try {
    const raw = localStorage.getItem('ledger-data');
    if (raw) {
      const d = JSON.parse(raw);
      clients = d.clients || [];
      transactions = (d.transactions || []).map(t => {
        if (t.paid == null) t.paid = t.collected ? t.amountSent : 0;
        return t;
      });
      areas = d.areas || [];
    }
  } catch (e) { console.error('load error', e); }
}

function saveData(){
  try { localStorage.setItem('ledger-data', JSON.stringify({clients, transactions, areas})); }
  catch (e) { alert('تعذر حفظ البيانات على هذا الجهاز'); }
}

/* ----- Derived data ----- */
function getDayTx(){ return transactions.filter(t => t.date === selectedDate); }
function txPaid(t){ return Number(t.paid) || 0; }
function txPending(t){ return t.amountSent - txPaid(t); }

function computeStats(txs){
  const total = txs.reduce((s,t) => s + t.amountSent, 0);
  const collected = txs.reduce((s,t) => s + txPaid(t), 0);
  const pending = total - collected;
  const pct = total > 0 ? Math.round(collected/total*100) : 0;
  return {total, collected, pending, pct, count: txs.length};
}

function sortedClients(){ return clients.slice().sort((a,b) => a.name.localeCompare(b.name,'ar')); }
function sortedAreas(){ return areas.slice().sort((a,b) => a.name.localeCompare(b.name,'ar')); }

function clientPendingTotal(clientId){
  return transactions.filter(t => t.clientId === clientId).reduce((s,t) => s + txPending(t), 0);
}

function filteredClientList(){
  const list = clients.filter(c =>
    (c.name.includes(search) || (c.storeName||'').includes(search) || (c.location||'').includes(search) || (c.address||'').includes(search) || (c.machineNumber||'').includes(search)) &&
    (areaFilter === 'all' || c.location === areaFilter) &&
    (!onlyDebtors || clientPendingTotal(c.id) > 0)
  );
  return sortByProximityOrName(list);
}

function sortByProximityOrName(list){
  if (!myLocation) return list.slice().sort((a,b) => a.name.localeCompare(b.name,'ar'));
  const withLoc = list.filter(c => c.lat != null && c.lng != null);
  const withoutLoc = list.filter(c => c.lat == null || c.lng == null);
  withLoc.sort((a,b) => distanceKm(myLocation, {lat:a.lat,lng:a.lng}) - distanceKm(myLocation, {lat:b.lat,lng:b.lng}));
  withoutLoc.sort((a,b) => a.name.localeCompare(b.name,'ar'));
  return withLoc.concat(withoutLoc);
}
