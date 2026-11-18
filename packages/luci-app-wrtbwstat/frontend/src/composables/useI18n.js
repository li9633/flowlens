/**
 * 文案注入。
 *
 * 文案由 LuCI 薄壳 view 通过 api.i18n 注入（LuCI 的翻译扫描器不解析 .vue，
 * 只能在 view 侧用 _() 取词），所以这里用 provide/inject 而不是全局单例：
 * 组件不关心字典从哪来，dev 预览与真机走同一条路径。
 *
 *   const { t, tm } = useI18n();
 *   t('today')                           -> '今天'
 *   tm({ code: 'warnTmpfs', dir: '/x' }) -> '数据库目录位于 tmpfs（/x）…'
 *
 * 字典挂在 app 级 provide 上（见 main.js）：根组件自己 inject 不到自己的
 * provide，只有父级 provide 才能被子孙注入，所以用 app.provide 最省事。
 */

import { inject } from 'vue';
import { translate } from '../utils/i18n.js';

const LABELS_KEY = Symbol('flowlens:i18n');

/** 在应用实例上挂字典，任何组件（含根组件）都能 inject 到 */
export function installI18n(app, dict) {
	app.provide(LABELS_KEY, dict || {});
}

export function useI18n() {
	const dict = inject(LABELS_KEY, {});

	const t = (key) => (dict[key] ?? key);
	const tm = (message) => translate(t, message);

	return { t, tm };
}
