<script setup>
import { computed, toRef } from 'vue';
import BasePanel from '../ui/BasePanel.vue';
import BaseButton from '../ui/BaseButton.vue';
import BaseCallout from '../ui/BaseCallout.vue';
import BaseEmpty from '../ui/BaseEmpty.vue';
import SectionTitle from '../ui/SectionTitle.vue';
import AppIcon from '../ui/AppIcon.vue';
import DailyBars from './DailyBars.vue';
import SingleDaySplit from './SingleDaySplit.vue';
import ProtocolList from './ProtocolList.vue';
import { useDeviceDetail } from '../../composables/useDeviceDetail.js';
import { useI18n } from '../../composables/useI18n.js';
import { deviceSubtitle, deviceTitle } from '../../utils/device.js';

// 设备详情：按日用量 + 协议分布。
// 拉数据、换窗口重取都交给 useDeviceDetail，组件只负责排版。
// 详情与列表共用同一套显示规则（utils/device.js），避免"点开后标题变了"。

const props = defineProps({
	api: { type: Object, required: true },
	// { mac, hostname, ip }
	device: { type: Object, required: true },
	range: { type: String, required: true }
});

const emit = defineEmits([ 'close' ]);

const { t, tm } = useI18n();

const { days, protocols, singleDay, loading, error } = useDeviceDetail(
	props.api,
	toRef(props, 'device'),
	toRef(props, 'range'),
	t
);

const title = computed(() => deviceTitle(props.device, t));
const subtitle = computed(() => deviceSubtitle(props.device));
</script>

<template>
	<BasePanel align="start">
		<template #title>
			<div class="fl-detail-head">
				<span class="fl-kicker">{{ t('detail') }}</span>
				<span class="fl-detail-name">{{ title }}</span>
				<span v-if="subtitle" class="fl-chip">{{ subtitle }}</span>
			</div>
		</template>

		<template #actions>
			<BaseButton @click="emit('close')">
				<AppIcon name="close" :size="14" />
				<span class="fl-btn-label">{{ t('close') }}</span>
			</BaseButton>
		</template>

		<BaseCallout v-if="error" tone="danger">{{ tm(error) }}</BaseCallout>

		<BaseEmpty v-else-if="loading" :text="t('loading')" />

		<div v-else class="fl-detail-grid">
			<section>
				<SectionTitle>{{ t('daily') }}</SectionTitle>

				<BaseEmpty v-if="days.length === 0" :text="t('empty')" />
				<SingleDaySplit v-else-if="singleDay" :day="singleDay" />
				<DailyBars v-else :days="days" />
			</section>

			<section>
				<SectionTitle>{{ t('protocols') }}</SectionTitle>

				<BaseEmpty v-if="protocols.length === 0" :text="t('empty')" />
				<ProtocolList v-else :protocols="protocols" />
			</section>
		</div>
	</BasePanel>
</template>

<style scoped>
.fl-detail-head {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	flex-direction: column;
	line-height: 1.25;
}

.fl-kicker {
	display: block;
	font-size: var(--fl-fs-xs);
	font-weight: 600;
	letter-spacing: 0.07em;
	text-transform: uppercase;
	color: var(--fl-faint);
}

.fl-detail-name {
	display: block;
	margin-top: 3px;
	font-size: 17px;
	font-weight: 650;
	letter-spacing: -0.015em;
	overflow-wrap: anywhere;
}

.fl-chip {
	display: inline-block;
	margin-top: 5px;
	padding: 2px 8px;
	border-radius: 6px;
	background: var(--fl-track);
	color: var(--fl-muted);
	font-size: var(--fl-fs-sm);
	font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.fl-detail-grid {
	display: grid;
	grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
	gap: 22px;
	align-items: start;
}

@media (max-width: 900px) {
	.fl-detail-grid {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
