<script setup>
// 按钮。variant: default（描边）/ primary（主操作）/ danger（危险操作）。
// 属性透传：disabled、aria-*、@click 都由根元素接收，不需要手动转发。
defineProps({
	variant: {
		type: String,
		default: 'default',
		validator: (v) => [ 'default', 'primary', 'danger' ].includes(v)
	}
});
</script>

<template>
	<button type="button" class="fl-btn" :class="'is-' + variant">
		<slot />
	</button>
</template>

<style scoped>
.fl-btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 7px 13px;
	border: 1px solid var(--fl-hair);
	border-radius: var(--fl-radius-sm);
	background: var(--fl-surface);
	color: var(--fl-text);
	font: inherit;
	font-size: var(--fl-fs-base);
	font-weight: 500;
	line-height: 1.3;
	cursor: pointer;
	transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.fl-btn:hover {
	background: var(--fl-surface-2);
}

.fl-btn:focus-visible {
	outline: none;
	border-color: var(--fl-accent);
	box-shadow: 0 0 0 3px var(--fl-accent-weak);
}

.fl-btn.is-primary {
	border-color: transparent;
	background: var(--fl-accent);
	color: #fff;
	font-weight: 550;
}

.fl-btn.is-primary:hover {
	background: var(--fl-accent);
	filter: brightness(1.06);
}

.fl-btn.is-danger {
	border-color: var(--fl-danger-line);
	color: var(--fl-danger);
}

.fl-btn.is-danger:hover {
	background: var(--fl-danger-weak);
}

.fl-btn:disabled {
	opacity: 0.45;
	cursor: not-allowed;
	filter: none;
}
</style>
