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
		ranges: [
			{ range: 'today', days: 1, rx_bytes: 1073741824, tx_bytes: 268435456, total_bytes: 1342177280, series: [] },
			{ range: 'yesterday', days: 1, rx_bytes: 2147483648, tx_bytes: 536870912, total_bytes: 2684354560, series: [] }
		]
	}),
	getDevices: async () => ({
		devices: [
			{ mac: 'aa:bb:cc:00:11:01', hostname: 'living-room-tv', rx_bytes: 1073741824, tx_bytes: 104857600, total_bytes: 1178599424 },
			{ mac: 'aa:bb:cc:00:11:02', hostname: 'macbook', rx_bytes: 268435456, tx_bytes: 67108864, total_bytes: 335544320 }
		]
	}),
	getDevice: async () => ({ days: [] }),
	getSettings: async () => ({ refresh_interval: 0, retention_days: 95 }),
	addPoll: () => {},
	i18n: {
		title: 'Traffic usage', today: 'Today', yesterday: 'Yesterday',
		last7: 'Last 7 days', last30: 'Last 30 days', last90: 'Last 90 days',
		device: 'Device', download: 'Download', upload: 'Upload', total: 'Total',
		share: 'Share', search: 'Search device', empty: 'No traffic data yet.',
		loading: 'Loading…', error: 'Failed to load traffic data.'
	}
};

const el = window.document.getElementById('wrtbwstat-app');
window.WrtbwstatApp.mount(el, api);

setTimeout(() => {
	const html = el.innerHTML;
	const checks = {
		'挂载后渲染出标题': html.includes('Traffic usage'),
		'渲染出 5 个时间窗按钮': (html.match(/class="btn cbi-button/g) || []).length === 5,
		'渲染出汇总卡片数值': html.includes('1.25 GB'),
		'渲染出设备行': html.includes('living-room-tv') && html.includes('macbook'),
		'渲染出占比': /%/.test(html),
		'未落入错误分支': !html.includes('Failed to load traffic data')
	};

	let ok = true;
	for (const [ name, pass ] of Object.entries(checks)) {
		console.log((pass ? 'PASS  ' : 'FAIL  ') + name);
		if (!pass) ok = false;
	}

	const jsGzip = gzipSize(BUNDLE);
	const cssGzip = gzipSize(STYLES);
	const total = Math.round((jsGzip + cssGzip) / 1024);
	console.log('\ngzip 体积：app.js ' + Math.round(jsGzip / 1024) + ' KB + app.css ' + Math.round(cssGzip / 1024) + ' KB = ' + total + ' KB（预算 120 KB）');

	if (total > 120) {
		console.log('FAIL  前端 gzip 总量超出 120 KB 预算');
		ok = false;
	}

	if (!ok) {
		console.log('\n--- innerHTML 片段 ---\n' + html.slice(0, 800));
		process.exit(1);
	}

	console.log('\n产物校验通过。');
}, 300);
