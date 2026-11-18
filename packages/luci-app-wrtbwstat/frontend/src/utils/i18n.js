// 把后端返回的「消息」渲染成当前语言的文本。
//
// 后端（ucode）不在文案里写任何自然语言，只返回 code + 参数，例如：
//   { code: 'warnTmpfs', dir: '/var/lib/nlbwmon' }
// 这里用 view 注入的 label() 取到已翻译的模板，再替换 {dir} 之类的占位符。
// 兼容两种历史形态：纯字符串（老后端）与对象（新后端）。

export function translate(label, msg) {
	if (msg == null)
		return '';

	if (typeof msg === 'string')
		return label(msg);

	if (typeof msg === 'object' && msg.code) {
		const tpl = label(msg.code);

		return String(tpl).replace(/\{(\w+)\}/g, function(all, key) {
			return (msg[key] != null) ? String(msg[key]) : all;
		});
	}

	return String(msg);
}
