import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '_local']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Autorise le destructuring d'exclusion : const { id, ...rest } = obj
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
      // Règles strictes react-hooks v7 (préparation React Compiler) :
      // signalent des patterns pré-existants qui fonctionnent mais méritent
      // un refactor posé (avec tests). Avertissement en attendant, pour que
      // le lint reste un garde-fou exploitable (0 erreur = base saine).
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs':                'warn',
      'react-hooks/purity':              'warn',
    },
  },
  {
    // Scripts Node (GitHub Actions) — pas de DOM, globals Node
    files: ['scripts/**/*.js'],
    languageOptions: { globals: globals.node },
  },
])
