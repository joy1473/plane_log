// 필기시험 교재와 비행기록 사이를 오가는 플로팅 토글.
// 두 앱은 오리진이 다르므로 링크는 절대경로다. 쓰는 CSS도 서로 달라서
// shadow DOM 안에 격리해 그린다.
(function () {
  var EXAM = 'https://lsa.joy.it.kr/lsa';
  var LOG  = 'https://log.joy.it.kr/';
  var HUB  = 'https://lsa.joy.it.kr/';

  var path = location.pathname;
  if (path.indexOf('/hub') === 0) return;         // 허브에는 토글을 달지 않는다
  if (window.__planeSwitchMounted) return;
  window.__planeSwitchMounted = true;

  var onExam = path.indexOf('/lsa') === 0;

  var host = document.createElement('div');
  host.id = 'plane-switch';
  var root = host.attachShadow({ mode: 'open' });

  root.innerHTML = [
    '<style>',
    ':host{position:fixed;right:max(12px,env(safe-area-inset-right,0px));',
    '  bottom:calc(max(12px,env(safe-area-inset-bottom,0px)) + var(--plane-switch-lift,0px));z-index:2147483000;transition:bottom .2s;',
    '  font-family:"IBM Plex Sans KR",system-ui,-apple-system,"Malgun Gothic",sans-serif}',
    '.pill{display:flex;align-items:stretch;gap:2px;padding:3px;border-radius:999px;',
    '  background:var(--bg);border:1px solid var(--line);box-shadow:0 2px 10px rgba(0,0,0,.16)}',
    '.seg{display:flex;align-items:center;gap:5px;padding:7px 13px;border-radius:999px;',
    '  font-size:13px;font-weight:500;line-height:1;text-decoration:none;color:var(--muted);',
    '  white-space:nowrap;transition:background .15s,color .15s}',
    '.seg:hover{background:var(--hover);color:var(--ink)}',
    '.seg[aria-current="page"]{background:var(--route);color:#fff}',
    '.seg[aria-current="page"]:hover{background:var(--route);color:#fff}',
    '.home{display:flex;align-items:center;justify-content:center;width:30px;border-radius:999px;',
    '  text-decoration:none;color:var(--muted);font-size:14px}',
    '.home:hover{background:var(--hover);color:var(--ink)}',
    '.ico{font-size:14px}',
    ':host{--bg:#fffffff2;--ink:#18242c;--muted:#5d6b72;--line:#d5ddd8;',
    '  --hover:#e8eee9;--route:#a8287a}',
    ':host([data-theme="dark"]){--bg:#18222af2;--ink:#e4ebe8;--muted:#9aa8ad;',
    '  --line:#2b3a42;--hover:#22303a;--route:#e070b6}',
    '@media (max-width:380px){.seg{padding:7px 10px;font-size:12px}}',
    '</style>',
    '<nav class="pill" aria-label="앱 전환">',
    '  <a class="seg" href="' + EXAM + '"', onExam ? ' aria-current="page"' : '', '>',
    '    <span class="ico" aria-hidden="true">📖</span>필기</a>',
    '  <a class="seg" href="' + LOG + '"', onExam ? '' : ' aria-current="page"', '>',
    '    <span class="ico" aria-hidden="true">🛩</span>기록</a>',
    '  <a class="home" href="' + HUB + '" title="처음 화면" aria-label="처음 화면">✈</a>',
    '</nav>'
  ].join('');

  // 두 앱 모두 data-theme 토글과 OS 설정을 함께 쓴다. 둘 다 따라간다.
  function syncTheme() {
    var attr = document.documentElement.getAttribute('data-theme');
    var dark = attr ? attr === 'dark'
                    : window.matchMedia('(prefers-color-scheme: dark)').matches;
    host.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement,
    { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);

  document.body.appendChild(host);
})();
