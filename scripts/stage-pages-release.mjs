import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const target = path.resolve(process.argv[2] ?? '/tmp/haroin-pages-release')
if (target === path.resolve('dist') || target.startsWith(path.resolve('dist') + path.sep)) throw new Error('Use a separate release staging directory.')
await mkdir(target, { recursive: true })
const existing = await readdir(target)
if (existing.length) throw new Error('Release staging directory must be empty.')
await cp('dist', target, { recursive: true, filter: source => path.relative('dist', source).split(path.sep)[0] !== 'server' })

async function inventory(directory, prefix = '') {
  const entries = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '__pycache__' || entry.name.endsWith('.pyc')) continue
    const relative = prefix + entry.name
    if (entry.isDirectory()) entries.push(...await inventory(path.join(directory, entry.name), relative + '/'))
    else if (entry.isFile()) entries.push([relative, createHash('sha256').update(await readFile(path.join(directory, entry.name))).digest('hex')])
  }
  return entries
}
const assets = await inventory(target)
const sources = []
for (const root of ['src', 'scripts', 'migrations', 'shortcuts']) sources.push(...(await inventory(root)).map(([file, hash]) => [root + '/' + file, hash]))
for (const file of ['package.json', 'package-lock.json', 'wrangler.toml']) sources.push([file, createHash('sha256').update(await readFile(file)).digest('hex')])
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const sourceHash = digest(sources)
const release = {
  release_id: digest({ assets, sourceHash }).slice(0, 24),
  source_commit: (await exec('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })).stdout.trim(),
  working_tree_dirty: Boolean((await exec('git', ['status', '--porcelain'], { encoding: 'utf8' })).stdout.trim()),
  source_tree_sha256: sourceHash,
  assets_sha256: digest(assets),
  created_at: new Date().toISOString(),
  public_habit_endpoint: '/api/habit/stats',
}
await writeFile(path.join(target, 'release.json'), JSON.stringify(release, null, 2) + '\n')
console.log(JSON.stringify({ directory: target, ...release }, null, 2))
