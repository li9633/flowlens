<script setup>
// 小节标题（微型大写字重标签），详情页的「按日用量 / 协议分布」用。
</script>

<template>
	<h4 class="fl-section-title">
		<span><slot /></span>
		<slot name="aside" />
	</h4>
</template>

<style scoped>
.fl-section-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin: 0 0 10px;
	font-size: var(--fl-fs-sm);
	font-weight: 600;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--fl-faint);
}
</style>
