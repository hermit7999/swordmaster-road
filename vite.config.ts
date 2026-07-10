/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// GitHub Pages 프로젝트 사이트: https://hermit7999.github.io/swordmaster-road/
export default defineConfig({
  base: '/swordmaster-road/',
  build: { target: 'es2020', outDir: 'dist' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
