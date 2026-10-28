import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const PKG = /node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // separa bibliotecas estáveis em chunks próprios: o navegador
    // mantém o cache delas entre deploys que só mudam o código do app
    rollupOptions: {
      output: {
        manualChunks(id) {
          const m = id.match(PKG)
          if (!m) return undefined
          const pkg = m[1].replace(/\\/g, '/')
          if (['framer-motion', 'motion-dom', 'motion-utils'].includes(pkg)) return 'motion'
          if (pkg === 'lucide-react') return 'icons'
          if (['react', 'react-dom', 'scheduler', 'react-router', 'react-router-dom', 'cookie', 'set-cookie-parser'].includes(pkg)) return 'react'
          if (pkg.startsWith('@fontsource')) return undefined
          return 'vendor'
        },
      },
    },
  },
})
