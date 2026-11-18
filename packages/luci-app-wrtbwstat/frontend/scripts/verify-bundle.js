/**
 * 产物挂载验证（对应设计文档第 8 节验收条目 7 与 9）
 *
 * 在 jsdom 中加载 htdocs 下已提交的 app.js，模拟 LuCI 薄壳 view 注入 api 后挂载，
 * 断言能渲染出标题、时间窗、汇总与设备行。用于拦截"源码改了但产物忘了重建"。
 *
 * 用法：npm run verify（在 frontend/ 下执行；需先 npm run build）
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../htdocs/luci-static/resources/wrtbwstat');
const BUNDLE = path.join(outDir, 'app.js');
const STYLES = path.join(outDir, 'app.css');

function gzipSize(file) {
	return zlib.gzipSync(fs.readFileSync(file)).length;
}

function fail(message) {
	console.error('FAIL  ' + message);
	process.exit(1);
}

for (const file of [ BUNDLE, STYLES ]) {
	if (!fs.existsSync(file))
		fail('产物缺失：' + file + '（先执行 npm run build）');
}

const source = fs.readFileSync(BUNDLE, 'utf8');

// 静态检查：runtime-only 构建不应出现运行时模板编译与 eval
if (/new Function\s*\(/.test(source))
	fail('产物中出现 new Function，违背 runtime-only 约束（CSP 落地后会被拦）');
if (/\beval\s*\(/.test(source))
	fail('产物中出现 eval(');
if (/process\.env/.test(source))
	fail('产物中残留 process.env，浏览器会抛 "process is not defined"');

const dom = new JSDOM(
	'<!doctype html><html><head></head><body><div id="wrtbwstat-app"></div></body></html>',
	{ runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://192.168.1.1/cgi-bin/luci/admin/network/wrtbwstat' }
);

const { window } = dom;
window.eval(source);

if (!window.WrtbwstatApp || typeof window.WrtbwstatApp.mount !== 'function')
	fail('window.WrtbwstatApp.mount 不存在');

// 与 LuCI 薄壳 view 注入的 api 保持完全同形
const api = {
	getSummary: async () => ({
		warnings: [ { code: 'warnTmpfs', dir: '/var/lib/nlbwmon' } ],
		ranges: [
			{ range: 'today', days: 1, rx_bytes: 1073741824, tx_bytes: 268435456, total_bytes: 1342177280, series: [] },
			{ range: 'yesterday', days: 1, rx_bytes: 2147483648, tx_bytes: 536870912, total_bytes: 2684354560, series: [] }
		]
	}),
	getDevices: async () => ({
		devices: [
			{ mac: 'aa:bb:cc:00:11:01', hostname: 'living-room-tv', ip: '192.168.2.50', unknown_source: false, rx_bytes: 1073741824, tx_bytes: 104857600, total_bytes: 1178599424 },
			{ mac: 'aa:bb:cc:00:11:02', hostname: '', ip: '192.168.2.51', unknown_source: false, rx_bytes: 268435456, tx_bytes: 67108864, total_bytes: 335544320 },
			{ mac: '00:00:00:00:00:00', hostname: '', ip: null, unknown_source: true, rx_bytes: 1048576, tx_bytes: 0, total_bytes: 1048576 }
		]
	}),
	getDevice: async () => ({
		proto_field: 'layer7',
		days: [
			{ date: '2026-11-17', rx_bytes: 1073741824, tx_bytes: 104857600 },
			{ date: '2026-11-18', rx_bytes: 536870912, tx_bytes: 52428800 }
		],
		protocols: [
			{ name: 'HTTPS', total_bytes: 1073741824, share: 0.7 },
			{ name: 'HTTP', total_bytes: 471859200, share: 0.3 }
		]
	}),
	getSettings: async () => ({
		storage_dir: '/var/lib/nlbwmon', retention_days: 95,
		// 故意用非默认值 30：表单若没真正回填，下拉会停在首项 0（"Off"），
		// 断言就能分辨"渲染了默认值"和"绑上了后端值"
		commit_interval: '6h', compress: true, refresh_interval: 30,
		collector: { directory: '/var/lib/nlbwmon' }
	}),
	setSettings: async () => ({ success: true }),
	resetDatabase: async (confirm) => ({ success: confirm === true, removed: 2 }),
	addPoll: () => {},
	i18n: {
		title: 'Traffic usage', today: 'Today', yesterday: 'Yesterday',
		last7: 'Last 7 days', last30: 'Last 30 days', last90: 'Last 90 days',
		device: 'Device', download: 'Download', upload: 'Upload', total: 'Total',
		share: 'Share', search: 'Search device', empty: 'No traffic data yet.',
		loading: 'Loading…', error: 'Failed to load traffic data.',
		warnTmpfs: 'Database directory is on tmpfs ({dir}), history will be lost after reboot.',
		unknownDevice: 'Unknown device',
		detail: 'Device details', daily: 'Daily usage', protocols: 'Protocol distribution',
		close: 'Close', back: 'Back', settings: 'Settings', save: 'Save', saved: 'Saved',
		storageDir: 'Database directory', retention: 'Retention (days)',
		refreshInterval: 'Auto refresh', commitInterval: 'Commit interval',
		compress: 'Compress old periods', off: 'Off', seconds: 'seconds',
		refreshHint: 'Refresh interval takes effect after reloading the page.',
		dangerZone: 'Danger zone', resetDb: 'Reset database',
		resetConfirm: 'I understand all history will be deleted',
		resetNeedConfirm: 'Please tick the confirmation box first.',
		resetDone: 'Database cleared.'
	}
};

const el = window.document.getElementById('wrtbwstat-app');
window.WrtbwstatApp.mount(el, api);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
	await wait(300);

	let html = el.innerHTML;

	const checks = {
		'挂载后渲染出标题': html.includes('Traffic usage'),
		'渲染出 5 个时间窗按钮': (html.match(/role="tab"/g) || []).length === 5,
		'渲染出汇总卡片数值': html.includes('1.25 GB'),
		'渲染出设备行': html.includes('living-room-tv') && html.includes('aa:bb:cc:00:11:02'),
		'有主机名：MAC 作副标题（只出现一次）': (html.match(/aa:bb:cc:00:11:01/g) || []).length === 1,
		'无主机名：标题用 MAC、副标题用 IP': html.includes('192.168.2.51') && (html.match(/aa:bb:cc:00:11:02/g) || []).length === 1,
		'未知来源设备显示本地化名称': html.includes('Unknown device'),
		'渲染出占比': /%/.test(html),
		'渲染出采集告警（code 已翻译且参数替换）': html.includes('tmpfs (/var/lib/nlbwmon)'),
		'未落入错误分支': !html.includes('Failed to load traffic data')
	};

	let ok = true;
	for (const [ name, pass ] of Object.entries(checks)) {
		console.log((pass ? 'PASS  ' : 'FAIL  ') + name);
		if (!pass) ok = false;
	}

	// 交互：点设备行应展开详情（含协议分布）
	const row = el.querySelector('tbody tr');
	if (!row) {
		console.log('FAIL  找不到设备行，无法测试详情交互');
		ok = false;
	}
	else {
		row.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		await wait(200);
		const dh = el.innerHTML;
		for (const [ name, pass ] of Object.entries({
			'点击设备行展开详情': dh.includes('Device details'),
			'详情渲染按日用量': dh.includes('Daily usage'),
			'详情渲染协议分布': dh.includes('Protocol distribution') && dh.includes('HTTPS')
		})) {
			console.log((pass ? 'PASS  ' : 'FAIL  ') + name);
			if (!pass) ok = false;
		}
	}

	// 交互：设置面板应出现表单
	const btn = Array.from(el.querySelectorAll('button'))
		.find((b) => b.textContent.trim() === 'Settings');
	if (!btn) {
		console.log('FAIL  找不到设置按钮');
		ok = false;
	}
	else {
		btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		await wait(200);
		const sh = el.innerHTML;
		for (const [ name, pass ] of Object.entries({
			'设置面板渲染存储目录': sh.includes('Database directory'),
			'设置面板渲染保留天数': sh.includes('Retention (days)'),
			'设置面板渲染危险操作': sh.includes('Danger zone')
		})) {
			console.log((pass ? 'PASS  ' : 'FAIL  ') + name);
			if (!pass) ok = false;
		}

		/*
		 * 表单必须"回填"而不是只画出标签：BaseInput/BaseSelect 曾漏把 model
		 * 绑到原生元素上，标签齐全但输入框全空，只查文字是抓不到的。
		 */
		const fields = Array.from(el.querySelectorAll('.fl-form input, .fl-form select'));
		const values = fields.map((f) => f.value);
		const checks = {
			'设置面板回填存储目录值': values[0] === '/var/lib/nlbwmon',
			'设置面板回填保留天数': values[1] === '95',
			'设置面板回填刷新间隔': values[3] === '30',
			'压缩开关处于勾选状态': !!el.querySelector('.fl-switch input')?.checked,
			'未勾选确认时清库按钮禁用': !!el.querySelector('.fl-btn.is-danger')?.disabled
		};

		for (const [ name, pass ] of Object.entries(checks)) {
			console.log((pass ? 'PASS  ' : 'FAIL  ') + name);
			if (!pass) ok = false;
		}
	}

	const jsGzip = gzipSize(BUNDLE);
	const cssGzip = gzipSize(STYLES);
	const total = Math.round((jsGzip + cssGzip) / 1024);
	console.log('\ngzip 体积：app.js ' + Math.round(jsGzip / 1024) + ' KB + app.css ' + Math.round(cssGzip / 1024) + ' KB = ' + total + ' KB（预算 120 KB）');

	if (total > 120) {
		console.log('FAIL  前端 gzip 总量超出 120 KB 预算');
		ok = false;
	}

	// 中文渲染：同一份 bundle，只换 i18n 字典，整页不应残留英文标签
	const zhI18n = Object.assign({}, api.i18n, {
		title: '流量统计', today: '今天', yesterday: '昨天', last7: '近 7 天',
		last30: '近 30 天', last90: '近 90 天', device: '设备', download: '下行',
		upload: '上行', total: '合计', share: '占比', search: '搜索设备',
		empty: '暂无流量数据。', loading: '加载中…', error: '加载流量数据失败。',
		detail: '设备详情', daily: '按日用量', protocols: '协议分布', close: '关闭',
		settings: '设置', save: '保存', saved: '已保存', storageDir: '数据库目录',
		retention: '保留天数', refreshInterval: '自动刷新', commitInterval: '落盘间隔',
		compress: '压缩旧账期', off: '关闭', seconds: '秒',
		refreshHint: '刷新间隔改动需刷新页面后生效。', dangerZone: '危险操作',
		resetDb: '清空数据库', resetConfirm: '我确认清空全部历史数据',
		resetNeedConfirm: '请先勾选确认框。', resetDone: '数据库已清空。',
		unknownDevice: '未知设备',
		warnTmpfs: '数据库目录位于 tmpfs（{dir}），重启后历史数据会丢失。',
		warnNlbwMissing: 'nlbw 命令缺失，nlbwmon 可能未安装。',
		warnNoDirectory: 'nlbwmon 未配置数据库目录。',
		warnAcctOff: 'nf_conntrack_acct 未开启，计数可能缺失或偏低。',
		warnFullcone: '检测到 fullcone NAT 模块。',
		warnNoLocalNet: 'nlbwmon 未配置 local_network。',
		errDirEmpty: '数据库目录不能为空。', errDirTmpfs: '数据库目录不能位于 tmpfs。',
		errRetention: '保留天数需在 90-3650 之间。', errRefresh: '自动刷新只能是 0 / 10 / 30 / 60。',
		errCommit: '落盘间隔格式应为 6h / 30m 之类。', errWrite: '写入配置失败：{detail}',
		errConfirm: '需要 confirm=true 才能清空数据库。',
		errDirUnavailable: '数据库目录未配置或不可用。', errInvalidMac: 'MAC 地址无效。'
	});

	const el2 = window.document.createElement('div');
	window.document.body.appendChild(el2);
	window.WrtbwstatApp.mount(el2, Object.assign({}, api, { i18n: zhI18n }));
	await wait(300);

	const zh = el2.innerHTML;
	for (const [ name, pass ] of Object.entries({
		'中文：标题已翻译': zh.includes('流量统计'),
		'中文：不再出现英文标题': !zh.includes('Traffic usage'),
		'中文：表头已翻译': zh.includes('下行') && !zh.includes('Download'),
		'中文：告警已本地化且参数替换': zh.includes('数据库目录位于 tmpfs（/var/lib/nlbwmon）')
	})) {
		console.log((pass ? 'PASS  ' : 'FAIL  ') + name);
		if (!pass) ok = false;
	}

	// 并发回归：先点「昨天」（慢响应）再点「今天」（快响应），
	// 先发后到的旧响应不能覆盖新结果，加载态也要在最后一次请求结束时收掉。
	const el3 = window.document.createElement('div');
	window.document.body.appendChild(el3);

	const raceApi = Object.assign({}, api, {
		getDevices: async (activeRange) => {
			await wait(activeRange === 'yesterday' ? 600 : 20);
			return {
				devices: [ {
					mac: 'de:ad:be:ef:00:' + (activeRange === 'yesterday' ? '99' : '9a'),
					hostname: 'race-' + activeRange,
					ip: '192.168.2.99',
					unknown_source: false,
					rx_bytes: 1024, tx_bytes: 0, total_bytes: 1024
				} ]
			};
		}
	});

	window.WrtbwstatApp.mount(el3, raceApi);
	await wait(200);

	const clickTab = (label) => {
		const tab = Array.from(el3.querySelectorAll('[role="tab"]'))
			.find((b) => b.textContent.trim() === label);
		if (!tab) return false;
		tab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
		return true;
	};

	const clickedSlow = clickTab('Yesterday');
	await wait(30);
	const clickedFast = clickTab('Today');
	await wait(900);

	const raceHtml = el3.innerHTML;
	for (const [ name, pass ] of Object.entries({
		'并发：能点到慢/快两个时间窗': clickedSlow && clickedFast,
		'并发：最终展示最后一次请求（今天）': raceHtml.includes('race-today'),
		'并发：旧响应未覆盖新数据': !raceHtml.includes('race-yesterday'),
		'并发：加载态已结束': !el3.querySelector('.fl-loading')
	})) {
		console.log((pass ? 'PASS  ' : 'FAIL  ') + name);
		if (!pass) ok = false;
	}

	// 非幂等操作回归：保存配置时连点按钮，只能提交一次
	let saveCalls = 0;
	const saveApi = Object.assign({}, api, {
		setSettings: async () => {
			saveCalls++;
			await wait(150);
			return { success: true };
		}
	});

	const el4 = window.document.createElement('div');
	window.document.body.appendChild(el4);
	window.WrtbwstatApp.mount(el4, saveApi);
	await wait(250);

	const openSettings = Array.from(el4.querySelectorAll('button'))
		.find((b) => b.textContent.trim() === 'Settings');
	openSettings.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
	await wait(250);

	const saveBtn = Array.from(el4.querySelectorAll('button'))
		.find((b) => b.textContent.trim() === 'Save');
	saveBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
	saveBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
	await wait(20);
	const saveDisabled = saveBtn.disabled;
	await wait(400);

	for (const [ name, pass ] of Object.entries({
		'非幂等：双击保存只提交一次': saveCalls === 1,
		'非幂等：保存中按钮被禁用': saveDisabled === true,
		'非幂等：保存成功提示': el4.innerHTML.includes('Saved')
	})) {
		console.log((pass ? 'PASS  ' : 'FAIL  ') + name);
		if (!pass) ok = false;
	}

	if (!ok) {
		console.log('\n--- innerHTML 片段 ---\n' + el.innerHTML.slice(0, 800));
		process.exit(1);
	}

	console.log('\n产物校验通过。');
})();
