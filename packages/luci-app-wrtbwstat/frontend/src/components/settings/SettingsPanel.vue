<script setup>
import { onMounted } from 'vue';
import BasePanel from '../ui/BasePanel.vue';
import BaseButton from '../ui/BaseButton.vue';
import BaseCallout from '../ui/BaseCallout.vue';
import AppIcon from '../ui/AppIcon.vue';
import SettingsFields from './SettingsFields.vue';
import DangerZone from './DangerZone.vue';
import { useSettingsForm } from '../../composables/useSettingsForm.js';
import { useI18n } from '../../composables/useI18n.js';

// 设置面板：常规配置 + 危险操作。
// 读写逻辑在 useSettingsForm，这里只做组装与事件上抛（changed 让父级重新拉数据）。

const props = defineProps({
	api: { type: Object, required: true }
});

const emit = defineEmits([ 'close', 'changed' ]);

const { t, tm } = useI18n();

const {
	form,
	collector,
	errors,
	notice,
	saving,
	resetting,
	confirmReset,
	load,
	save,
	resetDatabase
} = useSettingsForm(props.api, t);

onMounted(load);

async function onSave() {
	if (await save())
		emit('changed');
}

async function onReset() {
	if (await resetDatabase())
		emit('changed');
}
</script>

<template>
	<BasePanel>
		<template #title>{{ t('settings') }}</template>

		<template #actions>
			<BaseButton @click="emit('close')">
				<AppIcon name="close" :size="14" />
				<span class="fl-btn-label">{{ t('close') }}</span>
			</BaseButton>
		</template>

		<BaseCallout v-if="errors.length" tone="danger">
			<ul>
				<li v-for="(e, i) in errors" :key="i">{{ tm(e) }}</li>
			</ul>
		</BaseCallout>

		<BaseCallout v-if="notice" tone="success">{{ notice }}</BaseCallout>

		<SettingsFields
			v-model:storage-dir="form.storage_dir"
			v-model:retention-days="form.retention_days"
			v-model:commit-interval="form.commit_interval"
			v-model:compress="form.compress"
			v-model:refresh-interval="form.refresh_interval"
		/>

		<p class="fl-hint">{{ t('refreshHint') }}</p>

		<div class="fl-actions">
			<BaseButton variant="primary" :disabled="saving || resetting" @click="onSave">
				{{ t('save') }}
			</BaseButton>
		</div>

		<DangerZone
			v-model="confirmReset"
			:directory="collector?.directory || ''"
			:resetting="resetting"
			:saving="saving"
			@reset="onReset"
		/>
	</BasePanel>
</template>

<style scoped>
.fl-hint {
	margin: 14px 0 0;
	font-size: var(--fl-fs-sm);
	line-height: 1.6;
	color: var(--fl-muted);
}

.fl-actions {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	margin-top: 16px;
}
</style>
