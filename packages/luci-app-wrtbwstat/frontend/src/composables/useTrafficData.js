/**
 * 总览数据：时间窗、排序、搜索词，以及汇总与设备列表的拉取。
 *
 * 把原来的 App.vue 里那坨状态 + watch + 防抖 + 轮询搬出来，组件回到"只渲染"。
 *
 * 边界（设计文档 5.2，别破）：不碰 LuCI 会话、不自行 fetch、不用 setInterval。
 * 所有 I/O 走注入的 api，轮询由 LuCI 的 poll.add 驱动。
 */

import { computed, onUnmounted, ref, watch } from 'vue';
import { KEYWORD_DEBOUNCE_MS } from '../constants/index.js';
import { formatTime } from '../utils/format.js';

export function useTrafficData(api, t) {
	const range = ref('today');
	const sort = ref('total');
	const keyword = ref('');

	const summary = ref([]);
	const devices = ref([]);
	const warnings = ref([]);
	const updated = ref(0);

	const loading = ref(false);
	const error = ref('');

	const totalBytes = computed(function() {
		return devices.value.reduce(function(sum, d) { return sum + (d.total_bytes || 0); }, 0);
	});

	const hasData = computed(function() {
		return devices.value.length > 0;
	});

	// 数据时间戳；为 0 时不渲染，避免界面上出现一个孤零零的「—」
	const updatedLabel = computed(function() {
		return updated.value ? formatTime(updated.value) : '';
	});

	// 并发保护：连续点击时间窗 / 排序时只认最后一次请求，
	// 避免先发后到的响应把新结果覆盖掉（典型场景：快速点「昨天」再点「近7天」）。
	let loadSeq = 0;

	/**
	 * 拉取数据。
	 *
	 * silent: 轮询刷新用——不点亮 loading，避免每 30 秒闪一次蒙层；
	 * 用户主动操作（切时间窗 / 排序 / 搜索 / 改设置）才展示加载态。
	 *
	 * scope: 'devices' 只拉设备列表。时间窗、排序、搜索只影响列表；
	 * 汇总数据是五个窗口的固定结果，与当前选中窗口无关，没必要跟着重拉
	 * —— 省掉一半请求，切换窗口的耗时也接近减半。
	 */
	async function load(options) {
		const silent = options?.silent === true;
		const scope = options?.scope === 'devices' ? 'devices' : 'all';
		const seq = ++loadSeq;

		// 参数在发起时快照，避免响应回来时按"当前"选择误判归属
		const params = {
			range: range.value,
			sort: sort.value,
			keyword: keyword.value
		};

		if (!silent)
			loading.value = true;

		error.value = '';

		try {
			if (scope == 'devices') {
				const d = await api.getDevices(params.range, params.sort, params.keyword);

				if (seq !== loadSeq)
					return;

				devices.value = Array.isArray(d?.devices) ? d.devices : [];
			}
			else {
				const [ s, d ] = await Promise.all([
					api.getSummary(params.range),
					api.getDevices(params.range, params.sort, params.keyword)
				]);

				if (seq !== loadSeq)
					return;

				summary.value = Array.isArray(s?.ranges) ? s.ranges : [];
				devices.value = Array.isArray(d?.devices) ? d.devices : [];
				warnings.value = Array.isArray(s?.warnings) ? s.warnings : [];
				updated.value = Number(s?.updated ?? 0);
			}
		}
		catch (e) {
			if (seq !== loadSeq)
				return;

			error.value = e?.message || t('error');
		}
		finally {
			if (!silent && seq === loadSeq)
				loading.value = false;
		}
	}

	// 关键词做防抖；组件卸载时清掉定时器，避免离开页面后还发一次请求
	let keywordTimer = null;
	watch(keyword, function() {
		clearTimeout(keywordTimer);
		keywordTimer = setTimeout(function() {
			load({ scope: 'devices' });
		}, KEYWORD_DEBOUNCE_MS);
	});

	onUnmounted(function() {
		clearTimeout(keywordTimer);
	});

	watch([ range, sort ], function() { load({ scope: 'devices' }); });

	/**
	 * 按设置里的 refresh_interval 挂上 LuCI 轮询。页面离开时由框架统一停止。
	 * 设置读取失败不影响主流程，只是不自动刷新。
	 */
	async function startPolling() {
		try {
			const settings = await api.getSettings();
			const interval = Number(settings?.refresh_interval ?? 0);

			if (interval > 0 && typeof api.addPoll === 'function')
				api.addPoll(function() { return load({ silent: true }); }, interval);
		}
		catch (e) {
			/* 静默：不自动刷新即可 */
		}
	}

	function selectRange(value) {
		range.value = value;
	}

	return {
		range,
		sort,
		keyword,
		summary,
		devices,
		warnings,
		loading,
		error,
		totalBytes,
		hasData,
		updatedLabel,
		load,
		startPolling,
		selectRange
	};
}
