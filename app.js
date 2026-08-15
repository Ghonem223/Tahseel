/* ============================================================
   Tahseely — entry point
   ============================================================ */

applyTheme(getTheme());
loadData();
render();
refreshMyLocation(true);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=5').catch((e) => console.log('SW registration failed', e));
  });
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
