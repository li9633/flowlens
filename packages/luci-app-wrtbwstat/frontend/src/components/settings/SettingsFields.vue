<script setup>
import BaseField from '../ui/BaseField.vue';
import BaseInput from '../ui/BaseInput.vue';
import BaseSelect from '../ui/BaseSelect.vue';
import ToggleSwitch from '../ui/ToggleSwitch.vue';
import { useI18n } from '../../composables/useI18n.js';
import { REFRESH_OPTIONS, RETENTION_MAX, RETENTION_MIN } from '../../constants/index.js';

// 采集参数表单。字段级 v-model 而不是把整个 form 对象传进来改：
// 子组件不持有、也不改写父级状态，每个字段的读写权都在父级 composable 手里。

const storageDir = defineModel('storageDir', { type: String, default: '' });
const retentionDays = defineModel('retentionDays', { type: Number, default: 95 });
const commitInterval = defineModel('commitInterval', { type: String, default: '6h' });
const compress = defineModel('compress', { type: Boolean, default: true });
const refreshInterval = defineModel('refreshInterval', { type: Number, default: 30 });

const { t } = useI18n();

// 保留天数必须是数字（后端按整数校验），转换放在这里而不是输入框组件里：
// 同一个 BaseInput 在"存储目录""落盘间隔"上要原样保留 "6h" 这类字符串。
function toInteger(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}
</script>

<template>
	<div class="fl-form">
		<BaseField :label="t('storageDir')">
			<BaseInput v-model="storageDir" type="text" spellcheck="false" />
		</BaseField>

		<BaseField :label="t('retention')">
			<BaseInput
				:model-value="retentionDays"
				type="number"
				:min="RETENTION_MIN"
				:max="RETENTION_MAX"
				@update:model-value="retentionDays = toInteger($event)"
			/>
		</BaseField>

		<BaseField :label="t('commitInterval')">
			<BaseInput v-model="commitInterval" type="text" spellcheck="false" />
		</BaseField>

		<BaseField :label="t('refreshInterval')">
			<BaseSelect v-model.number="refreshInterval">
				<option v-for="v in REFRESH_OPTIONS" :key="v" :value="v">
					{{ v === 0 ? t('off') : v + ' ' + t('seconds') }}
				</option>
			</BaseSelect>
		</BaseField>

		<div class="fl-form-switch">
			<ToggleSwitch v-model="compress">{{ t('compress') }}</ToggleSwitch>
		</div>
	</div>
</template>

<style scoped>
.fl-form {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
	gap: 14px;
}

/* 开关独占一行，与上方四个字段拉开一点距离 */
.fl-form-switch {
	grid-column: 1 / -1;
	margin-top: 4px;
}
</style>
