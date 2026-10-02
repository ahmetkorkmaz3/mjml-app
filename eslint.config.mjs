import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  {
    ignores: ['out/', 'release/', 'dist/', 'node_modules/', 'site/dist/'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    // main process and preload script (Node.js)
    files: ['src/main/**', 'src/preload/**', '*.config.mjs', 'eslint.config.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // renderer process (browser)
    files: ['src/**/*.{js,jsx}', 'site/**/*.js'],
    ignores: ['src/main/**', 'src/preload/**'],
    languageOptions: {
      globals: {
        ...globals.browser,
        __MJML_APP_VERSION__: 'readonly',
        __MJML_VERSION__: 'readonly',
        dataLayer: 'readonly',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  prettier,
]
