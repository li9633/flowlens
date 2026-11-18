import { createApp, h } from 'vue';
import App from './App.vue';
import { installI18n } from './composables/useI18n.js';
import './assets/styles/tokens.css';
import './assets/styles/base.css';

/**
 * 挂载 FlowLens 应用。
 *
 * @param {HTMLElement} el  挂载点，由 LuCI 薄壳 view 创建
 * @param {Object} api      注入的 LuCI 能力，形状：
 *                          { getSummary, getDevices, getDevice, getSettings,
 *                            setSettings, resetDatabase, addPoll, i18n }
 * @returns {import('vue').App} Vue 应用实例
 *
 * 该对象是 bundle 对外唯一的入口，通过 window.WrtbwstatApp 暴露给 view。
 */
function mount(el, api) {
	if (!el)
		throw new Error('[flowlens] mount target is missing');

	if (!api || typeof api.getSummary !== 'function')
		throw new Error('[flowlens] api.getSummary is required');

	const app = createApp({
		render: () => h(App, { api })
	});

	// 文案是运行期注入的，必须在 mount 之前挂到 app 上
	installI18n(app, api.i18n);

	app.mount(el);
	return app;
}

const WrtbwstatApp = { mount };

// IIFE 产物本身也声明了同名全局变量，这里显式赋值保证入口稳定存在
window.WrtbwstatApp = WrtbwstatApp;

export default WrtbwstatApp;
