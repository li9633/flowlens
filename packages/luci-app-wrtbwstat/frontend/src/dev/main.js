/**
 * 开发预览入口（仅 npm run dev 使用，不参与 build 产物）。
 *
 * 与真机的唯一差别是 api 来自 mocks：走的是同一个 mount 入口，同一份组件树，
 * 所以预览里看到的排版与交互就是设备上的。
 */

import WrtbwstatApp from '../main.js';
import { createMockApi } from '../mocks/api.js';

WrtbwstatApp.mount(document.getElementById('app'), createMockApi());
