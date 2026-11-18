<script setup>
// 分段控件（button-switch-group）。
//
// 一条轨道 + 内部连排的按钮，选中项自身抬起一块表面——不是几个各自带边框、
// 彼此隔开间距的按钮。这是扁平化界面里表达「互斥单选」最省视觉噪音的做法。
//
// 为什么不做「单个滑块按 100%/N 平移」：滑块宽度只能按比例算，而按钮宽度由
// 文案决定（今天 vs 近 30 天、Today vs Last 30 days 差很多），两者一旦不一致
// 滑块必然错位。让选中态落在按钮自己身上，零几何计算、换语言不会错位。
//
// 语义仍是 tablist/tab：切换的是同一份数据的视图，保留方向键在选项间移动。

import { computed } from 'vue';

const props = defineProps({
	// [{ value, label }]
	options: { type: Array, required: true }
});

const model = defineModel({ type: String, required: true });

const activeIndex = computed(function() {
	const i = props.options.findIndex((o) => o.value === model.value);
	return i < 0 ? 0 : i;
});

function select(value) {
	if (value !== model.value)
		model.value = value;
}

function onKeydown(event, index) {
	const last = props.options.length - 1;
	let next = null;

	if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
		next = (index >= last) ? 0 : index + 1;
	else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
		next = (index <= 0) ? last : index - 1;
	else if (event.key === 'Home')
		next = 0;
	else if (event.key === 'End')
		next = last;

	if (next === null)
		return;

	event.preventDefault();
	select(props.options[next].value);

	// 焦点跟随选中项，符合 tablist 的键盘约定
	const buttons = event.currentTarget?.parentNode?.querySelectorAll('.fl-seg-btn');
	if (buttons && buttons[next])
		buttons[next].focus();
}
</script>

<template>
	<div class="fl-seg" role="tablist">
		<button
			v-for="(option, i) in options"
			:key="option.value"
			type="button"
			role="tab"
			class="fl-seg-btn"
			:class="{ 'is-active': option.value === model }"
			:aria-selected="option.value === model ? 'true' : 'false'"
			:tabindex="option.value === model ? 0 : -1"
			@click="select(option.value)"
			@keydown="onKeydown($event, i)"
		>{{ option.label }}</button>
	</div>
</template>

<style scoped>
.fl-seg {
	display: flex;
	gap: 2px;
	padding: 3px;
	border-radius: 11px;
	background: var(--fl-track);
}

.fl-seg-btn {
	flex: 0 1 auto;
	min-width: 64px;
	padding: 6px 12px;
	border: 0;
	border-radius: 8px;
	background: transparent;
	color: var(--fl-muted);
	font: inherit;
	font-size: var(--fl-fs-base);
	font-weight: 500;
	line-height: 1.3;
	white-space: nowrap;
	cursor: pointer;
	transition: color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}

.fl-seg-btn:hover {
	color: var(--fl-text);
}

.fl-seg-btn.is-active {
	background: var(--fl-surface);
	color: var(--fl-text);
	font-weight: 600;
	box-shadow: 0 1px 2px rgba(16, 24, 40, 0.10), 0 1px 3px rgba(16, 24, 40, 0.05);
}

.fl-seg-btn:focus-visible {
	outline: none;
	box-shadow: inset 0 0 0 2px var(--fl-accent-line);
}

@media (max-width: 760px) {
	/* 整宽后五个选项等分，才是标准分段控件的手感 */
	.fl-seg-btn {
		flex: 1 1 0;
		min-width: 0;
		padding: 6px 6px;
		font-size: 12px;
	}
}
</style>
