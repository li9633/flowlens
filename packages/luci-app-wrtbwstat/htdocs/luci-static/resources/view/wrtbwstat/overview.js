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

// LuCI 的 _() 依赖 /usr/lib/lua/luci/i18n 里的 .lmo。本应用随包提供
// wrtbwstat.zh-cn.lmo，但不同固件的语言目录命名不一定一致；为了不出现
// "一半中文一半英文"，这里再加一层内置词典兜底，按 <html lang> 选择。
const UI_LANG = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
const IS_ZH = UI_LANG.indexOf('zh') === 0;

const ZH = {
	'Traffic usage': '流量统计',
	'Today': '今天',
	'Yesterday': '昨天',
	'Last 7 days': '近 7 天',
	'Last 30 days': '近 30 天',
	'Last 90 days': '近 90 天',
	'Device': '设备',
	'Download': '下行',
	'Upload': '上行',
	'Total': '合计',
	'Share': '占比',
	'Search device': '搜索设备',
	'No traffic data yet.': '暂无流量数据。',
	'Loading…': '加载中…',
	'Failed to load traffic data.': '加载流量数据失败。',
	'Failed to initialize the traffic statistics frontend.': '流量统计前端初始化失败。',
	'Device details': '设备详情',
	'Daily usage': '按日用量',
	'Protocol distribution': '协议分布',
	'Close': '关闭',
	'Back': '返回',
	'Unknown device': '未知设备',
	'Settings': '设置',
	'Save': '保存',
	'Saved': '已保存',
	'Database directory': '数据库目录',
	'Retention (days)': '保留天数',
	'Auto refresh': '自动刷新',
	'Commit interval': '落盘间隔',
	'Compress old periods': '压缩旧账期',
	'Off': '关闭',
	'seconds': '秒',
	'Refresh interval takes effect after reloading the page.': '刷新间隔的改动在刷新页面后生效。',
	'Danger zone': '危险操作',
	'Reset database': '清空数据库',
	'I understand all history will be deleted': '我确认将删除全部历史数据',
	'Please tick the confirmation box first.': '请先勾选确认框。',
	'Database cleared.': '数据库已清空。',
	'Capacity protection': '容量保护',
	'Validated limit: 90 days x 200 devices/day (18,000 device-days) is 100%.': '实测上限：90 天 × 200 台/天（18000 设备日）为 100%。',
	'When usage exceeds 80%, the oldest history archives are deleted automatically until the load falls back under the threshold.': '使用率超过 80% 时，自动删除最旧的历史归档，把负载压回阈值以内。',
	'Cleaned-up days still appear in the 90-day window but show zero traffic.': '被清理的日期仍会出现在 90 天窗口中，但流量显示为 0。',
	'Current load': '当前使用率',
	'device-days': '设备日',
	'Capacity metrics will appear after the next data refresh.': '容量指标将在下次数据刷新后显示。',
	'Last cleanup': '上次清理',
	'history kept': '保留最近',
	'days': '天',
	'archives removed': '个归档已删除',
	'nlbw command not found, nlbwmon may not be installed.': '未找到 nlbw 命令，nlbwmon 可能未安装。',
	'nlbwmon has no database directory configured.': 'nlbwmon 未配置数据库目录。',
	'Database directory is on tmpfs ({dir}), history will be lost after reboot.': '数据库目录位于 tmpfs（{dir}），重启后历史数据会丢失。',
	'nf_conntrack_acct is disabled, counters may be missing or low.': '未开启 nf_conntrack_acct，流量计数可能缺失或偏低。',
	'A fullcone NAT module was detected, conntrack events may not reach nlbwmon.': '检测到 fullcone NAT 模块，conntrack 事件可能无法送达 nlbwmon。',
	'nlbwmon has no local_network configured, no traffic will be counted.': 'nlbwmon 未配置 local_network，可能统计不到任何网段。',
	'Database directory must not be empty.': '数据库目录不能为空。',
	'Database directory must not be on tmpfs (/tmp, /var) or the root directory, otherwise history is lost after reboot.': '数据库目录不能位于 tmpfs（/tmp、/var）或根目录，否则重启后会丢失历史。',
	'Retention must be between 90 and 3650 days.': '保留天数需在 90 至 3650 天之间。',
	'Auto refresh must be one of 0 / 10 / 30 / 60.': '自动刷新间隔只能是 0 / 10 / 30 / 60 秒。',
	'Commit interval must look like 6h or 30m.': '落盘间隔格式应形如 6h 或 30m。',
	'Failed to write configuration: {detail}': '写入配置失败：{detail}',
	'confirm=true is required to clear the database.': '需要 confirm=true 才能清空数据库。',
	'Database directory is not configured or not usable, aborted.': '数据库目录未配置或不可用，已中止。',
	'Invalid MAC address.': 'MAC 地址无效。',
};

