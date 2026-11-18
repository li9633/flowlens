<script setup>
import BaseMeter from '../ui/BaseMeter.vue';
import { formatBytes, formatShare } from '../../utils/format.js';

// 协议分布。名字可能很长（"TCP/853"、"proto 6"），所以用 grid 让名字占满
// 剩余宽度并省略，两个数字列始终贴右对齐。
defineProps({
	// [{ name, total_bytes, share }]
	protocols: { type: Array, required: true }
});
</script>

<template>
	<div class="fl-protos">
		<div v-for="p in protocols" :key="p.name" class="fl-proto">
			<span class="fl-proto-name">{{ p.name }}</span>
			<span class="fl-proto-bytes">{{ formatBytes(p.total_bytes) }}</span>
			<span class="fl-proto-share">{{ formatShare(p.share) }}</span>
			<span class="fl-meter-slot"><BaseMeter :value="p.share || 0" /></span>
		</div>
	</div>
</template>

<style scoped>
.fl-protos {
	display: flex;
	flex-direction: column;
	gap: 11px;
}

.fl-proto {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto auto;
	grid-template-areas:
		'name bytes share'
		'meter meter meter';
	gap: 4px 10px;
	align-items: baseline;
}

.fl-proto-name {
	grid-area: name;
	font-size: var(--fl-fs-base);
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.fl-proto-bytes {
	grid-area: bytes;
	font-size: 12px;
	font-variant-numeric: tabular-nums;
}

.fl-proto-share {
	grid-area: share;
	min-width: 40px;
	font-size: var(--fl-fs-sm);
	color: var(--fl-muted);
	text-align: right;
	font-variant-numeric: tabular-nums;
}

.fl-meter-slot {
	grid-area: meter;
}
</style>
