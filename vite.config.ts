import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

function regenerateMediaManifest() {
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'generate-media-manifest.mjs')
  execFileSync(process.execPath, [scriptPath], { stdio: 'inherit' })
}

function mediaManifestPlugin(): PluginOption {
  return {
    name: 'media-manifest-plugin',
    apply: 'serve' as const,
    configureServer(server) {
      const scheduleRegen = (() => {
        let timer: NodeJS.Timeout | undefined
        return () => {
          if (timer) {
            clearTimeout(timer)
          }
          timer = setTimeout(() => {
            regenerateMediaManifest()
            server.ws.send({ type: 'full-reload' })
          }, 120)
        }
      })()

      const onFileEvent = (filePath: string) => {
        const normalized = filePath.replaceAll('\\', '/')
        if (normalized.includes('/public/media/projects/')) {
          scheduleRegen()
        }
      }

      server.watcher.on('add', onFileEvent)
      server.watcher.on('change', onFileEvent)
      server.watcher.on('unlink', onFileEvent)
      regenerateMediaManifest()
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mediaManifestPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')) {
            return 'three'
          }

          if (id.includes('node_modules/react-router') || id.includes('node_modules/react-dom')) {
            return 'framework'
          }

          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
})
