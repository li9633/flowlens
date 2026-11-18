/**
 * 设备头像配色。
 *
 * 色相由 MAC 稳定散列得到：同一台设备每次刷新、每个页面颜色都一样，
 * 用户能靠颜色认设备；饱和度/明度固定，保证深浅色主题下都可读。
 */

const LIGHTNESS_BG = 0.16;
const LIGHTNESS_FG = 46;

export function hueOf(mac) {
	const s = String(mac || '');
	let h = 0;

	for (let i = 0; i < s.length; i++)
		h = (h * 33 + s.charCodeAt(i)) % 360;

	return h;
}

export function avatarStyle(mac) {
	const hue = hueOf(mac);

	return {
		background: 'hsla(' + hue + ', 72%, 52%, ' + LIGHTNESS_BG + ')',
		color: 'hsl(' + hue + ', 62%, ' + LIGHTNESS_FG + '%)'
	};
}

/** 头像里的首字：有名称取名称首字，否则取 MAC 首字符；未知来源用问号 */
export function avatarInitial(device) {
	if (device.unknown_source)
		return '?';

	const seed = String(device.hostname || device.mac || '?').trim() || '?';
	return (Array.from(seed)[0] || '?').toUpperCase();
}
