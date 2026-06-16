// vite.config.js
// Configuration Vite pour PortFlow
// Plugins : React (JSX) + Tailwind CSS v4

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})