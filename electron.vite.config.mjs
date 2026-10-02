import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const mjmlPkg = JSON.parse(
  readFileSync(new URL('./node_modules/mjml/package.json', import.meta.url), 'utf8'),
)

const src = resolve(import.meta.dirname, 'src')

// The renderer code imports its modules from the `src` root (for example
// `import x from 'helpers/mjml'`), so each top-level folder gets an alias.
const rendererRoots = [
  'actions',
  'components',
  'data',
  'helpers',
  'middlewares',
  'pages',
  'reducers',
  'router',
  'store',
  'styles',
  'templates',
]

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve(src, 'main/index.js'),
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(src, 'preload/index.js'),
      },
    },
  },
  renderer: {
    root: resolve(src, 'renderer'),
    resolve: {
      alias: rendererRoots.map(name => ({
        find: new RegExp(`^${name}(?=/|$)`),
        replacement: resolve(src, name),
      })),
    },
    define: {
      __MJML_APP_VERSION__: JSON.stringify(pkg.version),
      __MJML_VERSION__: JSON.stringify(mjmlPkg.version),
    },
    build: {
      rollupOptions: {
        input: resolve(src, 'renderer/index.html'),
      },
    },
    plugins: [react()],
  },
})
