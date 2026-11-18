<script setup>
import SparkLine from './SparkLine.vue';
import { useI18n } from '../../composables/useI18n.js';
import { formatBytes } from '../../utils/format.js';

// 单个时间窗卡片：窗口名 + 总量 + 上下行拆分 + 窗口内逐日趋势。
// 卡片本身是按钮——既是展示也是切换入口，与顶部分段控件同源（range）。

const props = defineProps({
	// { range, total_bytes, rx_bytes, tx_bytes, series }
	item: { type: Object, required: true },
	active: { type: Boolean, default: false }
});

const emit = defineEmits([ 'select' ]);

const { t } = useI18n();
</script>

<template>
	<button
		type="button"
		class="fl-card"
		:class="{ 'is-active': active }"
		:aria-current="active ? 'true' : 'false'"
		@click="emit('select', item.range)"
	>
		<span class="fl-card-label">
			<span v-if="active" class="fl-card-dot" aria-hidden="true"></span>
			{{ t(item.range) }}
		</span>

		<span class="fl-card-total">{{ formatBytes(item.total_bytes) }}</span>

		<span class="fl-card-split">
			<span class="rx">↓ {{ formatBytes(item.rx_bytes) }}</span>
			<span class="tx">↑ {{ formatBytes(item.tx_bytes) }}</span>
		</span>

		<!-- 单日窗口没有「窗口内趋势」可画，留白即可，同排卡片高度由网格拉平 -->
		<SparkLine :series="item.series || []" />
	</button>
</template>

<style scoped>
.fl-card {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 6px;
	padding: 14px 15px 12px;
	border: 1px solid var(--fl-hair);
	border-radius: var(--fl-radius);
	background: var(--fl-surface);
	color: inherit;
	font: inherit;
	text-align: left;
	cursor: pointer;
	overflow: hidden;
	transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
}

.fl-card:hover {
	border-color: var(--fl-accent-line);
}

.fl-card:active {
	transform: scale(0.995);
}

.fl-card.is-active {
	border-color: var(--fl-accent-line);
	background: var(--fl-accent-weak);
}

.fl-card-label {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: var(--fl-fs-sm);
	font-weight: 500;
	color: var(--fl-muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.fl-card.is-active .fl-card-label {
	color: var(--fl-accent);
}

.fl-card-dot {
	width: 5px;
	height: 5px;
	flex: none;
	border-radius: 50%;
	background: var(--fl-accent);
}

.fl-card-total {
	font-size: var(--fl-fs-xl);
	font-weight: 650;
	letter-spacing: -0.02em;
	line-height: 1.15;
	font-variant-numeric: tabular-nums;
}

.fl-card-split {
	display: flex;
	gap: 10px;
	font-size: var(--fl-fs-sm);
	color: var(--fl-muted);
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

.fl-card-split .rx {
	color: var(--fl-rx);
}

.fl-card-split .tx {
	color: var(--fl-tx);
}

@media (max-width: 760px) {
	.fl-card {
		padding: 12px 13px 10px;
	}

	.fl-card-total {
		font-size: 20px;
	}
}
</style>
