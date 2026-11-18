<script setup>
import BaseButton from '../ui/BaseButton.vue';
import BaseCheckbox from '../ui/BaseCheckbox.vue';
import { useI18n } from '../../composables/useI18n.js';

// 危险操作区：单独用低饱和红底卡片隔开，避免和上面的常规保存混在同一条视线里。
// 确认勾选 + 二次点击是唯一的安全阀，不做 confirm() 弹窗——主题各异，弹窗更丑。

defineProps({
	// nlbwmon 实际在用的目录，与配置值可能不同，先展示出来让用户有判断依据
	directory: { type: String, default: '' },
	resetting: { type: Boolean, default: false }
});

const confirm = defineModel({ type: Boolean, default: false });

const emit = defineEmits([ 'reset' ]);

const { t } = useI18n();
</script>

<template>
	<div class="fl-danger">
		<h4 class="fl-danger-title">{{ t('dangerZone') }}</h4>

		<p v-if="directory" class="fl-danger-dir">{{ t('storageDir') }}: {{ directory }}</p>

		<BaseCheckbox v-model="confirm">{{ t('resetConfirm') }}</BaseCheckbox>

		<div class="fl-danger-actions">
			<BaseButton variant="danger" :disabled="resetting || !confirm" @click="emit('reset')">
				{{ t('resetDb') }}
			</BaseButton>
		</div>
	</div>
</template>

<style scoped>
.fl-danger {
	margin-top: 20px;
	padding: 14px 15px;
	border-radius: 12px;
	background: var(--fl-danger-weak);
}

.fl-danger-title {
	margin-bottom: 8px;
	font-size: var(--fl-fs-xs);
	font-weight: 700;
	letter-spacing: 0.07em;
	text-transform: uppercase;
	color: var(--fl-danger);
}

.fl-danger-dir {
	margin-bottom: 10px;
	font-size: var(--fl-fs-sm);
	line-height: 1.6;
	color: var(--fl-muted);
	overflow-wrap: anywhere;
}

.fl-danger-actions {
	margin-top: 12px;
}
</style>
