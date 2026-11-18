/**
 * 设备显示规则。
 *
 * 列表与详情必须用同一套规则，否则"点开某台设备后标题变了"。
 * 规则约定：后端不把 MAC 当主机名回退，取不到就回空串，
 * 并另给 ip 字段，由前端决定如何排版。
 *
 *   有主机名 → 标题=名称，副标题=MAC
 *   无主机名 → 标题=MAC，副标题=IP（拿不到 IP 就只显示 MAC）
 *   unknown_source（MAC 全 0）→ 标题=「未知设备」，副标题=MAC
 */

export function deviceTitle(device, t) {
	if (device.unknown_source)
		return t('unknownDevice');

	return device.hostname || device.mac;
}

export function deviceSubtitle(device) {
	if (device.unknown_source)
		return device.mac;

	return device.hostname ? device.mac : (device.ip || '');
}
