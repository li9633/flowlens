<script setup>
import { computed } from 'vue';
import { formatBytes } from '../utils/format.js';

// 五个时间窗的汇总卡片。
// 当前时间窗高亮；每张卡展示上下行与合计，趋势条用 CSS 宽度实现，
// 不引入图表库（设计文档 5.2.5）。

const props = defineProps({
	summary: { type: Array, required: true },
	active: { type: String, required: true },
	label: { type: Function, required: true },
	loading: { type: Boolean, default: false }
});

const peak = computed(function() {
	return props.summary.reduce(function(max, s) {
		return Math.max(max, s.total_bytes || 0);
	}, 0);
});

function barWidth(item) {
	if (!peak.value) return '0%';
	return Math.round(((item.total_bytes || 0) / peak.value) * 100) + '%';
}
</script>

<template>
	<div class="cbi-section flowlens-summary">
		<div v-if="loading" class="flowlens-empty">{{ label('loading') }}</div>

		<div v-else-if="summary.length === 0" class="flowlens-empty">{{ label('empty') }}</div>

		<div v-else class="flowlens-cards">
			<div
				v-for="item in summary"
				:key="item.range"
				class="flowlens-card"
				:class="{ 'is-active': item.range === active }"
			>
				<div class="flowlens-card-title">{{ label(item.range) }}</div>

				<div class="flowlens-card-total">{{ formatBytes(item.total_bytes) }}</div>

				<div class="flowlens-card-split">
					<span class="rx">↓ {{ formatBytes(item.rx_bytes) }}</span>
					<span class="tx">↑ {{ formatBytes(item.tx_bytes) }}</span>
				</div>

				<div class="flowlens-bar">
					<div class="flowlens-bar-fill" :style="{ width: barWidth(item) }"></div>
				</div>
			</div>
		</div>
	</div>
</template>
