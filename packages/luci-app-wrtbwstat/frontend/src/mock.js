/**
 * 开发用 mock RPC。
 *
 * 形状与 LuCI 薄壳 view 注入的 api 完全一致，便于在 M2a 阶段脱离路由器
 * 单独跑通交互。真实环境由 view 用 rpc.declare() 实现同名函数。
 */

const DAY = 86400;

const RANGES = [
	{ range: 'today', days: 1, total: 1.8e9 },
	{ range: 'yesterday', days: 1, total: 2.4e9 },
	{ range: 'last7', days: 7, total: 15.2e9 },
	{ range: 'last30', days: 30, total: 61.5e9 },
	{ range: 'last90', days: 90, total: 172.4e9 }
];

const DEVICES = [
	{ mac: 'aa:bb:cc:00:11:01', hostname: '客厅电视', weight: 0.32 },
	{ mac: 'aa:bb:cc:00:11:02', hostname: 'MacBook-Pro', weight: 0.24 },
	{ mac: 'aa:bb:cc:00:11:03', hostname: 'iPhone-15', weight: 0.18 },
	{ mac: 'aa:bb:cc:00:11:04', hostname: 'nas', weight: 0.14 },
	{ mac: 'aa:bb:cc:00:11:05', hostname: '', weight: 0.07 },
	{ mac: 'aa:bb:cc:00:11:06', hostname: '扫地机器人', weight: 0.05 }
];

function makeSeries(range, total) {
	const days = RANGES.find(function(r) { return r.range === range; })?.days ?? 1;
	const out = [];

	for (let i = days - 1; i >= 0; i--) {
		const wave = 0.6 + 0.4 * Math.sin(i);
		out.push({
			date: new Date(Date.now() - i * DAY * 1000).toISOString().slice(0, 10),
			rx_bytes: Math.round((total / days) * wave * 0.82),
			tx_bytes: Math.round((total / days) * wave * 0.18)
		});
	}

	return out;
}

function devicesFor(range, sort, keyword) {
	const rangeTotal = RANGES.find(function(r) { return r.range === range; })?.total ?? 0;
	const now = Math.floor(Date.now() / 1000);

	const list = DEVICES
		.filter(function(d) {
			if (!keyword) return true;
			const kw = keyword.toLowerCase();
			return d.hostname.toLowerCase().includes(kw) || d.mac.includes(kw);
		})
		.map(function(d, index) {
			const total_bytes = Math.round(rangeTotal * d.weight);
			return {
				mac: d.mac,
				hostname: d.hostname || d.mac,
				rx_bytes: Math.round(total_bytes * 0.84),
				tx_bytes: Math.round(total_bytes * 0.16),
				total_bytes: total_bytes,
				share: d.weight,
				first_seen: now - (index + 1) * 3600,
				last_seen: now - index * 60
			};
		});

	const key = { total: 'total_bytes', rx: 'rx_bytes', tx: 'tx_bytes', mac: 'mac', hostname: 'hostname' }[sort] || 'total_bytes';

	return list.sort(function(a, b) {
		if (typeof a[key] === 'string') return a[key].localeCompare(b[key]);
		return b[key] - a[key];
	});
}

export function createMockApi() {
	return {
		async getSummary(range) {
			return {
				range: range,
				updated: Math.floor(Date.now() / 1000),
				ranges: RANGES.map(function(r) {
					return {
						range: r.range,
						days: r.days,
						rx_bytes: Math.round(r.total * 0.84),
						tx_bytes: Math.round(r.total * 0.16),
						total_bytes: r.total,
						series: makeSeries(r.range, r.total)
					};
				})
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
			return { mac: mac, hostname: mac, range: range, days: [], protocols: [] };
		},

		async getSettings() {
			return { storage_dir: '/mnt/usb/nlbwmon', retention_days: 95, refresh_interval: 30 };
		},

		// dev 预览没有 LuCI 的页面生命周期，用 window.setInterval 近似
		addPoll(fn, interval) {
			window.setInterval(fn, interval * 1000);
		},

		i18n: {
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
			error: '流量数据加载失败。'
		}
	};
}
