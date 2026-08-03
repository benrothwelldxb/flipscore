import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'playwright-report',
      'test-results',
      'node_modules',
      '.wrangler',
      // Static assets, incl. the service-worker push script (SW globals).
      'public',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      // TypeScript already resolves identifiers; no-undef produces false
      // positives on ambient/global types and test globals.
      'no-undef': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  // Plain JS/MJS tooling (this config, build scripts) — lint with recommended.
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // shadcn/ui primitives co-locate variant helpers with components by
  // design; fast-refresh purity does not apply to these library files.
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Node-context files (build tooling, e2e, scripts).
  {
    files: [
      'vite.config.ts',
      'playwright.config.ts',
      'eslint.config.js',
      'scripts/**/*.{js,mjs}',
      'e2e/**/*.{ts,tsx}',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  prettier,
)
