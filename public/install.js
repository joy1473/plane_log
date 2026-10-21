// 홈 화면 추가 안내. iOS 는 설치 프롬프트 API 가 없어서 공유 시트 경로를
// 글로 알려주는 수밖에 없고, 안드로이드는 beforeinstallprompt 를 받아 쓴다.
// 비행기록 앱은 자체 배너가 있으므로 여기서는 허브와 교재만 쓴다.
(function () {
  if (window.__planeInstallMounted) return;
  window.__planeInstallMounted = true;

  var standalone = window.matchMedia('(display-mode: standalone)').matches ||
                   window.navigator.standalone === true;
  if (standalone) return;                                   // 이미 설치된 상태

  var KEY = 'plane_install_dismissed_' + location.pathname;
  try { if (localStorage.getItem(KEY)) return; } catch (e) { /* 사생활 모드 */ }

  var ua = navigator.userAgent;
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  var titleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  var appName = titleMeta ? titleMeta.content : document.title;

  var deferredPrompt = null;
  var host = null;

  function lift(on) {
    document.documentElement.style.setProperty('--plane-switch-lift', on ? '68px' : '0px');
  }

  function dismiss() {
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* 무시 */ }
    if (host) host.remove();
    lift(false);
  }

  function show(mode) {                                     // 'ios' | 'prompt'
    if (host) return;
    host = document.createElement('div');
    host.id = 'plane-install';
    var root = host.attachShadow({ mode: 'open' });

    var body = mode === 'ios'
      ? '<p class="t">홈 화면에 추가하면 <b>' + appName + '</b>을 앱처럼 쓸 수 있어요</p>' +
        '<p class="d">아래 <svg class="share" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M12 3l4 4h-3v8h-2V7H8l4-4z" fill="currentColor"/><path d="M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> 공유 버튼 → <b>홈 화면에 추가</b></p>'
      : '<p class="t"><b>' + appName + '</b>을 홈 화면에 추가할까요?</p>' +
        '<p class="d">앱처럼 전체 화면으로 실행됩니다</p>';

    var action = mode === 'ios' ? '' : '<button class="go" type="button">추가</button>';

    root.innerHTML =
      '<style>' +
      ':host{position:fixed;left:0;right:0;bottom:0;z-index:2147483100;' +
      '  font-family:"IBM Plex Sans KR",system-ui,-apple-system,"Malgun Gothic",sans-serif;' +
      '  padding:0 max(10px,env(safe-area-inset-right,0px))' +
      '  max(10px,env(safe-area-inset-bottom,0px)) max(10px,env(safe-area-inset-left,0px))}' +
      '.bar{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;' +
      '  background:var(--bg);border:1px solid var(--line);box-shadow:0 4px 18px rgba(0,0,0,.18)}' +
      '.txt{flex:1;min-width:0}' +
      '.t{margin:0;font-size:13.5px;line-height:1.4;color:var(--ink)}' +
      '.d{margin:3px 0 0;font-size:12px;line-height:1.4;color:var(--muted)}' +
      '.share{vertical-align:-2px;color:var(--route)}' +
      'b{font-weight:700}' +
      '.go{flex:none;padding:8px 14px;border:0;border-radius:999px;background:var(--route);' +
      '  color:#fff;font:inherit;font-size:13px;font-weight:500;cursor:pointer}' +
      '.x{flex:none;width:28px;height:28px;border:0;border-radius:50%;background:transparent;' +
      '  color:var(--muted);font-size:17px;line-height:1;cursor:pointer}' +
      '.x:hover{background:var(--hover);color:var(--ink)}' +
      ':host{--bg:#fffffff7;--ink:#18242c;--muted:#5d6b72;--line:#d5ddd8;' +
      '  --hover:#e8eee9;--route:#a8287a}' +
      ':host([data-theme="dark"]){--bg:#18222af7;--ink:#e4ebe8;--muted:#9aa8ad;' +
      '  --line:#2b3a42;--hover:#22303a;--route:#e070b6}' +
      '</style>' +
      '<div class="bar" role="complementary" aria-label="홈 화면에 추가 안내">' +
      '  <div class="txt">' + body + '</div>' +
      action +
      '  <button class="x" type="button" aria-label="닫기">✕</button>' +
      '</div>';

    root.querySelector('.x').addEventListener('click', dismiss);
    var go = root.querySelector('.go');
    if (go) go.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(dismiss);
      deferredPrompt = null;
    });

    syncTheme();
    document.body.appendChild(host);
    lift(true);
  }

  function syncTheme() {
    if (!host) return;
    var attr = document.documentElement.getAttribute('data-theme');
    var dark = attr ? attr === 'dark'
                    : window.matchMedia('(prefers-color-scheme: dark)').matches;
    host.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
  new MutationObserver(syncTheme).observe(document.documentElement,
    { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    show('prompt');
  });
  window.addEventListener('appinstalled', dismiss);

  // iOS 는 이벤트가 오지 않으므로 바로 안내를 띄운다.
  if (isIOS) setTimeout(function () { show('ios'); }, 1200);
})();
