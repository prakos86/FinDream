import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // React core - siempre necesario
            'vendor-react': ['react', 'react-dom'],
            // Firebase - se carga al login
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            // Charts - solo en pantalla Suenos/Balance
            'vendor-charts': ['recharts'],
            // Animaciones
            'vendor-motion': ['motion'],
            // Iconos Lucide
            'vendor-lucide': ['lucide-react'],
            // PDF y Excel - solo al importar documentos (lazy ya aplicado)
            'vendor-pdf': ['pdfjs-dist'],
            'vendor-xlsx': ['xlsx'],
          },
        },
      },
      // Aumentar warning threshold para chunks grandes
      chunkSizeWarningLimit: 1000,
    },
  };
});