function T(src) {
	const translated = _(src);

	if (translated !== src)
		return translated;          // LuCI 翻译生效（.lmo 已加载）

	return IS_ZH ? (ZH[src] || src) : src;
}


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

const callSetSettings = rpc.declare({
	object: 'luci.wrtbwstat',
	method: 'set_settings',
	params: [ 'storage_dir', 'retention_days', 'commit_interval', 'compress', 'refresh_interval' ]
});

const callResetDatabase = rpc.declare({
	object: 'luci.wrtbwstat',
	method: 'reset_database',
	params: [ 'confirm' ]
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
				T('Failed to initialize the traffic statistics frontend.'));

		App.mount(el, {
			getSummary: callGetSummary,
			getDevices: callGetDevices,
			getDevice: callGetDevice,
			getSettings: callGetSettings,
			setSettings: callSetSettings,
			resetDatabase: callResetDatabase,
			addPoll: poll.add,
			// 文案在 view 侧用 _() 注入：LuCI 的翻译扫描器不解析 .vue 文件
			i18n: {
				title: T('Traffic usage'),
				today: T('Today'),
				yesterday: T('Yesterday'),
				last7: T('Last 7 days'),
				last30: T('Last 30 days'),
				last90: T('Last 90 days'),
				device: T('Device'),
				download: T('Download'),
				upload: T('Upload'),
				total: T('Total'),
				share: T('Share'),
				search: T('Search device'),
				empty: T('No traffic data yet.'),
				loading: T('Loading…'),
				error: T('Failed to load traffic data.'),

				// 设备详情
				detail: T('Device details'),
				daily: T('Daily usage'),
				protocols: T('Protocol distribution'),
				close: T('Close'),
				back: T('Back'),

				// 设置
				settings: T('Settings'),
				save: T('Save'),
				saved: T('Saved'),
				storageDir: T('Database directory'),
				retention: T('Retention (days)'),
				refreshInterval: T('Auto refresh'),
				commitInterval: T('Commit interval'),
				compress: T('Compress old periods'),
				off: T('Off'),
				seconds: T('seconds'),
				refreshHint: T('Refresh interval takes effect after reloading the page.'),
				dangerZone: T('Danger zone'),
				resetDb: T('Reset database'),
				resetConfirm: T('I understand all history will be deleted'),
				resetNeedConfirm: T('Please tick the confirmation box first.'),
				resetDone: T('Database cleared.'),

				// 容量保护
				capacityTitle: T('Capacity protection'),
				capacityRule: T('Validated limit: 90 days x 200 devices/day (18,000 device-days) is 100%.'),
				capacityAction: T('When usage exceeds 80%, the oldest history archives are deleted automatically until the load falls back under the threshold.'),
				capacityEffect: T('Cleaned-up days still appear in the 90-day window but show zero traffic.'),
				capacityUsage: T('Current load'),
				capacityDeviceDays: T('device-days'),
				capacityPending: T('Capacity metrics will appear after the next data refresh.'),
				capacityLastCleanup: T('Last cleanup'),
				capacityKeep: T('history kept'),
				capacityDays: T('days'),
				capacityArchives: T('archives removed'),

				// 后端返回的语言中立 code —— 具体文案在这里翻译
				unknownDevice: T('Unknown device'),
				warnNlbwMissing: T('nlbw command not found, nlbwmon may not be installed.'),
				warnNoDirectory: T('nlbwmon has no database directory configured.'),
				warnTmpfs: T('Database directory is on tmpfs ({dir}), history will be lost after reboot.'),
				warnAcctOff: T('nf_conntrack_acct is disabled, counters may be missing or low.'),
				warnFullcone: T('A fullcone NAT module was detected, conntrack events may not reach nlbwmon.'),
				warnNoLocalNet: T('nlbwmon has no local_network configured, no traffic will be counted.'),
				errDirEmpty: T('Database directory must not be empty.'),
				errDirTmpfs: T('Database directory must not be on tmpfs (/tmp, /var) or the root directory, otherwise history is lost after reboot.'),
				errRetention: T('Retention must be between 90 and 3650 days.'),
				errRefresh: T('Auto refresh must be one of 0 / 10 / 30 / 60.'),
				errCommit: T('Commit interval must look like 6h or 30m.'),
				errWrite: T('Failed to write configuration: {detail}'),
				errConfirm: T('confirm=true is required to clear the database.'),
				errDirUnavailable: T('Database directory is not configured or not usable, aborted.'),
				errInvalidMac: T('Invalid MAC address.')
			}
		});

		return el;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
