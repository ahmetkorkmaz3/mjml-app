import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// marketing site, deployed to GitHub Pages by ./deploy
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  build: {
    outDir: resolve(import.meta.dirname, '../dist'),
    emptyOutDir: true,
  },
})
