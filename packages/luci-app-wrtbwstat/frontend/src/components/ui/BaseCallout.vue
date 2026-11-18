<script setup>
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

// 提示条：采集链路风险（warn）、请求失败（danger）、保存成功（success）。
// 左侧图标按 tone 自动选，正文走默认插槽，多行内容用 <ul> 传进来即可。
const ICONS = { warn: 'warning', danger: 'warning', success: 'check' };

const props = defineProps({
	tone: {
		type: String,
		default: 'warn',
		validator: (v) => [ 'warn', 'danger', 'success' ].includes(v)
	}
});

const icon = computed(() => ICONS[props.tone] || 'warning');
</script>

<template>
	<div class="fl-callout" :class="'is-' + tone">
		<AppIcon :name="icon" :size="16" class="fl-callout-icon" />
		<div class="fl-callout-body">
			<slot />
		</div>
	</div>
</template>

<style scoped>
.fl-callout {
	display: flex;
	gap: 10px;
	margin-bottom: 14px;
	padding: 12px 14px;
	border-radius: 12px;
	background: var(--fl-tx-weak);
	font-size: var(--fl-fs-base);
	line-height: 1.6;
}

.fl-callout.is-danger {
	background: var(--fl-danger-weak);
}

.fl-callout.is-success {
	background: var(--fl-accent-weak);
}

.fl-callout-icon {
	margin-top: 2px;
	color: var(--fl-tx);
}

.is-danger .fl-callout-icon {
	color: var(--fl-danger);
}

.is-success .fl-callout-icon {
	color: var(--fl-accent);
}

.fl-callout-body {
	min-width: 0;
}

/* 多条告警排成有圆点的列表，单条时就是一行文字 */
.fl-callout-body :deep(ul) {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.fl-callout-body :deep(li) {
	position: relative;
	padding-left: 12px;
}

.fl-callout-body :deep(li)::before {
	content: '';
	position: absolute;
	top: 0.68em;
	left: 2px;
	width: 4px;
	height: 4px;
	border-radius: 50%;
	background: currentColor;
	opacity: 0.45;
}
</style>
