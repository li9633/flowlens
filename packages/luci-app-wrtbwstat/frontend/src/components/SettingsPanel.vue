<script setup>
import { onMounted, ref } from 'vue';

// 设置面板：采集参数 + 危险操作。
// 写操作全部走注入的 api（后端做参数校验），前端只负责收集与呈现结果。

const props = defineProps({
	api: { type: Object, required: true },
	label: { type: Function, required: true }
});

const emit = defineEmits([ 'close', 'changed' ]);

const form = ref({
	storage_dir: '',
	retention_days: 95,
	commit_interval: '6h',
	compress: true,
	refresh_interval: 30
});

const collector = ref(null);
const errors = ref([]);
const notice = ref('');
const saving = ref(false);
const confirmReset = ref(false);
const resetting = ref(false);

const REFRESH_CHOICES = [ 0, 10, 30, 60 ];

async function loadSettings() {
	try {
		const s = await props.api.getSettings();

		form.value = {
			storage_dir: s?.storage_dir ?? '',
			retention_days: Number(s?.retention_days ?? 95),
			commit_interval: s?.commit_interval ?? '6h',
			compress: s?.compress !== false,
			refresh_interval: Number(s?.refresh_interval ?? 30)
		};

		collector.value = s?.collector ?? null;
	}
	catch (e) {
		errors.value = [ e?.message || props.label('error') ];
	}
}

async function save() {
	saving.value = true;
	errors.value = [];
	notice.value = '';

	try {
		const r = await props.api.setSettings(
			form.value.storage_dir,
			form.value.retention_days,
			form.value.commit_interval,
			form.value.compress,
			form.value.refresh_interval
		);

		if (r?.success) {
			notice.value = props.label('saved');
			emit('changed');
		}
		else {
			errors.value = Array.isArray(r?.errors) ? r.errors : [ props.label('error') ];
		}
	}
	catch (e) {
		errors.value = [ e?.message || props.label('error') ];
	}
	finally {
		saving.value = false;
	}
}

async function resetDb() {
	if (!confirmReset.value) {
		errors.value = [ props.label('resetNeedConfirm') ];
		return;
	}

	resetting.value = true;
	errors.value = [];
	notice.value = '';

	try {
		const r = await props.api.resetDatabase(true);

		if (r?.success) {
			notice.value = props.label('resetDone') + ' (' + (r.removed ?? 0) + ')';
			confirmReset.value = false;
			emit('changed');
			await loadSettings();
		}
		else {
			errors.value = [ r?.message || props.label('error') ];
		}
	}
	catch (e) {
		errors.value = [ e?.message || props.label('error') ];
	}
	finally {
		resetting.value = false;
	}
}

onMounted(loadSettings);
</script>

<template>
	<div class="cbi-section flowlens-settings">
		<div class="flowlens-detail-head">
			<h3 class="flowlens-detail-title">{{ label('settings') }}</h3>
			<button type="button" class="btn cbi-button cbi-button-neutral" @click="emit('close')">
				{{ label('close') }}
			</button>
		</div>

		<div v-if="errors.length" class="alert-message warning">
			<div v-for="e in errors" :key="e">{{ e }}</div>
		</div>
		<div v-if="notice" class="alert-message success">{{ notice }}</div>

		<div class="flowlens-form">
			<label>
				<span>{{ label('storageDir') }}</span>
				<input v-model="form.storage_dir" type="text" class="cbi-input-text">
			</label>

			<label>
				<span>{{ label('retention') }}</span>
				<input v-model.number="form.retention_days" type="number" min="90" max="3650" class="cbi-input-text">
			</label>

			<label>
				<span>{{ label('commitInterval') }}</span>
				<input v-model="form.commit_interval" type="text" class="cbi-input-text">
			</label>

			<label>
				<span>{{ label('refreshInterval') }}</span>
				<select v-model.number="form.refresh_interval" class="cbi-input-select">
					<option v-for="v in REFRESH_CHOICES" :key="v" :value="v">
						{{ v === 0 ? label('off') : v + ' ' + label('seconds') }}
					</option>
				</select>
			</label>

			<label class="flowlens-check">
				<input v-model="form.compress" type="checkbox">
				<span>{{ label('compress') }}</span>
			</label>
		</div>

		<p class="flowlens-hint">{{ label('refreshHint') }}</p>

		<div class="flowlens-actions">
			<button type="button" class="btn cbi-button cbi-button-apply" :disabled="saving" @click="save">
				{{ label('save') }}
			</button>
		</div>

		<div class="flowlens-danger">
			<h3 class="flowlens-detail-title">{{ label('dangerZone') }}</h3>
			<p class="flowlens-hint" v-if="collector?.directory">
				{{ label('storageDir') }}: {{ collector.directory }}
			</p>
			<label class="flowlens-check">
				<input v-model="confirmReset" type="checkbox">
				<span>{{ label('resetConfirm') }}</span>
			</label>
			<div class="flowlens-actions">
				<button
					type="button"
					class="btn cbi-button cbi-button-remove"
					:disabled="resetting || !confirmReset"
					@click="resetDb"
				>{{ label('resetDb') }}</button>
			</div>
		</div>
	</div>
</template>
