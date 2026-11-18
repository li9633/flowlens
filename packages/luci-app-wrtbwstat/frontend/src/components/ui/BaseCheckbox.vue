<script setup>
// 复选框。危险操作（确认清库）用它而不是开关——开关表达"功能开/关"，
// 复选框表达"我确认"，语义不同。
const model = defineModel({ type: Boolean, default: false });

defineProps({
	tone: {
		type: String,
		default: 'danger',
		validator: (v) => [ 'danger', 'accent' ].includes(v)
	}
});
</script>

<template>
	<label class="fl-check" :class="'is-' + tone">
		<input v-model="model" type="checkbox">
		<span class="fl-check-label"><slot /></span>
	</label>
</template>

<style scoped>
.fl-check {
	display: inline-flex;
	align-items: flex-start;
	gap: 8px;
	font-size: var(--fl-fs-base);
	line-height: 1.45;
	cursor: pointer;
	user-select: none;
}

.fl-check input {
	position: relative;
	width: 16px;
	height: 16px;
	flex: none;
	margin: 1px 0 0;
	border: 1px solid var(--fl-hair);
	border-radius: 5px;
	background: var(--fl-surface);
	appearance: none;
	-webkit-appearance: none;
	cursor: pointer;
	transition: background-color 0.15s ease, border-color 0.15s ease;
}

/* 勾号用两条边框拼出来，不额外引图标 */
.fl-check input:checked {
	border-color: transparent;
	background: var(--fl-danger);
}

.is-accent input:checked {
	background: var(--fl-accent);
}

.fl-check input:checked::after {
	content: '';
	position: absolute;
	top: 1px;
	left: 4px;
	width: 5px;
	height: 9px;
	border: solid #fff;
	border-width: 0 2px 2px 0;
	transform: rotate(42deg);
}

.fl-check input:focus-visible {
	outline: none;
	box-shadow: 0 0 0 3px var(--fl-danger-weak);
}
</style>
