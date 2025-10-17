// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()], // ✅ important for TSX/JSX
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
    ],
    exclude: [
      'node_modules/**',
      'tests/e2e/**',
      '.next/**',
      'dist/**',
      'build/**',
      '**/*.config.*',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  esbuild: {
    // ensure automatic JSX runtime if needed
    jsx: 'automatic',
    jsxDev: true,
  },
})
