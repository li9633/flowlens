<script setup>
import { computed } from 'vue';

// 细进度条：占比、量级都用它。value 用 0..1 而不是百分比字符串，
// 宽度换算只在这里做一次，调用方不用再拼样式。
const props = defineProps({
	value: { type: Number, default: 0 },
	// 高度（px）：卡片内 3px，单日横条用 8px
	height: { type: Number, default: 3 }
});

const width = computed(function() {
	const v = Number(props.value);
	if (!Number.isFinite(v) || v <= 0) return '0%';
	return (Math.min(v, 1) * 100).toFixed(1) + '%';
});
</script>

<template>
	<span class="fl-meter" :style="{ height: height + 'px' }">
		<span class="fl-meter-fill" :style="{ width: width }"></span>
	</span>
</template>

<style scoped>
/* 用作 <span> 时必须显式 block，否则 inline 元素吃不到 height */
.fl-meter {
	display: block;
	width: 100%;
	border-radius: 999px;
	background: var(--fl-track);
	overflow: hidden;
}

.fl-meter-fill {
	display: block;
	height: 100%;
	border-radius: 999px;
	background: var(--fl-accent);
	transition: width 0.25s ease;
}
</style>
