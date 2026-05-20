window.LeakdSyncConfig = {
  clientId: '587744396356-qho928kuorkh8dufjnqa05u7cbdellho.apps.googleusercontent.com'
};
window.LeakdVersion = '2026-05-20.103';
console.log('Leakd Initializing v' + window.LeakdVersion);
if('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js?v=' + window.LeakdVersion).then(reg => {
    reg.onupdatefound = () => {
      const installer = reg.installing;
      installer.onstatechange = () => {
        if (installer.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('New version available, reloading...');
          location.reload();
        }
      };
    };
  });
}
