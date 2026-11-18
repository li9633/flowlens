<script setup>
// 时间窗切换条。range 值即后端 get_summary / get_devices 的 range 参数。
defineProps({
	modelValue: { type: String, required: true },
	ranges: { type: Array, required: true },
	label: { type: Function, required: true }
});

const emit = defineEmits([ 'update:modelValue' ]);
</script>

<template>
	<div class="flowlens-tabs" role="tablist">
		<button
			v-for="r in ranges"
			:key="r"
			type="button"
			role="tab"
			class="btn cbi-button"
			:class="r === modelValue ? 'cbi-button-action' : 'cbi-button-neutral'"
			:aria-selected="r === modelValue"
			@click="emit('update:modelValue', r)"
		>{{ label(r) }}</button>
	</div>
</template>
