// 开发预览入口（仅 npm run dev 使用，不参与 build 产物）
import WrtbwstatApp from './main.js';
import { createMockApi } from './mock.js';

WrtbwstatApp.mount(document.getElementById('app'), createMockApi());
