<script setup>
import { computed } from 'vue';
import { formatBytes } from '../../utils/format.js';

// 单日拆解：一根横条 + 上下行数字。
//
// 时间窗选「今天/昨天」时逐日柱状只有一根柱子，画出来像没画完；这里换成
// 横向堆叠条，把这一天拆成上下行两段，信息密度反而更高。

const props = defineProps({
	// { date, rx_bytes, tx_bytes }
	day: { type: Object, required: true }
});

const total = computed(function() {
	return (props.day.rx_bytes || 0) + (props.day.tx_bytes || 0);
});

function shareOf(bytes) {
	if (!total.value) return '0%';
	return ((bytes || 0) / total.value * 100).toFixed(2) + '%';
}
</script>

<template>
	<div class="fl-day-one">
		<div class="fl-day-one-head">
			<span class="fl-day-one-date">{{ day.date }}</span>
			<span class="fl-day-one-total">{{ formatBytes(total) }}</span>
		</div>

		<div class="fl-track-bar">
			<span class="rx" :style="{ width: shareOf(day.rx_bytes) }"></span>
			<span class="tx" :style="{ width: shareOf(day.tx_bytes) }"></span>
		</div>

		<div class="fl-day-one-split">
			<span class="rx">↓ {{ formatBytes(day.rx_bytes) }}</span>
			<span class="tx">↑ {{ formatBytes(day.tx_bytes) }}</span>
		</div>
	</div>
</template>

<style scoped>
.fl-day-one {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 16px;
	border-radius: 12px;
	background: var(--fl-surface-2);
}

.fl-day-one-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 10px;
}

.fl-day-one-date {
	font-size: var(--fl-fs-sm);
	color: var(--fl-faint);
	font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.fl-day-one-total {
	font-size: var(--fl-fs-lg);
	font-weight: 650;
	letter-spacing: -0.02em;
	font-variant-numeric: tabular-nums;
}

.fl-track-bar {
	display: flex;
	gap: 2px;
	height: 8px;
	border-radius: 999px;
	overflow: hidden;
	background: var(--fl-track);
}

.fl-track-bar .rx {
	background: var(--fl-rx);
}

.fl-track-bar .tx {
	background: var(--fl-tx);
}

.fl-day-one-split {
	display: flex;
	gap: 16px;
	font-size: 12px;
	font-variant-numeric: tabular-nums;
}

.fl-day-one-split .rx {
	color: var(--fl-rx);
}

.fl-day-one-split .tx {
	color: var(--fl-tx);
}
</style>
