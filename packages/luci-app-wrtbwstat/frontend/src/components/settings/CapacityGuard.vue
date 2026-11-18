<script setup>
import { computed } from 'vue';
import BaseMeter from '../ui/BaseMeter.vue';
import { useI18n } from '../../composables/useI18n.js';

// 容量保护说明：把「多少数据量算满载」讲清楚，并展示当前使用率。
// 数据来自 get_settings 里的 capacity（由 get_summary 周期写入）。

const props = defineProps({
	capacity: { type: Object, default: null }
});

const { t } = useI18n();

function toNumber(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

const percent = computed(function() {
	return toNumber(props.capacity?.percent);
});

const trigger = computed(function() {
	return toNumber(props.capacity?.trigger) ?? 0.8;
});

const limit = computed(function() {
	return toNumber(props.capacity?.limit_device_days) ?? 18000;
});

const deviceDays = computed(function() {
	return toNumber(props.capacity?.device_days);
});

const percentText = computed(function() {
	return (percent.value == null) ? '—' : (percent.value * 100).toFixed(1) + '%';
});

// 清理记录：后端存的是 unix 秒，这里显示到分钟
const cleanup = computed(function() {
	const c = props.capacity?.last_cleanup;
	if (!c || !c.at) return null;

	const d = new Date(Number(c.at) * 1000);
	const pad = (v) => String(v).padStart(2, '0');
	const time = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
		' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());

	return { time, keepDays: c.keep_days, cleaned: c.cleaned };
});
</script>

<template>
	<div class="fl-capacity">
		<h4 class="fl-capacity-title">{{ t('capacityTitle') }}</h4>

		<p class="fl-capacity-text">{{ t('capacityAction') }}</p>
		<p class="fl-capacity-text fl-capacity-warn">{{ t('capacityEffect') }}</p>

		<template v-if="percent !== null">
			<div class="fl-capacity-meter">
				<BaseMeter :value="percent" :height="6" />
				<span class="fl-capacity-mark" :style="{ left: (trigger * 100) + '%' }"></span>
			</div>

			<p class="fl-capacity-usage">
				{{ t('capacityUsage') }}: <strong>{{ percentText }}</strong>
				<span class="fl-capacity-num">{{ deviceDays }} / {{ limit }} {{ t('capacityDeviceDays') }}</span>
			</p>
		</template>

		<p v-else class="fl-capacity-usage">{{ t('capacityPending') }}</p>

		<p v-if="cleanup" class="fl-capacity-clean">
			{{ t('capacityLastCleanup') }}: {{ cleanup.time }} ·
			{{ t('capacityKeep') }} {{ cleanup.keepDays }} {{ t('capacityDays') }} ·
			{{ cleanup.cleaned }} {{ t('capacityArchives') }}
		</p>
	</div>
</template>

<style scoped>
.fl-capacity {
	margin-top: 20px;
	padding: 14px 15px;
	border-radius: 12px;
	background: var(--fl-surface-2);
}

.fl-capacity-title {
	margin-bottom: 8px;
	font-size: var(--fl-fs-xs);
	font-weight: 700;
	letter-spacing: 0.07em;
	text-transform: uppercase;
	color: var(--fl-muted);
}

.fl-capacity-text {
	margin: 0 0 6px;
	font-size: var(--fl-fs-sm);
	line-height: 1.6;
	color: var(--fl-muted);
}

.fl-capacity-warn {
	color: var(--fl-danger);
}

.fl-capacity-meter {
	position: relative;
	margin: 12px 0 8px;
}

/* 80% 阈值刻度：让「离满载还有多远」一眼可见 */
.fl-capacity-mark {
	position: absolute;
	top: -2px;
	width: 1px;
	height: 10px;
	background: var(--fl-danger);
	opacity: 0.7;
}

.fl-capacity-usage {
	margin: 0;
	font-size: var(--fl-fs-sm);
	color: var(--fl-text);
}

.fl-capacity-num {
	margin-left: 6px;
	color: var(--fl-muted);
}

.fl-capacity-clean {
	margin: 8px 0 0;
	font-size: var(--fl-fs-xs);
	line-height: 1.6;
	color: var(--fl-muted);
}
</style>
