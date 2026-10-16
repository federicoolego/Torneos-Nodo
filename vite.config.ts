import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// ------------------------------------------------------------------ versión de la app
// version: la de package.json (se sube a mano cuando hay cambios para los usuarios)
// build:   commit corto en GitHub Actions (o fecha/hora en un build local): cambia en CADA deploy
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const VERSION = pkg.version
const BUILD = process.env.GITHUB_SHA?.slice(0, 7) || new Date().toISOString().replace(/\D/g, '').slice(0, 12)
const FECHA = new Date().toISOString()

/** Publica dist/version.json: la app lo consulta para saber si hay una versión más nueva */
function archivoVersion(): Plugin {
  return {
    name: 'archivo-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION, build: BUILD, fecha: FECHA }) })
    },
  }
}

// En GitHub Pages el sitio vive en /<repo>/ (lo setea el workflow con BASE_PATH).
// En Vercel/Netlify o local queda en '/'.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), archivoVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(VERSION),
    __APP_BUILD__: JSON.stringify(BUILD),
    __APP_FECHA__: JSON.stringify(FECHA),
  },
})
