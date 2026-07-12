import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages 등 서브패스 배포 시 base 조정
  base: './',
  build: { target: 'es2020' },
});
