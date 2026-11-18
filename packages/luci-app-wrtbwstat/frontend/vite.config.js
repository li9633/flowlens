import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// FlowLens 前端构建配置
//
// 约束（设计文档 5.2.3 / 5.2.6 / 5.5）：
//   - 产物为 IIFE，单一入口 window.WrtbwstatApp，供 LuCI 薄壳 view 挂载
//   - 使用 Vue runtime-only 构建，模板在构建期编译，产物中不得出现 new Function
//   - JS/CSS 输出固定在 htdocs/luci-static/resources/wrtbwstat/，产物入库
//   - gzip 总体积目标 <= 120 KB

export default defineConfig({
  plugins: [ vue() ],

  resolve: {
    alias: {
      // 显式锁定 runtime-only，避免误用带编译器的完整构建
      vue: 'vue/dist/vue.runtime.esm-bundler.js',
      '@': new URL('./src', import.meta.url).pathname
    }
  },

  define: {
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false'
  },

  build: {
    outDir: '../htdocs/luci-static/resources/wrtbwstat',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    minify: 'esbuild',
    lib: {
      entry: 'src/main.js',
      name: 'WrtbwstatApp',
      formats: [ 'iife' ],
      fileName: () => 'app.js'
    },
    rollupOptions: {
      output: {
        assetFileNames: 'app.[ext]',
        inlineDynamicImports: true
      }
    }
  }
});
