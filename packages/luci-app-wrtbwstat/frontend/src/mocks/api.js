/**
 * 开发用 mock API。
 *
 * 形状与 LuCI 薄壳 view 注入的 api 完全一致（含 i18n 字典），
 * 因此 dev 预览与真机走的是同一条渲染路径，不需要任何环境分支。
 */

import {
	DEVICE_FIXTURES,
	PROTOCOL_FIXTURES,
	RANGE_FIXTURES,
	buildSeries,
	totalOf
} from './fixtures.js';

const I18N = {
	title: '流量统计（开发预览）',
	today: '今日',
	yesterday: '昨日',
	last7: '近 7 天',
	last30: '近 30 天',
	last90: '近 90 天',
	device: '设备',
	download: '下行',
	upload: '上行',
	total: '合计',
	share: '占比',
	search: '搜索设备',
	empty: '暂无流量数据。',
	loading: '加载中…',
	error: '流量数据加载失败。',
	detail: '设备详情',
	daily: '按日用量',
	protocols: '协议分布',
	close: '关闭',
	back: '返回',
	settings: '设置',
	save: '保存',
	saved: '已保存',
	storageDir: '数据库目录',
	retention: '保留天数',
	refreshInterval: '自动刷新',
	commitInterval: '落盘间隔',
	compress: '压缩旧账期',
	off: '关闭',
	seconds: '秒',
	refreshHint: '刷新间隔的改动在刷新页面后生效。',
	dangerZone: '危险操作',
	resetDb: '清空数据库',
	resetConfirm: '我确认将删除全部历史数据',
	resetNeedConfirm: '请先勾选确认框。',
	resetDone: '数据库已清空。',
	unknownDevice: '未知设备',
	warnTmpfs: '数据库目录位于 tmpfs（{dir}），重启后历史数据会丢失。',
	warnNlbwMissing: 'nlbw 命令缺失，nlbwmon 可能未安装。',
	warnNoDirectory: 'nlbwmon 未配置数据库目录。',
	warnAcctOff: 'nf_conntrack_acct 未开启，计数可能缺失或偏低。',
	warnFullcone: '检测到 fullcone NAT 模块，可能导致 conntrack 事件无法送达 nlbwmon。',
	warnNoLocalNet: 'nlbwmon 未配置 local_network，可能统计不到任何网段。',
	errDirEmpty: '数据库目录不能为空。',
	errDirTmpfs: '数据库目录不能位于 tmpfs（/tmp、/var）或根目录，否则重启丢历史。',
	errRetention: '保留天数需在 90-3650 之间。',
	errRefresh: '自动刷新只能是 0 / 10 / 30 / 60。',
	errCommit: '落盘间隔格式应为 6h / 30m 之类。',
	errWrite: '写入配置失败：{detail}',
	errConfirm: '需要 confirm=true 才能清空数据库。',
	errDirUnavailable: '数据库目录未配置或不可用，已拒绝执行。',
	errInvalidMac: 'MAC 地址无效。'
};

const SORT_FIELDS = {
	total: 'total_bytes',
	rx: 'rx_bytes',
	tx: 'tx_bytes',
	mac: 'mac',
	hostname: 'hostname'
};

function devicesFor(range, sort, keyword) {
	const total = totalOf(range);
	const kw = String(keyword || '').toLowerCase();

	const list = DEVICE_FIXTURES
		.filter(function(d) {
			if (!kw) return true;
			return d.hostname.toLowerCase().includes(kw)
				|| d.mac.includes(kw)
				|| d.ip.includes(kw);
		})
		.map(function(d) {
			const total_bytes = Math.round(total * d.weight);

			return {
				mac: d.mac,
				hostname: d.hostname,
				ip: d.ip,
				unknown_source: false,
				rx_bytes: Math.round(total_bytes * 0.84),
				tx_bytes: Math.round(total_bytes * 0.16),
				total_bytes: total_bytes,
				share: d.weight
			};
		});

	const key = SORT_FIELDS[sort] || SORT_FIELDS.total;

	return list.sort(function(a, b) {
		if (typeof a[key] === 'string')
			return a[key].localeCompare(b[key]);
		return b[key] - a[key];
	});
}

export function createMockApi() {
	return {
		async getSummary(range) {
			return {
				range: range,
				updated: Math.floor(Date.now() / 1000),
				ranges: RANGE_FIXTURES.map(function(r) {
					return {
						range: r.range,
						days: r.days,
						rx_bytes: Math.round(r.total * 0.84),
						tx_bytes: Math.round(r.total * 0.16),
						total_bytes: r.total,
						series: buildSeries(r.range, r.total)
					};
				}),
				// 故意留一条告警，用来验证提示条的换行与多语言
				warnings: [ { code: 'warnTmpfs', dir: '/var/lib/nlbwmon' } ]
			};
		},

		async getDevices(range, sort, keyword) {
			const devices = devicesFor(range, sort, keyword);

			return {
				range: range,
				sort: sort,
				keyword: keyword,
				total_bytes: devices.reduce(function(s, d) { return s + d.total_bytes; }, 0),
				devices: devices
			};
		},

		async getDevice(mac, range) {
			const device = DEVICE_FIXTURES.find(function(d) { return d.mac === mac; });
			const total = totalOf(range) * (device ? device.weight : 0.2);

			return {
				mac: mac,
				hostname: device ? device.hostname : mac,
				range: range,
				days: buildSeries(range, total).map(function(d) {
					return { date: d.date, rx_bytes: d.rx_bytes, tx_bytes: d.tx_bytes };
				}),
				protocols: PROTOCOL_FIXTURES
			};
		},

		async getSettings() {
			return {
				storage_dir: '/dockers-data/nlbwmon',
				retention_days: 95,
				commit_interval: '6h',
				compress: true,
				refresh_interval: 30,
				collector: { directory: '/dockers-data/nlbwmon' }
			};
		},

		async setSettings(storage_dir) {
			if (typeof storage_dir === 'string' && storage_dir.startsWith('/tmp'))
				return { success: false, errors: [ 'errDirTmpfs' ] };

			return { success: true };
		},

		async resetDatabase(confirm) {
			return { success: confirm === true, removed: 3, failed: 0 };
		},

		// dev 预览没有 LuCI 的页面生命周期，用 window.setInterval 近似
		addPoll(fn, interval) {
			window.setInterval(fn, interval * 1000);
		},

		i18n: I18N
	};
}
