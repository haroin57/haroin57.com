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
          // パスの正規化（Windows/Unix両対応）
          const normalizedId = id.replace(/\\/g, '/')

          // React関連を別チャンクに
          if (normalizedId.includes('node_modules/react')) {
            return 'react-vendor'
          }

          // Firebase（認証機能）を別チャンクに - 管理画面でのみ使用
          if (normalizedId.includes('node_modules/firebase') ||
              normalizedId.includes('node_modules/@firebase')) {
            return 'firebase'
          }

          // p5.js（背景アニメーション）を別チャンクに
          if (normalizedId.includes('node_modules/p5')) {
            return 'p5'
          }

          // Markdown Editor（管理画面）を別チャンクに
          if (normalizedId.includes('node_modules/@uiw/react-md-editor') ||
              normalizedId.includes('node_modules/@uiw/react-markdown-preview')) {
            return 'md-editor'
          }

          // コードハイライト関連を別チャンクに
          if (normalizedId.includes('node_modules/refractor') ||
              normalizedId.includes('node_modules/react-refractor') ||
              normalizedId.includes('node_modules/prismjs')) {
            return 'syntax-highlight'
          }

          // 注意: mermaid, remark, rehype は動的インポートされているため
          // manualChunksで指定しない（自動的に別チャンクになる）

          return undefined
        },
      },
    },
    // ターゲットを最新ブラウザに
    target: 'esnext',
  },
})
