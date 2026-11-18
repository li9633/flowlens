<script setup>
// 表单字段：标签在上、控件在下。用 label 包住控件，点击标签即聚焦到输入框。
defineProps({
	label: { type: String, default: '' }
});
</script>

<template>
	<label class="fl-field">
		<span v-if="label" class="fl-field-label">{{ label }}</span>
		<slot />
	</label>
</template>

<style scoped>
.fl-field {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.fl-field-label {
	font-size: var(--fl-fs-sm);
	font-weight: 550;
	color: var(--fl-muted);
}
</style>
