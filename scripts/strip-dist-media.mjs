import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'

const projectRoot = process.cwd()
const distMediaPath = path.join(projectRoot, 'dist', 'media')

if (!existsSync(distMediaPath)) {
  console.log('No dist/media folder found. Nothing to strip.')
  process.exit(0)
}

rmSync(distMediaPath, { recursive: true, force: true })
console.log('Removed dist/media so Netlify deploy excludes media files.')

if (existsSync(distMediaPath)) {
  console.error('ERROR: dist/media still exists after removal attempt. Deploy will not proceed.')
  process.exit(1)
}

console.log('Verified: dist/media has been successfully removed. Safe to deploy.')
