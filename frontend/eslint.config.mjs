import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@next/next/no-img-element': 'error',
    },
  },
  {
    // eslint-config-next 16 ships react-hooks v7, whose React Compiler rules are errors by default.
    // The app does not use the compiler and had zero lint errors before this upgrade, so they stay
    // visible as warnings (about 140 findings, 114 of them set-state-in-effect) to be tightened later.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'e2e/.report/**', 'e2e/.results/**', 'next-env.d.ts']),
])
