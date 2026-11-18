<script setup>
import { computed } from 'vue';

// 迷你趋势线：把一个窗口内的逐日总量画成折线 + 面积。
//
// viewBox 固定 0..100 × 0..32、preserveAspectRatio="none"，由 CSS 拉伸填满
// 卡片宽度，所以不需要任何 DOM 测量，也不需要图表库（设计文档 5.2.5）。
// 各卡独立归一化——只表达形状，不跨卡比较绝对量。

const VB_W = 100;
const VB_H = 32;
const PAD = 3;

const props = defineProps({
	// [{ date, rx_bytes, tx_bytes }]
	series: { type: Array, default: () => [] }
});

const points = computed(function() {
	const values = props.series.map(function(d) {
		return (d.rx_bytes || 0) + (d.tx_bytes || 0);
	});

	if (values.length < 2)
		return [];

	const max = values.reduce(function(m, v) { return Math.max(m, v); }, 0) || 1;
	const step = VB_W / (values.length - 1);

	return values.map(function(v, i) {
		const y = VB_H - PAD - (v / max) * (VB_H - PAD * 2);
		return (i * step).toFixed(2) + ',' + y.toFixed(2);
	});
});

const linePoints = computed(function() {
	return points.value.join(' ');
});

const areaPath = computed(function() {
	if (!points.value.length)
		return '';

	const body = points.value.map(function(p) { return 'L' + p; }).join(' ');
	return 'M0,' + VB_H + ' ' + body + ' L' + VB_W + ',' + VB_H + ' Z';
});
</script>

<template>
	<svg
		v-if="points.length"
		class="fl-spark"
		:viewBox="'0 0 ' + VB_W + ' ' + VB_H"
		preserveAspectRatio="none"
		aria-hidden="true"
	>
		<path class="fl-spark-area" :d="areaPath" />
		<polyline class="fl-spark-line" :points="linePoints" />
	</svg>
</template>

<style scoped>
.fl-spark {
	display: block;
	width: 100%;
	height: 26px;
	margin-top: 4px;
	overflow: visible;
}

.fl-spark-line {
	fill: none;
	stroke: var(--fl-accent);
	stroke-width: 1.6;
	stroke-linecap: round;
	stroke-linejoin: round;
	vector-effect: non-scaling-stroke;
}

.fl-spark-area {
	fill: var(--fl-accent-weak);
	stroke: none;
}
</style>
