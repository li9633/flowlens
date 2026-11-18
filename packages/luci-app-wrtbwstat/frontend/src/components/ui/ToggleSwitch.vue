<script setup>
// 开关（布尔值）。外观由 appearance:none 自绘，不受 LuCI 主题的 checkbox 样式影响。
// 标签走默认插槽，点标签也能切换。
const model = defineModel({ type: Boolean, default: false });
</script>

<template>
	<label class="fl-switch">
		<input v-model="model" type="checkbox">
		<span class="fl-switch-label"><slot /></span>
	</label>
</template>

<style scoped>
.fl-switch {
	display: inline-flex;
	align-items: center;
	gap: 9px;
	font-size: var(--fl-fs-base);
	cursor: pointer;
	user-select: none;
}

.fl-switch input {
	position: relative;
	width: 34px;
	height: 20px;
	flex: none;
	margin: 0;
	border: 0;
	border-radius: 999px;
	background: var(--fl-track);
	appearance: none;
	-webkit-appearance: none;
	cursor: pointer;
	transition: background-color 0.18s ease;
}

.fl-switch input::after {
	content: '';
	position: absolute;
	top: 2px;
	left: 2px;
	width: 16px;
	height: 16px;
	border-radius: 50%;
	background: #fff;
	box-shadow: 0 1px 2px rgba(16, 24, 40, 0.28);
	transition: transform 0.2s var(--fl-ease);
}

.fl-switch input:checked {
	background: var(--fl-accent);
}

.fl-switch input:checked::after {
	transform: translateX(14px);
}

.fl-switch input:focus-visible {
	box-shadow: 0 0 0 3px var(--fl-accent-weak);
}
</style>
