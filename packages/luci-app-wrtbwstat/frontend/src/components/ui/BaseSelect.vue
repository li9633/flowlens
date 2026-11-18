<script setup>
// 下拉选择。option 由调用方通过默认插槽传入，保持与原生 select 一致的心智。
// option 上用 :value 绑定非字符串（如数字 0/10/30/60）时，Vue 会把原值挂在
// option._value 上，v-model 取回的就是原类型，不需要再转。
const model = defineModel({ type: [ String, Number ], default: '' });
</script>

<template>
	<select v-model="model" class="fl-input fl-select">
		<slot />
	</select>
</template>

<style scoped>
.fl-input {
	box-sizing: border-box;
	width: 100%;
	padding: 7px 11px;
	border: 1px solid var(--fl-hair);
	border-radius: var(--fl-radius-sm);
	background: var(--fl-surface-2);
	color: var(--fl-text);
	font: inherit;
	font-size: var(--fl-fs-base);
	line-height: 1.4;
	transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

/* 自绘箭头：原生箭头在各浏览器里对齐不一致，且不吃主题色 */
.fl-select {
	padding-right: 28px;
	background-image: linear-gradient(45deg, transparent 50%, currentColor 50%),
		linear-gradient(135deg, currentColor 50%, transparent 50%);
	background-position: calc(100% - 15px) 50%, calc(100% - 10px) 50%;
	background-size: 5px 5px, 5px 5px;
	background-repeat: no-repeat;
	appearance: none;
	-webkit-appearance: none;
	cursor: pointer;
}

.fl-input:focus {
	outline: none;
	border-color: var(--fl-accent);
	background-color: var(--fl-surface);
	box-shadow: 0 0 0 3px var(--fl-accent-weak);
}
</style>
