<script setup>
import RangeCard from './RangeCard.vue';
import BaseEmpty from '../ui/BaseEmpty.vue';
import BasePanel from '../ui/BasePanel.vue';
import { useI18n } from '../../composables/useI18n.js';

// 五个时间窗的汇总卡网格。数据来自 get_summary 的 ranges（已含逐日 series）。

defineProps({
	summary: { type: Array, required: true },
	active: { type: String, required: true },
	loading: { type: Boolean, default: false }
});

const emit = defineEmits([ 'select' ]);

const { t } = useI18n();
</script>

<template>
	<BasePanel v-if="loading">
		<BaseEmpty :text="t('loading')" />
	</BasePanel>

	<BasePanel v-else-if="summary.length === 0">
		<BaseEmpty :text="t('empty')" />
	</BasePanel>

	<div v-else class="fl-cards">
		<RangeCard
			v-for="item in summary"
			:key="item.range"
			:item="item"
			:active="item.range === active"
			@select="emit('select', $event)"
		/>
	</div>
</template>

<style scoped>
.fl-cards {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(158px, 1fr));
	gap: 12px;
}

@media (max-width: 760px) {
	/* 两列排布会剩一张孤零零的卡，让它占满一行 */
	.fl-cards > :last-child:nth-child(odd) {
		grid-column: 1 / -1;
	}
}
</style>
