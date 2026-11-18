<script setup>
import { computed } from 'vue';
import DeviceAvatar from './DeviceAvatar.vue';
import BaseMeter from '../ui/BaseMeter.vue';
import { useI18n } from '../../composables/useI18n.js';
import { deviceSubtitle, deviceTitle } from '../../utils/device.js';
import { formatBytes, formatShare } from '../../utils/format.js';

// 设备表的一行。只负责渲染，点击交给父级；排序与搜索状态都在父级。
// 单元格的边框/对齐在 DeviceTable 里用 :deep() 统一控制，这里只管行内排版。

const props = defineProps({
	row: { type: Object, required: true },
	selected: { type: Boolean, default: false },
	// 兜底用：后端未返回 share 时按当前列表合计换算
	totalBytes: { type: Number, default: 0 }
});

const emit = defineEmits([ 'select' ]);

const { t } = useI18n();

const title = computed(() => deviceTitle(props.row, t));
const subtitle = computed(() => deviceSubtitle(props.row));

/*
 * 优先用后端的 share：它以整个时间窗的全网总量为分母，搜索过滤时占比不会
 * 因为分母变小而虚高（前端自己按列表合计换算就会）。只有后端没给才兜底。
 */
const share = computed(function() {
	const s = Number(props.row.share);
	if (Number.isFinite(s) && s > 0)
		return s;

	return props.totalBytes > 0 ? (props.row.total_bytes || 0) / props.totalBytes : 0;
});
</script>

<template>
	<tr class="fl-row" :class="{ 'is-selected': selected }" @click="emit('select', row)">
		<td>
			<span class="fl-dev">
				<DeviceAvatar :device="row" />

				<span class="fl-dev-text">
					<span class="fl-dev-name">{{ title }}</span>
					<span v-if="subtitle" class="fl-dev-sub">{{ subtitle }}</span>
				</span>
			</span>
		</td>

		<td class="is-right fl-col-mid">{{ formatBytes(row.rx_bytes) }}</td>
		<td class="is-right fl-col-mid">{{ formatBytes(row.tx_bytes) }}</td>
		<td class="is-right">{{ formatBytes(row.total_bytes) }}</td>

		<td class="is-right fl-col-share">
			<span class="fl-share">
				<span class="fl-share-val">{{ formatShare(share) }}</span>
				<BaseMeter :value="share" />
			</span>
		</td>
	</tr>
</template>

<style scoped>
.fl-dev {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
}

.fl-dev-text {
	display: flex;
	flex-direction: column;
	min-width: 0;
	line-height: 1.3;
}

.fl-dev-name {
	font-weight: 550;
	max-width: 24ch;
	overflow: hidden;
	text-overflow: ellipsis;
}

.fl-dev-sub {
	font-size: var(--fl-fs-sm);
	color: var(--fl-faint);
	font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	letter-spacing: -0.01em;
}

.fl-share {
	display: inline-flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 5px;
	min-width: 62px;
	width: 100%;
}

.fl-share-val {
	font-size: 12px;
}
</style>
