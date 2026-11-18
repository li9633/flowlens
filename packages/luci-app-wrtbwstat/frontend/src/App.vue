<script setup>
import { computed, onMounted, ref } from 'vue';
import AppHeader from './components/layout/AppHeader.vue';
import SummaryCards from './components/summary/SummaryCards.vue';
import DeviceTable from './components/devices/DeviceTable.vue';
import DeviceDetail from './components/devices/DeviceDetail.vue';
import SettingsPanel from './components/settings/SettingsPanel.vue';
import BaseCallout from './components/ui/BaseCallout.vue';
import { RANGES } from './constants/index.js';
import { useI18n } from './composables/useI18n.js';
import { useTrafficData } from './composables/useTrafficData.js';

// 根组件只做三件事：组织区块顺序、持有「当前选中的设备 / 设置面板是否展开」
// 这类纯 UI 状态、把各区块的事件接到一起。取数在 useTrafficData，展示在各区块。
//
// 边界（设计文档 5.2.1 / 5.2.4）：会话、CSRF、轮询都由外部注入的 api 提供，
// 组件不直接访问 LuCI 内部机制。

const props = defineProps({
	api: { type: Object, required: true }
});

const { t, tm } = useI18n();

const {
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
} = useTrafficData(props.api, t);

/** 分段控件的选项：range 值是后端契约，只有 label 需要翻译 */
const rangeOptions = computed(function() {
	return RANGES.map(function(value) {
		return { value: value, label: t(value) };
	});
});

const selected = ref(null);
const showSettings = ref(false);

function onSelectDevice(device) {
	selected.value = { mac: device.mac, hostname: device.hostname, ip: device.ip };
}

// 改目录 / 清库后设备与数据都变了，收起详情再重拉
function onSettingsChanged() {
	selected.value = null;
	load();
}

onMounted(async function() {
	await load();
	startPolling();
});
</script>

<template>
	<div class="flowlens">
		<AppHeader
			v-model:range="range"
			:title="t('title')"
			:updated-label="updatedLabel"
			:device-count="devices.length"
			:range-options="rangeOptions"
			:settings-open="showSettings"
			@toggle-settings="showSettings = !showSettings"
		/>

		<BaseCallout v-if="error" tone="danger">{{ error }}</BaseCallout>

		<!-- 采集链路风险：数据库目录在 tmpfs、conntrack acct 未开、fullcone 冲突等 -->
		<BaseCallout v-if="warnings.length" tone="warn">
			<ul>
				<li v-for="(w, i) in warnings" :key="i">{{ tm(w) }}</li>
			</ul>
		</BaseCallout>

		<SummaryCards
			:summary="summary"
			:active="range"
			:loading="loading && summary.length === 0"
			@select="selectRange"
		/>

		<SettingsPanel
			v-if="showSettings"
			:api="api"
			@close="showSettings = false"
			@changed="onSettingsChanged"
		/>

		<DeviceTable
			v-model:sort="sort"
			v-model:keyword="keyword"
			:devices="devices"
			:total-bytes="totalBytes"
			:has-data="hasData"
			:loading="loading"
			:selected="selected?.mac ?? ''"
			@select="onSelectDevice"
		/>

		<DeviceDetail
			v-if="selected"
			:api="api"
			:device="selected"
			:range="range"
			@close="selected = null"
		/>
	</div>
</template>
