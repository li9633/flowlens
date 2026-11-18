<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import RangeTabs from './components/RangeTabs.vue';
import SummaryCards from './components/SummaryCards.vue';
import DeviceTable from './components/DeviceTable.vue';

// FlowLens 根组件
//
// 状态全部为 Vue ref/reactive；会话、CSRF、轮询均由外部注入的 api 提供，
// 组件不直接访问 LuCI 内部机制（设计文档 5.2.1 / 5.2.4）。

const props = defineProps({
	api: { type: Object, required: true }
});

const RANGES = [ 'today', 'yesterday', 'last7', 'last30', 'last90' ];

function t(key) {
	return props.api.i18n?.[key] ?? key;
}

const range = ref('today');
const sort = ref('total');
const keyword = ref('');
const summary = ref([]);
const devices = ref([]);
const warnings = ref([]);
const loading = ref(false);
const error = ref('');

const totalBytes = computed(function() {
	return devices.value.reduce(function(sum, d) { return sum + (d.total_bytes || 0); }, 0);
});

const hasData = computed(function() {
	return devices.value.length > 0;
});

async function load() {
	loading.value = true;
	error.value = '';

	try {
		const [ s, d ] = await Promise.all([
			props.api.getSummary(range.value),
			props.api.getDevices(range.value, sort.value, keyword.value)
		]);

		summary.value = Array.isArray(s?.ranges) ? s.ranges : [];
		devices.value = Array.isArray(d?.devices) ? d.devices : [];
		warnings.value = Array.isArray(s?.warnings) ? s.warnings : [];
	}
	catch (e) {
		error.value = e?.message || t('error');
	}
	finally {
		loading.value = false;
	}
}

// 关键词输入做轻量防抖，避免每键一次 RPC
let keywordTimer = null;
watch(keyword, function() {
	clearTimeout(keywordTimer);
	keywordTimer = setTimeout(load, 300);
});

watch([ range, sort ], load);

onMounted(async function() {
	await load();

	// 自动刷新交给 LuCI 的 poll，页面离开时由框架统一停止
	try {
		const settings = await props.api.getSettings();
		const interval = Number(settings?.refresh_interval ?? 0);

		if (interval > 0 && typeof props.api.addPoll === 'function')
			props.api.addPoll(load, interval);
	}
	catch (e) {
		// 设置读取失败不影响主流程，只是不自动刷新
	}
});
</script>

<template>
	<div class="flowlens">
		<div class="flowlens-header">
			<h2>{{ t('title') }}</h2>
			<RangeTabs v-model="range" :ranges="RANGES" :label="t" />
		</div>

		<div v-if="error" class="alert-message warning">{{ error }}</div>

		<!-- 采集链路风险：数据库目录在 tmpfs、conntrack acct 未开、fullcone 冲突等 -->
		<ul v-if="warnings.length" class="flowlens-warnings">
			<li v-for="w in warnings" :key="w">{{ w }}</li>
		</ul>

		<SummaryCards
			:summary="summary"
			:active="range"
			:label="t"
			:loading="loading && summary.length === 0"
		/>

		<DeviceTable
			v-model:sort="sort"
			v-model:keyword="keyword"
			:devices="devices"
			:total-bytes="totalBytes"
			:has-data="hasData"
			:loading="loading"
			:label="t"
		/>
	</div>
</template>
