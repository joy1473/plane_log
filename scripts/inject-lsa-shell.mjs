// public/lsa/index.html 은 외부에서 통째로 생성해 덮어쓰는 파일이라,
// 교체할 때마다 우리가 끼워 넣은 태그가 전부 사라진다. 빌드 전에 다시 넣는다.
import { readFile, writeFile } from 'node:fs/promises'

const TARGET = new URL('../public/lsa/index.html', import.meta.url)

const HEAD = `<link rel="apple-touch-icon" href="/icons/lsa-180.png">
<link rel="manifest" href="/lsa.webmanifest">
`

const BODY = `<script src="/switch.js" defer></script>
<script src="/install.js" defer></script>
`

let html = await readFile(TARGET, 'utf8')
let changed = false

if (!html.includes('/lsa.webmanifest')) {
  if (!html.includes('</head>')) {
    console.error('inject-lsa-shell: no </head> in public/lsa/index.html')
    process.exit(1)
  }
  html = html.replace('</head>', HEAD + '</head>')
  changed = true
}

if (!html.includes('/install.js')) {
  if (!html.includes('</body>')) {
    console.error('inject-lsa-shell: no </body> in public/lsa/index.html')
    process.exit(1)
  }
  // 교체 직후라면 switch.js 태그도 함께 사라진 상태이므로 둘 다 다시 넣는다.
  html = html.replace(/[ \t]*<script src="\/switch\.js" defer><\/script>\r?\n?/, '')
  html = html.replace('</body>', BODY + '</body>')
  changed = true
}

if (changed) {
  await writeFile(TARGET, html)
  console.log('inject-lsa-shell: tags added')
} else {
  console.log('inject-lsa-shell: already present')
}
