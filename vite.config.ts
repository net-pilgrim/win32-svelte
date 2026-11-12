import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { win32RcPlugin } from './src/rc/plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    win32RcPlugin(),
    svelte(),
  ],
  build: {
    cssMinify: false,
  },
})
