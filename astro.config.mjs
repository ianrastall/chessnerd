import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://chessnerd.net',
  output: 'static',
  build: {
    format: 'file'
  }
});
