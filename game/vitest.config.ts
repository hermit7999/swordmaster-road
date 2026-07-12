import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node', // 판정/입력 로직은 순수 TS — DOM 불필요 (ADR-009)
  },
});
