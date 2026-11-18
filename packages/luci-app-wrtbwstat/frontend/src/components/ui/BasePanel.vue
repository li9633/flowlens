<script setup>
// 面板容器：发丝线卡片 + 可选标题栏。
// 标题与右侧操作走插槽，因为各面板的标题区结构差异很大
// （设备列表是「标题 + 计数 + 搜索框」，详情是「kicker + 名称 + MAC」）。
defineProps({
	// 标题栏纵向对齐：详情那种多行标题要 start，普通面板用 center
	align: {
		type: String,
		default: 'center',
		validator: (v) => [ 'center', 'start' ].includes(v)
	}
});
</script>

<template>
	<section class="fl-panel">
		<header v-if="$slots.title || $slots.actions" class="fl-panel-head" :class="'is-' + align">
			<div v-if="$slots.title" class="fl-panel-title">
				<slot name="title" />
			</div>
			<div v-if="$slots.actions" class="fl-panel-actions">
				<slot name="actions" />
			</div>
		</header>

		<slot />
	</section>
</template>

<style scoped>
.fl-panel {
	box-sizing: border-box;
	margin-top: 16px;
	padding: 16px 18px 18px;
	border: 1px solid var(--fl-hair);
	border-radius: var(--fl-radius);
	background: var(--fl-surface);
}

.fl-panel-head {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 12px;
}

.fl-panel-head.is-center {
	align-items: center;
}

.fl-panel-head.is-start {
	align-items: flex-start;
}

.fl-panel-title {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 13px;
	font-weight: 600;
	letter-spacing: 0.01em;
}

.fl-panel-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}

@media (max-width: 760px) {
	.fl-panel {
		padding: 14px 13px 16px;
	}
}
</style>
