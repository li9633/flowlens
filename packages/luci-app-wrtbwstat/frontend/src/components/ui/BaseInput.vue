<script setup>
// 文本 / 数字输入。type、placeholder、min、max、spellcheck 等属性由根元素
// 透传；数值转换由调用方负责（见 SettingsFields 的 retention 字段），
// 组件本身只搬运字符串，避免把 "6h" 这种值误转成数字。
const model = defineModel({ type: [ String, Number ], default: '' });
</script>

<template>
	<input v-model="model" class="fl-input">
</template>

<style scoped>
.fl-input {
	box-sizing: border-box;
	width: 100%;
	/* 左侧内边距做成变量：需要放图标的场景（搜索框）由调用方覆盖，
	   比在父组件里写 padding-left 更可靠——不依赖样式注入顺序 */
	padding: 7px 11px 7px var(--fl-input-pad-left, 11px);
	border: 1px solid var(--fl-hair);
	border-radius: var(--fl-radius-sm);
	background: var(--fl-surface-2);
	color: var(--fl-text);
	font: inherit;
	font-size: var(--fl-fs-base);
	line-height: 1.4;
	appearance: none;
	-webkit-appearance: none;
	transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.fl-input:focus {
	outline: none;
	border-color: var(--fl-accent);
	background: var(--fl-surface);
	box-shadow: 0 0 0 3px var(--fl-accent-weak);
}
</style>
