import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          [
            'babel-plugin-react-compiler',
            {
              target: '19', // React 19
            },
          ],
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // ローカル開発時にAPIリクエストをCloudflare Workerにプロキシ
      '/api': {
        target: 'https://haroin57.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    // チャンク分割の最適化
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // React関連を別チャンクに (Windows/Unix両対応)
          if (id.includes('node_modules/react') || id.includes('node_modules\\react')) {
            return 'react-vendor'
          }
          // mermaidを完全に分離（動的インポート時のみ読み込み）
          if (id.includes('node_modules/mermaid') || id.includes('node_modules\\mermaid') ||
              id.includes('node_modules/cytoscape') || id.includes('node_modules\\cytoscape') ||
              id.includes('node_modules/dagre') || id.includes('node_modules\\dagre') ||
              id.includes('node_modules/elkjs') || id.includes('node_modules\\elkjs')) {
            return 'mermaid'
          }
          // 重いライブラリを分離
          if (id.includes('node_modules/remark') || id.includes('node_modules\\remark') ||
              id.includes('node_modules/rehype') || id.includes('node_modules\\rehype')) {
            return 'markdown'
          }
          return undefined
        },
      },
    },
    // ターゲットを最新ブラウザに
    target: 'esnext',
  },
})
