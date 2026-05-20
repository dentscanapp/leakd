  // FOUC guard — set the theme on <html> SYNCHRONOUSLY before CSS applies so
  // a refresh in dark mode doesn't flash the default light palette. Also
  // paints the html background directly in case the stylesheet is still in
  // flight. Mirrors applyTheme() in js/app.js exactly (light / dark / auto).
  (function () {
    try {
      var raw = localStorage.getItem('leakd_settings');
      var theme = raw ? (JSON.parse(raw).theme || 'auto') : 'auto';
      var effective = theme;
      if (theme === 'auto') {
        effective = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', effective);
      document.documentElement.style.backgroundColor = effective === 'dark' ? '#0f0f0f' : '#fafaf9';
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', effective === 'dark' ? '#0f0f0f' : '#fafaf9');
    } catch (e) {}
  })();
