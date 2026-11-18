<script setup>
import AppIcon from '../ui/AppIcon.vue';
import BaseButton from '../ui/BaseButton.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import { useI18n } from '../../composables/useI18n.js';

// 顶栏：品牌标识 + 数据元信息 + 工具条（时间窗分段控件、设置开关）。
// 只接收展示所需的数据，时间窗通过 v-model:range 双向绑定。

defineProps({
	title: { type: String, required: true },
	// 数据时间戳（HH:MM），为空表示还没拿到数据
	updatedLabel: { type: String, default: '' },
	deviceCount: { type: Number, default: 0 },
	// [{ value, label }]
	rangeOptions: { type: Array, required: true },
	settingsOpen: { type: Boolean, default: false }
});

const range = defineModel('range', { type: String, required: true });

const emit = defineEmits([ 'toggle-settings' ]);

const { t } = useI18n();
</script>

<template>
	<header class="fl-topbar">
		<div class="fl-brand">
			<span class="fl-mark" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
					<path d="M4.5 14.5v4.5" />
					<path d="M9.5 9.5v9.5" />
					<path d="M14.5 12v7" />
					<path d="M19.5 5v14" />
				</svg>
			</span>

			<div class="fl-brand-text">
				<h2 class="fl-title">{{ title }}</h2>

				<!-- 只用「图标 + 数字」表达更新时间与设备数，不引入新的翻译键 -->
				<p class="fl-meta">
					<span v-if="updatedLabel" class="fl-meta-item">
						<AppIcon name="clock" :size="12" />
						{{ updatedLabel }}
					</span>
					<span class="fl-meta-item">
						<AppIcon name="devices" :size="12" />
						{{ deviceCount }}
					</span>
				</p>
			</div>
		</div>

		<div class="fl-toolbar">
			<SegmentedControl v-model="range" :options="rangeOptions" />

			<BaseButton
				class="fl-settings-btn"
				:aria-expanded="settingsOpen ? 'true' : 'false'"
				@click="emit('toggle-settings')"
			>
				<AppIcon name="sliders" :size="14" />
				<span class="fl-btn-label">{{ t('settings') }}</span>
			</BaseButton>
		</div>
	</header>
</template>

<style scoped>
.fl-topbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 14px;
	margin-bottom: 18px;
}

.fl-brand {
	display: flex;
	align-items: center;
	gap: 11px;
	min-width: 0;
}

.fl-mark {
	display: grid;
	place-items: center;
	width: 38px;
	height: 38px;
	flex: none;
	border-radius: 12px;
	color: #fff;
	background: var(--fl-accent);
	background-image: linear-gradient(145deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0));
	box-shadow: 0 1px 2px rgba(16, 24, 40, 0.12);
}

.fl-mark svg {
	width: 20px;
	height: 20px;
}

.fl-brand-text {
	min-width: 0;
}

.fl-title {
	font-size: var(--fl-fs-lg);
	font-weight: 650;
	letter-spacing: -0.015em;
	line-height: 1.25;
	color: var(--fl-text);
}

.fl-meta {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-top: 3px;
	font-size: var(--fl-fs-sm);
	color: var(--fl-faint);
	font-variant-numeric: tabular-nums;
}

.fl-meta-item {
	display: inline-flex;
	align-items: center;
	gap: 4px;
}

.fl-meta-item :deep(svg) {
	opacity: 0.85;
}

.fl-toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
}

@media (max-width: 760px) {
	/*
	 * 移动端：工具栏用 display:contents 拆开，让「设置」按钮回到标题那一行，
	 * 分段控件独占第二行整宽——否则按钮会被占满宽度的分段控件挤到下一行，
	 * 变成孤零零一个图标按钮。
	 */
	.fl-topbar {
		gap: 12px;
	}

	.fl-toolbar {
		display: contents;
	}

	.fl-settings-btn {
		order: 2;
		flex: none;
	}

	/* .fl-seg 是子组件根元素，父组件的 scoped 样式可以直接命中 */
	.fl-seg {
		order: 3;
		flex: 1 0 100%;
	}

	.fl-btn-label {
		display: none;
	}
}
</style>
