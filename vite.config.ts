import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
})
