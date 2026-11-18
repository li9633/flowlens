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
	capacityTitle: '容量保护',
	capacityAction: '使用率超过 80% 时，自动删除最旧的历史归档，把负载压回阈值以内。',
	capacityEffect: '被清理的日期仍会出现在 90 天窗口中，但流量显示为 0。',
	capacityUsage: '当前使用率',
	capacityDeviceDays: '设备日',
	capacityPending: '容量指标将在下次数据刷新后显示。',
	capacityLastCleanup: '上次清理',
	capacityKeep: '保留最近',
	capacityDays: '天',
	capacityArchives: '个归档已删除',
	unknownDevice: '未知设备',
	warnTmpfs: '数据库目录位于 tmpfs（{dir}），重启后历史数据会丢失。',
	warnNlbwMissing: 'nlbw 命令缺失，nlbwmon 可能未安装。',
	warnNoDirectory: 'nlbwmon 未配置数据库目录。',
	warnAcctOff: 'nf_conntrack_acct 未开启，计数可能缺失或偏低。',
	warnFullcone: '检测到 fullcone NAT 模块，可能导致 conntrack 事件无法送达 nlbwmon。',
	warnFullconeAction: 'fullcone 与 nlbwmon 在本固件上互斥：模块一旦加载，统计会一直是 0。修复会关闭 fullcone NAT（影响 P2P / 游戏联机的 NAT 类型）并禁用该内核模块。操作只改文件、不会自动重启，需要你手动重启路由器才生效。',
	warnFullconeReboot: 'fullcone 已禁用，重启路由器后 conntrack 事件才会恢复。',
	warnFullconeRebootHint: '请手动重启路由器（系统 → 重启）后恢复统计；重启前的计数不会补回。',
	backupHint: '原始文件已备份到 {dir}，可运行其中的 restore.sh 回退（需手动重启）。',
	fixFullcone: '一键修复',
	fixingFullcone: '正在修复…',
	fixFullconeFailed: '修复失败，请检查系统日志。',
	errFixConfirm: '需要确认后才能执行修复。',
	errBackupFailed: '备份失败，未做任何修改。请检查存储空间后重试。',
	errFullconeBuiltin: '该固件的 fullcone 已编译进内核，无法自动禁用，请改用不含 fullcone 的固件。',
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
	// dev 预览里点「一键修复」后，告警要能切到「重启后生效」
	let fullconeFixed = false;

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
				// 故意留两条告警，用来验证提示条的换行、多语言与 fullcone 操作区
				warnings: [
					{ code: 'warnTmpfs', dir: '/var/lib/nlbwmon' },
					fullconeFixed
						? { code: 'warnFullconeReboot', dir: '/etc/wrtbwstat/backup/fullcone-20261118-223000' }
						: { code: 'warnFullcone' }
				]
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
				collector: { directory: '/dockers-data/nlbwmon' },
				capacity: {
					limit_device_days: 18000,
					trigger: 0.8,
					device_days: 270,
					device_count: 3,
					days_with_data: 90,
					percent: 0.015,
					keep_days: null,
					cleaned_archives: 0,
					last_cleanup: null
				}
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

		async fixFullcone(confirm) {
			if (confirm !== true)
				return { success: false, message: { code: 'errFixConfirm' } };

			fullconeFixed = true;

			return {
				success: true,
				changed: [ 'firewall.fullcone', '/lib/modules/6.12.103/nft_fullcone.ko' ],
				reboot_required: true,
				backup_dir: '/etc/wrtbwstat/backup/fullcone-20261118-223000'
			};
		},

		// dev 预览没有 LuCI 的页面生命周期，用 window.setInterval 近似
		addPoll(fn, interval) {
			window.setInterval(fn, interval * 1000);
		},

		i18n: I18N
	};
}
