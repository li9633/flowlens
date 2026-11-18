/**
 * 开发预览用的假数据。
 *
 * 只为"能在脱离路由器时把交互跑通"，数值不需要真实，但结构必须与后端返回
 * 完全一致（多一个字段、少一个字段都会让界面在真机上翻车）。
 */

const DAY_SECONDS = 86400;

export const RANGE_FIXTURES = [
	{ range: 'today', days: 1, total: 1.8e9 },
	{ range: 'yesterday', days: 1, total: 2.4e9 },
	{ range: 'last7', days: 7, total: 15.2e9 },
	{ range: 'last30', days: 30, total: 61.5e9 },
	{ range: 'last90', days: 90, total: 172.4e9 }
];

export const DEVICE_FIXTURES = [
	{ mac: 'aa:bb:cc:00:11:01', hostname: '客厅电视', ip: '192.168.2.41', weight: 0.32 },
	{ mac: 'aa:bb:cc:00:11:02', hostname: 'MacBook-Pro', ip: '192.168.2.52', weight: 0.24 },
	{ mac: 'aa:bb:cc:00:11:03', hostname: 'iPhone-15', ip: '192.168.2.66', weight: 0.18 },
	{ mac: 'aa:bb:cc:00:11:04', hostname: 'nas', ip: '192.168.2.10', weight: 0.14 },
	{ mac: 'aa:bb:cc:00:11:05', hostname: '', ip: '192.168.2.88', weight: 0.07 },
	{ mac: 'aa:bb:cc:00:11:06', hostname: '扫地机器人', ip: '192.168.2.91', weight: 0.05 }
];

export const PROTOCOL_FIXTURES = [
	{ name: 'HTTPS', total_bytes: 8.3e8, share: 0.552 },
	{ name: 'QUIC', total_bytes: 3.1e8, share: 0.206 },
	{ name: 'HTTP', total_bytes: 2.2e8, share: 0.146 },
	{ name: 'TCP/853', total_bytes: 9.4e7, share: 0.062 },
	{ name: 'ICMP', total_bytes: 5.1e7, share: 0.034 }
];

export function totalOf(range) {
	return (RANGE_FIXTURES.find((r) => r.range === range) || {}).total || 0;
}

export function daysOf(range) {
	return (RANGE_FIXTURES.find((r) => r.range === range) || {}).days || 1;
}

/** 造一段逐日序列（含今天），波形只是为了截图好看 */
export function buildSeries(range, total) {
	const days = daysOf(range);
	const out = [];

	for (let i = days - 1; i >= 0; i--) {
		const wave = 0.55 + 0.45 * Math.sin(i * 0.9);
		const date = new Date(Date.now() - i * DAY_SECONDS * 1000).toISOString().slice(0, 10);

		out.push({
			date: date,
			rx_bytes: Math.round(total / days * wave * 0.84),
			tx_bytes: Math.round(total / days * wave * 0.16)
		});
	}

	return out;
}
