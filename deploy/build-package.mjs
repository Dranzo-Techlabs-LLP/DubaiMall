// Builds the cPanel deploy package: deploy/out/dubai-mall-deploy.tar.gz
//   npm run package
//
// The website is built WITHOUT the local .env.local coupon settings: on the live server the
// desk reads its coupon server address + key from desk-config.js, which deploy.sh writes.

import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'deploy', 'out')
const pkg = join(out, 'dubai-mall-deploy')
const archive = join(out, 'dubai-mall-deploy.tar.gz')

const run = (cmd, env = {}) => execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } })

console.log('\n1/4  Type-checking and building the website (without local coupon settings)')
// DME_PACKAGE makes vite.config.ts skip .env files, so no local key or localhost URL is baked in.
run('npx tsc -p .')
run('npx vite build', { DME_PACKAGE: '1' })

console.log('\n2/4  Assembling the package')
rmSync(out, { recursive: true, force: true })
mkdirSync(join(pkg, 'coupon-server'), { recursive: true })
cpSync(join(root, 'dist'), join(pkg, 'site'), { recursive: true })
for (const f of ['index.mjs', 'app.js', 'package.json', '.env.example']) {
  cpSync(join(root, 'server', f), join(pkg, 'coupon-server', f))
}
// Shell script and readme must have Unix line endings to run on the Linux server.
const lf = (from, to) => writeFileSync(to, readFileSync(from, 'utf8').replace(/\r\n/g, '\n'))
lf(join(root, 'deploy', 'deploy.sh'), join(pkg, 'deploy.sh'))
lf(join(root, 'deploy', 'README.txt'), join(pkg, 'README.txt'))

console.log('\n3/4  Checking that no local secrets are in the package')
const secrets = []
for (const file of ['.env.local', join('server', '.env')]) {
  const path = join(root, file)
  if (!existsSync(path)) continue
  for (const m of readFileSync(path, 'utf8').matchAll(/^(?:DESK_KEY|VITE_COUPON_API_KEY)=(.{8,})$/gm)) secrets.push(m[1].trim())
}
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))
for (const file of walk(pkg)) {
  const text = readFileSync(file, 'latin1')
  if (secrets.some((s) => text.includes(s)) || text.includes('localhost:8787')) {
    throw new Error(`Local coupon settings leaked into ${file}. Not packaging.`)
  }
}
console.log('     OK: no local keys or localhost addresses')

console.log('\n4/4  Compressing')
// Relative paths only: GNU tar on Windows reads "C:" as a remote host name.
execSync('tar -czf dubai-mall-deploy.tar.gz dubai-mall-deploy', { cwd: out, stdio: 'inherit' })
console.log(`\nDone: ${archive} (${Math.round(statSync(archive).size / 1024)} KB)\n`)
