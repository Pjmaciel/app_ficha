import { defineConfig } from 'vitest/config';

declare const process: { env: Record<string, string | undefined> };

// A base é configurável para publicar em qualquer caminho do GitHub Pages.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/app_ficha/',
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
