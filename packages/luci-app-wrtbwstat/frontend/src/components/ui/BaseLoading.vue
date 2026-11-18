<script setup>
// 通用加载指示器。
//
// 两种形态：
//   1. 默认内联：居中转圈（可带文案），适合替换"加载中…"占位。
//   2. overlay：铺满最近的定位父元素，半透明蒙层，适合刷新已有数据时保留旧内容。
//
// 用法：
//   <BaseLoading :show="loading" :label="t('loading')" />
//   <BaseLoading :show="loading" overlay :label="t('loading')" />
//
// overlay 模式要求父元素 position: relative；蒙层默认接收指针事件，
// 加载期间挡住误点，但不移动焦点，键盘操作不受影响。

defineProps({
	show: { type: Boolean, default: true },
	overlay: { type: Boolean, default: false },
	label: { type: String, default: '' },
	size: { type: Number, default: 20 }
});
</script>

<template>
	<Transition name="fl-loading-fade">
		<div
			v-if="show"
			class="fl-loading"
			:class="{ 'is-overlay': overlay }"
			role="status"
			aria-live="polite"
			:aria-label="label || undefined"
		>
			<span
				class="fl-spinner"
				:style="{ width: size + 'px', height: size + 'px' }"
				aria-hidden="true"
			/>
			<span v-if="label" class="fl-loading-label">{{ label }}</span>
		</div>
	</Transition>
</template>

<style scoped>
.fl-loading {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 28px 0;
	color: var(--fl-muted);
	font-size: var(--fl-fs-base);
}

.fl-loading.is-overlay {
	position: absolute;
	inset: 0;
	z-index: 2;
	padding: 0;
	border-radius: inherit;
	background: var(--fl-surface);
	background: color-mix(in srgb, var(--fl-surface) 78%, transparent);
	-webkit-backdrop-filter: blur(1.5px);
	backdrop-filter: blur(1.5px);
}

.fl-spinner {
	display: block;
	flex: none;
	box-sizing: border-box;
	border: 2px solid var(--fl-hair);
	border-top-color: var(--fl-accent);
	border-radius: 50%;
	animation: fl-spin 0.75s linear infinite;
}

.fl-loading-label {
	font-weight: 500;
	letter-spacing: 0.02em;
}

@keyframes fl-spin {
	to { transform: rotate(360deg); }
}

.fl-loading-fade-enter-active,
.fl-loading-fade-leave-active {
	transition: opacity 0.16s ease;
}

.fl-loading-fade-enter-from,
.fl-loading-fade-leave-to {
	opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
	.fl-spinner {
		animation-duration: 1.8s;
	}

	.fl-loading-fade-enter-active,
	.fl-loading-fade-leave-active {
		transition: none;
	}
}
</style>
