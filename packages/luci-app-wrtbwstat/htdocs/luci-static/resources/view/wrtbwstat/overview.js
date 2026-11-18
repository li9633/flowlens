'use strict';
'require view';
'require rpc';
'require poll';

// FlowLens —— LuCI 薄壳 view
//
// 职责严格限定为三件事：
//   1. 声明 rpc 方法（LuCI 负责附带会话令牌与 CSRF）
//   2. 加载预编译的 Vue bundle 与样式
//   3. 创建挂载点并把 api 注入 Vue
// Vue 内部不接触 LuCI 会话、不自行 fetch CGI、不使用 setInterval。
//
// 依据：doc/OpenWrt流量统计插件设计文档_v2.md 第 5.2.2 节

const BUNDLE_BASE = '/luci-static/resources/wrtbwstat';

const callGetSummary = rpc.declare({
	object: 'luci.wrtbwstat',
	method: 'get_summary',
	params: [ 'range' ]
});

const callGetDevices = rpc.declare({
	object: 'luci.wrtbwstat',
	method: 'get_devices',
	params: [ 'range', 'sort', 'keyword' ]
});

const callGetDevice = rpc.declare({
	object: 'luci.wrtbwstat',
	method: 'get_device',
	params: [ 'mac', 'range' ]
});

const callGetSettings = rpc.declare({
	object: 'luci.wrtbwstat',
	method: 'get_settings'
});

function loadStyle() {
	if (document.querySelector('link[data-wrtbwstat-style]'))
		return;

	const link = E('link', {
		'rel': 'stylesheet',
		'href': BUNDLE_BASE + '/app.css',
		'data-wrtbwstat-style': '1'
	});

	document.head.appendChild(link);
}

// LuCI 的自定义模块加载器与 ES Module 不兼容，因此 bundle 以同源 <script> 注入，
// 由 IIFE 产物在 window 上暴露单一入口对象。
function loadBundle() {
	if (window.WrtbwstatApp)
		return Promise.resolve(window.WrtbwstatApp);

	return new Promise(function(resolve, reject) {
		const s = document.createElement('script');
		s.src = BUNDLE_BASE + '/app.js';
		s.async = true;
		s.onload = function() {
			if (window.WrtbwstatApp)
				resolve(window.WrtbwstatApp);
			else
				reject(new Error('wrtbwstat bundle loaded but window.WrtbwstatApp is missing'));
		};
		s.onerror = function() {
			reject(new Error('failed to load ' + BUNDLE_BASE + '/app.js'));
		};
		document.head.appendChild(s);
	});
}

return view.extend({
	load: function() {
		loadStyle();
		return loadBundle();
	},

	render: function(App) {
		const el = E('div', { 'id': 'wrtbwstat-app' });

		if (!App || typeof App.mount !== 'function')
			return E('div', { 'class': 'alert-message warning' },
				_('Failed to initialize the traffic statistics frontend.'));

		App.mount(el, {
			getSummary: callGetSummary,
			getDevices: callGetDevices,
			getDevice: callGetDevice,
			getSettings: callGetSettings,
			addPoll: poll.add,
			// 文案在 view 侧用 _() 注入：LuCI 的翻译扫描器不解析 .vue 文件
			i18n: {
				title: _('Traffic usage'),
				today: _('Today'),
				yesterday: _('Yesterday'),
				last7: _('Last 7 days'),
				last30: _('Last 30 days'),
				last90: _('Last 90 days'),
				device: _('Device'),
				download: _('Download'),
				upload: _('Upload'),
				total: _('Total'),
				share: _('Share'),
				search: _('Search device'),
				empty: _('No traffic data yet.'),
				loading: _('Loading…'),
				error: _('Failed to load traffic data.')
			}
		});

		return el;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
