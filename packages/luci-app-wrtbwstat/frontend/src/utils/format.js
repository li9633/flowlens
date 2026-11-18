// 体积、占比与时间格式化。避免引入第三方工具库（体积预算 120 KB gzip）。

const UNITS = [ 'B', 'KB', 'MB', 'GB', 'TB' ];

/** 字节数 -> 人类可读字符串，例如 1536 -> "1.50 KB" */
export function formatBytes(bytes) {
	const n = Number(bytes);
	if (!Number.isFinite(n) || n <= 0) return '0 B';

	let value = n;
	let unit = 0;

	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit++;
	}

	const digits = (unit === 0 || value >= 100) ? 0 : (value >= 10 ? 1 : 2);
	return value.toFixed(digits) + ' ' + UNITS[unit];
}

/** 0..1 的占比 -> 百分比字符串，保留一位小数 */
export function formatShare(share) {
	const n = Number(share);
	if (!Number.isFinite(n) || n <= 0) return '0%';
	return (n * 100).toFixed(n >= 0.1 ? 0 : 1) + '%';
}

/** unix 秒 -> 本地 HH:MM；空值返回 '—' */
export function formatTime(ts) {
	const n = Number(ts);
	if (!Number.isFinite(n) || n <= 0) return '—';

	const d = new Date(n * 1000);
	const pad = (v) => String(v).padStart(2, '0');
	return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/** 'YYYY-MM-DD' -> 'MM-DD'（逐日图表的刻度用），异常值原样返回 */
export function formatDayTick(date) {
	return (typeof date === 'string' && date.length >= 10) ? date.slice(5) : String(date ?? '');
}
