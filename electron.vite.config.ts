import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

const ROOT = resolve(__dirname)
const LIVE2D_ROOT = resolve(ROOT, 'live2d')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(ROOT, 'src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve(ROOT, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(ROOT, 'src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(ROOT, 'src/preload/index.ts'),
          'context-menu': resolve(ROOT, 'src/preload/context-menu.ts'),
        },
      },
    },
  },
  renderer: {
    root: resolve(ROOT, 'src/renderer'),
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(ROOT, 'src/renderer/src'),
        '@shared': resolve(ROOT, 'src/shared'),
        '@live2d': LIVE2D_ROOT,
      },
    },
    server: {
      fs: {
        allow: [ROOT, LIVE2D_ROOT],
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(ROOT, 'src/renderer/index.html'),
          chat: resolve(ROOT, 'src/renderer/chat.html'),
          'context-menu': resolve(ROOT, 'src/renderer/context-menu.html'),
        },
      },
    },
  },
})
