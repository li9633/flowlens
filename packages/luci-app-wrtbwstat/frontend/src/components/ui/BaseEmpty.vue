<script setup>
// 空 / 加载占位。三处用到（汇总卡、设备表、详情），统一一份居中灰字。
defineProps({
	text: { type: String, default: '' }
});
</script>

<template>
	<div class="fl-empty">{{ text }}<slot /></div>
</template>

<style scoped>
.fl-empty {
	display: block;
	padding: 36px 0;
	text-align: center;
	color: var(--fl-faint);
	font-size: var(--fl-fs-base);
}
</style>
