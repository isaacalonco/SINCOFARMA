import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'backend']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    plugins: { react },
    rules: {
      // o eslint 9 não enxerga variáveis usadas só no JSX (<Icone />, <motion.div>)
      'react/jsx-uses-vars': 'error',
      // rótulos cujo texto fica dentro de <motion.span>: olhar mais fundo na árvore
      'jsx-a11y/label-has-associated-control': ['error', { assert: 'either', depth: 4 }],
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
