/**
 * Next.js standalone output をElectronのextraResourcesに配置する準備スクリプト。
 * `pnpm electron:build` の前に実行される。
 */
import { cp, mkdir, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const STANDALONE_SRC = '.next/standalone'
const STATIC_SRC = '.next/static'
const PUBLIC_SRC = 'public'
const DEST = 'electron-resources/server'

if (!existsSync(STANDALONE_SRC)) {
  console.error('Error: .next/standalone が見つかりません。先に `next build` を実行してください。')
  process.exit(1)
}

console.log('Preparing Electron resources...')

await rm(DEST, { recursive: true, force: true })
await mkdir(DEST, { recursive: true })

await cp(STANDALONE_SRC, DEST, { recursive: true })
console.log('✓ standalone server copied')

await cp(STATIC_SRC, path.join(DEST, '.next/static'), { recursive: true })
console.log('✓ static assets copied')

if (existsSync(PUBLIC_SRC)) {
  await cp(PUBLIC_SRC, path.join(DEST, 'public'), { recursive: true })
  console.log('✓ public directory copied')
}

console.log(`\nDone → ${DEST}`)
