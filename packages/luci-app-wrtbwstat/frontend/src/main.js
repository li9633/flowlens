import { createApp, h } from 'vue';
import App from './App.vue';
import './style.css';

/**
 * 挂载 FlowLens 应用。
 *
 * @param {HTMLElement} el  挂载点，由 LuCI 薄壳 view 创建
 * @param {Object} api      注入的 LuCI 能力，形状：
 *                          { getSummary, getDevices, getDevice, getSettings, addPoll, i18n }
 * @returns {App} Vue 应用实例
 *
 * 该对象是 bundle 对外唯一的入口，通过 window.WrtbwstatApp 暴露给 view。
 */
function mount(el, api) {
	if (!el) throw new Error('[flowlens] mount target is missing');
	if (!api || typeof api.getSummary !== 'function')
		throw new Error('[flowlens] api.getSummary is required');

	const app = createApp({
		render: () => h(App, { api })
	});

	app.mount(el);
	return app;
}

const WrtbwstatApp = { mount };

// IIFE 产物本身也声明了同名全局变量，这里显式赋值保证入口稳定存在
window.WrtbwstatApp = WrtbwstatApp;

export default WrtbwstatApp;
