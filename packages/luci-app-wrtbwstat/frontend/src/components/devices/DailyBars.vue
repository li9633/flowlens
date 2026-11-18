<script setup>
import { computed } from 'vue';
import { useI18n } from '../../composables/useI18n.js';
import { formatBytes, formatDayTick } from '../../utils/format.js';

// 多日逐日柱状：每根柱子上行在下、下行在上的堆叠两段。
//
// 高度用百分比而不是像素：柱子的容器高度固定 112px，每段高度 = 该日流量 /
// 窗口内峰值，所以最高那天正好占满，其余按比例；不引图表库。
//
// 日期刻度只标一部分（天数多时每根都标会挤成一团），标签绝对定位允许溢出列宽
// ——列只有 6–46px，装不下 "11-18"，按列宽裁切会变成 "11-1"。

const props = defineProps({
	// [{ date, rx_bytes, tx_bytes }]
	days: { type: Array, required: true }
});

const { t } = useI18n();

const peak = computed(function() {
	return props.days.reduce(function(max, d) {
		return Math.max(max, (d.rx_bytes || 0) + (d.tx_bytes || 0));
	}, 0);
});

/** 每几个柱子标一个日期，保证刻度不重叠 */
const tickEvery = computed(function() {
	return Math.max(1, Math.ceil(props.days.length / 10));
});

function heightOf(bytes) {
	if (!peak.value) return '0%';
	return ((bytes || 0) / peak.value * 100).toFixed(2) + '%';
}

function tooltip(day) {
	return day.date + '  ↓' + formatBytes(day.rx_bytes) + '  ↑' + formatBytes(day.tx_bytes);
}

function hasTick(index) {
	return index % tickEvery.value === 0 || index === props.days.length - 1;
}
</script>

<template>
	<div class="fl-bars">
		<div v-for="(day, i) in days" :key="day.date" class="fl-bar-col" :title="tooltip(day)">
			<div class="fl-bar-track">
				<div class="fl-bar-stack">
					<span class="fl-bar-seg tx" :style="{ height: heightOf(day.tx_bytes) }"></span>
					<span class="fl-bar-seg rx" :style="{ height: heightOf(day.rx_bytes) }"></span>
				</div>
			</div>

			<!-- 标签槽位始终占位，保证每根柱子基线一致 -->
			<div class="fl-bar-label">
				<template v-if="hasTick(i)">{{ formatDayTick(day.date) }}</template>
			</div>
		</div>
	</div>

	<div class="fl-legend">
		<span><i class="rx"></i>{{ t('download') }}</span>
		<span><i class="tx"></i>{{ t('upload') }}</span>
	</div>
</template>

<style scoped>
.fl-bars {
	display: flex;
	align-items: flex-end;
	gap: 2px;
	padding-bottom: 6px;
	border-bottom: 1px solid var(--fl-hair);
	overflow-x: auto;
	scrollbar-width: thin;
}

.fl-bar-col {
	position: relative;
	display: flex;
	flex: 1 0 6px;
	flex-direction: column;
	justify-content: flex-end;
	min-width: 6px;
	max-width: 46px;
	padding-bottom: 17px;
	border-radius: 5px 5px 0 0;
	transition: background-color 0.13s ease;
}

.fl-bar-col:hover {
	background: var(--fl-surface-2);
}

.fl-bar-track {
	display: flex;
	align-items: flex-end;
	height: 112px;
	width: 100%;
}

.fl-bar-stack {
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	width: 100%;
	height: 100%;
	gap: 1px;
	overflow: hidden;
}

.fl-bar-seg {
	width: 100%;
	min-height: 2px;
	border-radius: 3px;
}

.fl-bar-seg.rx {
	background: var(--fl-rx);
}

.fl-bar-seg.tx {
	background: var(--fl-tx);
}

.fl-bar-label {
	position: absolute;
	left: 50%;
	bottom: 0;
	transform: translateX(-50%);
	font-size: 10px;
	line-height: 1.2;
	color: var(--fl-faint);
	text-align: center;
	white-space: nowrap;
}

/* 首列贴左、末列贴右，避免被横向滚动容器切掉半截 */
.fl-bar-col:first-child .fl-bar-label {
	left: 0;
	transform: none;
}

.fl-bar-col:last-child .fl-bar-label {
	left: auto;
	right: 0;
	transform: none;
}

.fl-legend {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-top: 8px;
	font-size: var(--fl-fs-sm);
	color: var(--fl-muted);
}

.fl-legend span {
	display: inline-flex;
	align-items: center;
	gap: 5px;
}

.fl-legend i {
	width: 7px;
	height: 7px;
	border-radius: 2px;
}

.fl-legend i.rx {
	background: var(--fl-rx);
}

.fl-legend i.tx {
	background: var(--fl-tx);
}

@media (max-width: 480px) {
	.fl-bar-col {
		max-width: 28px;
	}
}
</style>
