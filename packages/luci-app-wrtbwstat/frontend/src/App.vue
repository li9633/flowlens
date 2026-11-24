<script setup>
import { computed, onMounted, ref } from 'vue';
import AppHeader from './components/layout/AppHeader.vue';
import SummaryCards from './components/summary/SummaryCards.vue';
import DeviceTable from './components/devices/DeviceTable.vue';
import DeviceDetail from './components/devices/DeviceDetail.vue';
import SettingsPanel from './components/settings/SettingsPanel.vue';
import BaseCallout from './components/ui/BaseCallout.vue';
import BaseButton from './components/ui/BaseButton.vue';
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

// fullcone 修复只落盘不重启：模块已经在内核里，事件要等重启才恢复。
// 操作会关闭用户的 fullcone NAT，因此必须由用户点按钮触发，不自动执行。
const fixing = ref(false);
const fixError = ref('');

async function onFixFullcone() {
	fixing.value = true;
	fixError.value = '';

	try {
		const res = await props.api.fixFullcone(true);

		if (!res || res.success !== true) {
			const msg = res?.message ?? res?.failed?.[0];
			fixError.value = msg ? tm(msg) : t('fixFullconeFailed');
			return;
		}

		// 落盘后后端会把告警从 warnFullcone 换成 warnFullconeReboot
		await load();
	}
	catch (e) {
		fixError.value = '' + e;
	}
	finally {
		fixing.value = false;
	}
}

// 采集器卡死只能靠重启 nlbwmon 恢复（缓冲只在进程启动时生效），
// 会丢弃尚未落盘的计数，因此同样由用户点按钮触发。
const repairing = ref(false);
const repairError = ref('');

async function onRepairCollector() {
	repairing.value = true;
	repairError.value = '';

	try {
		const res = await props.api.repairCollector(true);

		if (!res || res.success !== true) {
			repairError.value = res?.message ? tm(res.message) : t('repairCollectorFailed');
			return;
		}

		await load();

		// 重启后首次 dump 可能还没完成，告警会保留，提示用户稍等
		if (res.verified === false)
			repairError.value = t('repairCollectorPending');
	}
	catch (e) {
		repairError.value = '' + e;
	}
	finally {
		repairing.value = false;
	}
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
				<li v-for="(w, i) in warnings" :key="i">
					<template v-if="w.code === 'warnFullcone' || w.code === 'warnFullconeReboot'">
						{{ tm(w) }}
						<div class="fl-warn-note">
							{{ t(w.code === 'warnFullcone' ? 'warnFullconeAction' : 'warnFullconeRebootHint') }}
						</div>
						<div v-if="w.dir" class="fl-warn-note">
							{{ t('backupHint').replace('{dir}', w.dir) }}
						</div>
						<div v-if="w.code === 'warnFullcone'" class="fl-warn-actions">
							<BaseButton
								variant="primary"
								:disabled="fixing"
								@click="onFixFullcone"
							>
								{{ fixing ? t('fixingFullcone') : t('fixFullcone') }}
							</BaseButton>
						</div>
						<div v-if="fixError" class="fl-warn-error">{{ fixError }}</div>
					</template>
					<template v-else-if="w.code === 'warnCollectorStalled'">
						{{ tm(w) }}
						<div class="fl-warn-actions">
							<BaseButton
								variant="primary"
								:disabled="repairing"
								@click="onRepairCollector"
							>
								{{ repairing ? t('repairingCollector') : t('repairCollector') }}
							</BaseButton>
						</div>
						<div v-if="repairError" class="fl-warn-error">{{ repairError }}</div>
					</template>
					<template v-else>{{ tm(w) }}</template>
				</li>
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

<style scoped>
/* fullcone 告警的补充说明与操作区：默认告警列表只有一行文字 */
.fl-warn-note {
	margin-top: 2px;
	color: var(--fl-muted);
	font-size: var(--fl-fs-sm);
}

.fl-warn-actions {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-top: 8px;
}

.fl-warn-error {
	margin-top: 6px;
	color: var(--fl-danger);
	font-size: var(--fl-fs-sm);
}
</style>
