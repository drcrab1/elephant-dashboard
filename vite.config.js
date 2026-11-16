import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rolldownOptions: {
      output: {
        // 자주 안 바뀌는 큰 도구(Firebase, React)는 따로 묶습니다.
        // 앱을 새로 배포해도 이 묶음은 그대로라서, 다시 접속할 때 새로 받지 않아 빨리 열립니다.
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\/](@firebase|firebase)[\/]/ },
            { name: 'react', test: /node_modules[\/](react|react-dom|scheduler)[\/]/ },
          ],
        },
      },
    },
  },
})
