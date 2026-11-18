/**
 * 单设备详情：按日序列 + 协议分布。
 *
 * 依赖两个响应式来源：当前选中的设备（换设备要重取）与时间窗（换窗口也要重取）。
 * 详情面板与总览列表共用同一个 range，保证"点开前后统计口径一致"。
 */

import { computed, ref, watch } from 'vue';

export function useDeviceDetail(api, device, range, t) {
	const detail = ref(null);
	const loading = ref(false);
	const error = ref('');

	const days = computed(function() {
		return Array.isArray(detail.value?.days) ? detail.value.days : [];
	});

	const protocols = computed(function() {
		return Array.isArray(detail.value?.protocols) ? detail.value.protocols : [];
	});

	/** 窗口内的日峰值，用于柱状图归一化 */
	const peak = computed(function() {
		return days.value.reduce(function(max, d) {
			return Math.max(max, (d.rx_bytes || 0) + (d.tx_bytes || 0));
		}, 0);
	});

	/** 单日窗口单独呈现：只有一根柱子的柱状图像没画完 */
	const singleDay = computed(function() {
		return days.value.length === 1 ? days.value[0] : null;
	});

	// 与总览列表同理：连续切窗口 / 连续点设备时，只认最后一次请求的响应
	let loadSeq = 0;

	async function load() {
		const mac = device.value?.mac;
		const seq = ++loadSeq;

		if (!mac) {
			detail.value = null;
			loading.value = false;
			return;
		}

		loading.value = true;
		error.value = '';

		try {
			const next = await api.getDevice(mac, range.value);

			if (seq !== loadSeq)
				return;

			detail.value = next;
		}
		catch (e) {
			if (seq !== loadSeq)
				return;

			error.value = e?.message || t('error');
		}
		finally {
			if (seq === loadSeq)
				loading.value = false;
		}
	}

	watch(
		function() { return [ device.value?.mac, range.value ]; },
		load,
		{ immediate: true }
	);

	return { detail, days, protocols, peak, singleDay, loading, error, reload: load };
}
