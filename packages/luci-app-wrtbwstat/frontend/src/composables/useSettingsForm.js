/**
 * 插件设置表单：读取、保存、清库。
 *
 * 写操作全部走注入的 api（参数校验在后端 ucode 里），前端只负责收集与呈现。
 * 后端返回的是语言中立的 code（'errRetention' 之类），交给视图层用 t/tm 翻译。
 */

import { reactive, ref } from 'vue';
import { DEFAULT_SETTINGS } from '../constants/index.js';

export function useSettingsForm(api, t) {
	const form = reactive({ ...DEFAULT_SETTINGS });

	const collector = ref(null);
	const errors = ref([]);
	const notice = ref('');

	const saving = ref(false);
	const resetting = ref(false);
	const confirmReset = ref(false);

	function applySettings(settings) {
		form.storage_dir = settings?.storage_dir ?? DEFAULT_SETTINGS.storage_dir;
		form.retention_days = Number(settings?.retention_days ?? DEFAULT_SETTINGS.retention_days);
		form.commit_interval = settings?.commit_interval ?? DEFAULT_SETTINGS.commit_interval;
		form.compress = settings?.compress !== false;
		form.refresh_interval = Number(settings?.refresh_interval ?? DEFAULT_SETTINGS.refresh_interval);

		collector.value = settings?.collector ?? null;
	}

	async function load() {
		try {
			applySettings(await api.getSettings());
		}
		catch (e) {
			errors.value = [ e?.message || t('error') ];
		}
	}

	async function save() {
		// 重入保护：按钮 disabled 要等 Vue 下次渲染才生效，
		// 同一帧内的双击仍会进到这里，靠这个闸门挡住重复写配置。
		if (saving.value || resetting.value)
			return false;

		saving.value = true;
		errors.value = [];
		notice.value = '';

		try {
			const r = await api.setSettings(
				form.storage_dir,
				form.retention_days,
				form.commit_interval,
				form.compress,
				form.refresh_interval
			);

			if (r?.success) {
				notice.value = t('saved');
				return true;
			}

			errors.value = Array.isArray(r?.errors) ? r.errors : [ t('error') ];
			return false;
		}
		catch (e) {
			errors.value = [ e?.message || t('error') ];
			return false;
		}
		finally {
			saving.value = false;
		}
	}

	async function resetDatabase() {
		// 同上：清库是破坏性写操作，绝不允许并发或重复进入
		if (resetting.value || saving.value)
			return false;

		if (!confirmReset.value) {
			errors.value = [ t('resetNeedConfirm') ];
			return false;
		}

		resetting.value = true;
		errors.value = [];
		notice.value = '';

		try {
			const r = await api.resetDatabase(true);

			if (r?.success) {
				notice.value = t('resetDone') + ' (' + (r.removed ?? 0) + ')';
				confirmReset.value = false;
				await load();
				return true;
			}

			errors.value = [ r?.message ?? t('error') ];
			return false;
		}
		catch (e) {
			errors.value = [ e?.message || t('error') ];
			return false;
		}
		finally {
			resetting.value = false;
		}
	}

	return {
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
	};
}
