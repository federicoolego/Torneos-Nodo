/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

// versión de la app (la inyecta vite.config.ts en el build)
declare const __APP_VERSION__: string
declare const __APP_BUILD__: string
declare const __APP_FECHA__: string
