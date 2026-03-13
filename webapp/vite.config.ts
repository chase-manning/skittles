import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      skittles: path.resolve(__dirname, '../src/exports.ts'),
    },
  },
  server: {
    fs: {
      allow: ['.', '../src', '../constants'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          typescript: ['typescript'],
        },
      },
    },
  },
})
