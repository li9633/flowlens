/**
 * 与后端契约绑定的常量。
 *
 * 数值必须与 ucode 侧的 normalize_range / normalize_sort / set_settings
 * 校验保持一致，改这里要同步改后端与 tests/backend/driver.uc。
 */

/** 时间窗，顺序即分段控件的展示顺序（后端 get_summary / get_devices 的 range） */
export const RANGES = [ 'today', 'yesterday', 'last7', 'last30', 'last90' ];

/** 设备排序字段（后端 normalize_sort 的白名单） */
export const SORT_KEYS = [ 'total', 'rx', 'tx', 'hostname', 'mac' ];

/** 数值列后端一律降序、名称与 MAC 升序，决定表头排序箭头的方向 */
export const ASCENDING_SORTS = [ 'hostname', 'mac' ];

/** 自动刷新可选秒数，0 = 关闭（后端 errRefresh 只认这四个值） */
export const REFRESH_OPTIONS = [ 0, 10, 30, 60 ];

/** 保留天数允许区间（后端 errRetention 校验） */
export const RETENTION_MIN = 90;
export const RETENTION_MAX = 3650;

/** 关键词输入防抖，避免每键一次 RPC */
export const KEYWORD_DEBOUNCE_MS = 300;

/** 设置表单默认值：拿不到后端数据时的兜底，也让表单永不为空 */
export const DEFAULT_SETTINGS = {
	storage_dir: '',
	retention_days: 95,
	commit_interval: '6h',
	compress: true,
	refresh_interval: 30
};
