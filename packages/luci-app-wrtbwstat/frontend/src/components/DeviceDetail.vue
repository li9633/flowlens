<script setup>
import { computed, ref, watch } from 'vue';
import { formatBytes, formatShare } from '../utils/format.js';

// 单设备详情：按日用量柱状 + 协议分布。
// 数据来自 api.getDevice(mac, range)，与主列表共用同一个时间窗。

const props = defineProps({
	api: { type: Object, required: true },
	mac: { type: String, required: true },
	hostname: { type: String, default: '' },
	range: { type: String, required: true },
	label: { type: Function, required: true }
});

const emit = defineEmits([ 'close' ]);

const detail = ref(null);
const loading = ref(false);
const error = ref('');

const days = computed(function() {
	return Array.isArray(detail.value?.days) ? detail.value.days : [];
});

const protocols = computed(function() {
	return Array.isArray(detail.value?.protocols) ? detail.value.protocols : [];
});

const peak = computed(function() {
	return days.value.reduce(function(max, d) {
		return Math.max(max, (d.rx_bytes || 0) + (d.tx_bytes || 0));
	}, 0);
});

function barHeight(bytes) {
	if (!peak.value) return '0%';
	return ((bytes || 0) / peak.value * 100).toFixed(1) + '%';
}

// 天数多时只标部分日期，避免刻度挤成一团
const labelEvery = computed(function() {
	return Math.max(1, Math.ceil(days.value.length / 10));
});

function shortDate(s) {
	return (typeof s === 'string' && s.length >= 10) ? s.slice(5) : s;
}

async function fetchDetail() {
	if (!props.mac) return;

	loading.value = true;
	error.value = '';

	try {
		detail.value = await props.api.getDevice(props.mac, props.range);
	}
	catch (e) {
		error.value = e?.message || props.label('error');
	}
	finally {
		loading.value = false;
	}
}

watch(function() { return [ props.mac, props.range ]; }, fetchDetail, { immediate: true });
</script>

<template>
	<div class="cbi-section flowlens-detail">
		<div class="flowlens-detail-head">
			<div>
				<span class="flowlens-detail-name">{{ hostname || mac }}</span>
				<span class="flowlens-device-mac">{{ mac }}</span>
			</div>
			<button type="button" class="btn cbi-button cbi-button-neutral" @click="emit('close')">
				{{ label('close') }}
			</button>
		</div>

		<h3 class="flowlens-detail-title">{{ label('detail') }}</h3>

		<div v-if="error" class="alert-message warning">{{ error }}</div>
		<div v-else-if="loading" class="flowlens-empty">{{ label('loading') }}</div>

		<template v-else>
			<h3 class="flowlens-detail-title">{{ label('daily') }}</h3>

			<div v-if="days.length === 0" class="flowlens-empty">{{ label('empty') }}</div>

			<div v-else class="flowlens-days">
				<div
					v-for="(d, i) in days"
					:key="d.date"
					class="flowlens-day"
					:title="d.date + '  ↓' + formatBytes(d.rx_bytes) + '  ↑' + formatBytes(d.tx_bytes)"
				>
					<div class="flowlens-day-col">
						<div class="flowlens-day-tx" :style="{ height: barHeight(d.tx_bytes) }"></div>
						<div class="flowlens-day-rx" :style="{ height: barHeight(d.rx_bytes) }"></div>
					</div>
					<div v-if="i % labelEvery === 0 || i === days.length - 1" class="flowlens-day-label">
						{{ shortDate(d.date) }}
					</div>
				</div>
			</div>

			<h3 class="flowlens-detail-title">{{ label('protocols') }}</h3>

			<div v-if="protocols.length === 0" class="flowlens-empty">{{ label('empty') }}</div>

			<div v-else class="flowlens-protos">
				<div v-for="p in protocols" :key="p.name" class="flowlens-proto">
					<span class="flowlens-proto-name">{{ p.name }}</span>
					<span class="flowlens-proto-bytes">{{ formatBytes(p.total_bytes) }}</span>
					<span class="flowlens-proto-share">{{ formatShare(p.share) }}</span>
					<div class="flowlens-bar slim">
						<div class="flowlens-bar-fill" :style="{ width: (p.share * 100).toFixed(1) + '%' }"></div>
					</div>
				</div>
			</div>
		</template>
	</div>
</template>
