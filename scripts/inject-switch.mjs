// public/lsa/index.html 는 외부에서 통째로 생성해 덮어쓰는 파일이라,
// 교체할 때마다 전환 토글 스크립트 태그가 사라진다. 빌드 전에 다시 넣어준다.
import { readFile, writeFile } from 'node:fs/promises'

const TARGET = new URL('../public/lsa/index.html', import.meta.url)
const TAG = '<script src="/switch.js" defer></script>'

const html = await readFile(TARGET, 'utf8')

if (html.includes('/switch.js')) {
  console.log('inject-switch: already present')
} else if (!html.includes('</body>')) {
  console.error('inject-switch: no </body> in public/lsa/index.html')
  process.exit(1)
} else {
  await writeFile(TARGET, html.replace('</body>', TAG + '\n</body>'))
  console.log('inject-switch: tag added')
}
