<script setup>
// 图标只用内联 SVG：不引图标库、不受 CSP 限制、随主题 currentColor 变色。
// 每个图标包在 <g> 里而不是 <template v-if>，保证编译器在 SVG 命名空间下创建子元素。
defineProps({
	name: { type: String, required: true },
	size: { type: [ Number, String ], default: 16 }
});
</script>

<template>
	<svg
		class="fl-icon"
		:width="size"
		:height="size"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<g v-if="name === 'clock'">
			<circle cx="12" cy="12" r="8.5" />
			<path d="M12 7.5V12l3 1.8" />
		</g>

		<g v-else-if="name === 'devices'">
			<rect x="3" y="4.5" width="18" height="12" rx="2" />
			<path d="M8.5 20h7" />
		</g>

		<g v-else-if="name === 'sliders'">
			<path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
			<circle cx="15" cy="7" r="2.2" />
			<circle cx="9" cy="17" r="2.2" />
		</g>

		<g v-else-if="name === 'search'">
			<circle cx="11" cy="11" r="6.5" />
			<path d="M16 16l4 4" />
		</g>

		<g v-else-if="name === 'close'">
			<path d="M6 6l12 12M18 6L6 18" />
		</g>

		<g v-else-if="name === 'warning'">
			<path d="M12 8v5M12 16.5v.01" />
			<path d="M10.3 3.9L2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z" />
		</g>

		<g v-else-if="name === 'check'">
			<path d="M20 6L9 17l-5-5" />
		</g>
	</svg>
</template>

<style scoped>
.fl-icon {
	display: block;
	flex: none;
}
</style>
