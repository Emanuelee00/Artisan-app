import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@artisan/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
  },
})
