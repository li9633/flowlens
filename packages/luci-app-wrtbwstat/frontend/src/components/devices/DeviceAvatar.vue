<script setup>
import { computed } from 'vue';
import { avatarInitial, avatarStyle } from '../../utils/color.js';

// 设备首字母头像。色相由 MAC 稳定散列，同一台设备永远同色，
// 扫列表时靠颜色认设备比靠 MAC 快得多。

const props = defineProps({
	device: { type: Object, required: true }
});

const style = computed(() => avatarStyle(props.device.mac));
const initial = computed(() => avatarInitial(props.device));
</script>

<template>
	<span class="fl-avatar" :style="style" aria-hidden="true">{{ initial }}</span>
</template>

<style scoped>
.fl-avatar {
	display: grid;
	place-items: center;
	width: 30px;
	height: 30px;
	flex: none;
	border-radius: 9px;
	font-size: 12px;
	font-weight: 600;
	line-height: 1;
}
</style>
