<script setup>
import DeviceRow from './DeviceRow.vue';
import BasePanel from '../ui/BasePanel.vue';
import BaseEmpty from '../ui/BaseEmpty.vue';
import BaseInput from '../ui/BaseInput.vue';
import AppIcon from '../ui/AppIcon.vue';
import { useI18n } from '../../composables/useI18n.js';
import { ASCENDING_SORTS } from '../../constants/index.js';

// 设备列表：排序 + 搜索 + 占比。
//
// 排序与搜索都交给后端（get_devices 的 sort / keyword），前端只把状态通过
// v-model 抛给父级——避免前后端两套排序口径，也让"按 IP 搜"这类能力只实现一次。
//
// 表格单元格的边框/对齐统一在这里用 :deep() 控制：行是子组件 DeviceRow，
// scoped 样式默认不会命中它的内容，:deep() 明确表达"这张表的排版归这张表管"。

const props = defineProps({
	devices: { type: Array, required: true },
	totalBytes: { type: Number, default: 0 },
	hasData: { type: Boolean, default: false },
	loading: { type: Boolean, default: false },
	sort: { type: String, default: 'total' },
	keyword: { type: String, default: '' },
	selected: { type: String, default: '' }
});

const emit = defineEmits([ 'update:sort', 'update:keyword', 'select' ]);

const { t } = useI18n();

const columns = [
	{ key: 'hostname', text: 'device', sortable: true, right: false, cls: '' },
	{ key: 'rx', text: 'download', sortable: true, right: true, cls: 'fl-col-mid' },
	{ key: 'tx', text: 'upload', sortable: true, right: true, cls: 'fl-col-mid' },
	{ key: 'total', text: 'total', sortable: true, right: true, cls: '' },
	{ key: 'share', text: 'share', sortable: false, right: true, cls: 'fl-col-share' }
];

// 排序方向必须与后端一致（数值降序、名称/MAC 升序），否则箭头会骗人
function sortMark(key) {
	return ASCENDING_SORTS.includes(key) ? '↑' : '↓';
}

function ariaSort(key) {
	if (props.sort !== key) return 'none';
	return ASCENDING_SORTS.includes(key) ? 'ascending' : 'descending';
}

function sortBy(key) {
	if (key === props.sort) return;
	emit('update:sort', key);
}
</script>

<template>
	<BasePanel>
		<template #title>
			{{ t('device') }}
			<span v-if="hasData" class="fl-pill">{{ devices.length }}</span>
		</template>

		<template #actions>
			<div class="fl-search">
				<AppIcon name="search" :size="14" />
				<BaseInput
					type="search"
					:model-value="keyword"
					:placeholder="t('search')"
					@update:model-value="emit('update:keyword', $event)"
				/>
			</div>
		</template>

		<BaseEmpty v-if="loading && !hasData" :text="t('loading')" />

		<BaseEmpty v-else-if="!hasData" :text="t('empty')" />

		<table v-else class="fl-table">
			<thead>
				<tr>
					<th
						v-for="col in columns"
						:key="col.key"
						:class="[ col.cls, col.right ? 'is-right' : '', col.sortable ? 'is-sortable' : '', sort === col.key ? 'is-sorted' : '' ]"
						:aria-sort="col.sortable ? ariaSort(col.key) : undefined"
						@click="col.sortable && sortBy(col.key)"
					>
						{{ t(col.text) }}<span v-if="sort === col.key" class="fl-sort-mark" aria-hidden="true">{{ sortMark(col.key) }}</span>
					</th>
				</tr>
			</thead>
			<tbody>
				<DeviceRow
					v-for="row in devices"
					:key="row.mac"
					:row="row"
					:total-bytes="totalBytes"
					:selected="row.mac === selected"
					@select="emit('select', $event)"
				/>
			</tbody>
		</table>
	</BasePanel>
</template>

<style scoped>
.fl-pill {
	padding: 1px 7px;
	border-radius: 999px;
	background: var(--fl-track);
	color: var(--fl-muted);
	font-size: var(--fl-fs-sm);
	font-weight: 550;
	font-variant-numeric: tabular-nums;
}

/* 搜索框：图标压在输入框左侧；宽度由容器决定，输入框自己永远 100% */
.fl-search {
	position: relative;
	display: flex;
	align-items: center;
	width: 220px;
	--fl-input-pad-left: 30px;
}

.fl-search :deep(svg) {
	position: absolute;
	left: 10px;
	color: var(--fl-faint);
	pointer-events: none;
}

.fl-table {
	width: 100%;
	border-collapse: collapse;
	font-variant-numeric: tabular-nums;
}

.fl-table thead th {
	padding: 0 10px 8px;
	border-bottom: 1px solid var(--fl-hair);
	font-size: var(--fl-fs-xs);
	font-weight: 600;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: var(--fl-faint);
	text-align: left;
	white-space: nowrap;
}

.fl-table thead th.is-right {
	text-align: right;
}

.fl-table thead th.is-sortable {
	cursor: pointer;
	user-select: none;
	transition: color 0.15s ease;
}

.fl-table thead th.is-sortable:hover {
	color: var(--fl-text);
}

.fl-table thead th.is-sorted {
	color: var(--fl-accent);
}

.fl-sort-mark {
	margin-left: 3px;
	font-size: 9px;
	vertical-align: 1px;
}

/* 行的单元格属于子组件，用 :deep() 穿透 */
.fl-table :deep(tbody td) {
	padding: 9px 10px;
	border-bottom: 1px solid var(--fl-hair);
	text-align: left;
	white-space: nowrap;
}

.fl-table :deep(tbody td.is-right) {
	text-align: right;
}

.fl-table :deep(tbody tr:last-child td) {
	border-bottom: 0;
}

.fl-table :deep(.fl-row) {
	cursor: pointer;
	transition: background-color 0.13s ease;
}

.fl-table :deep(.fl-row:hover td) {
	background: var(--fl-surface-2);
}

.fl-table :deep(.fl-row.is-selected td) {
	background: var(--fl-accent-weak);
}

.fl-table :deep(.fl-row.is-selected td:first-child) {
	box-shadow: inset 2px 0 0 var(--fl-accent);
}

@media (max-width: 760px) {
	.fl-search {
		width: 100%;
	}

	/* 单元格在子组件里，隐藏列必须穿透作用域 */
	.fl-table :deep(.fl-col-mid) {
		display: none;
	}
}

@media (max-width: 480px) {
	.fl-table :deep(.fl-col-share) {
		display: none;
	}
}
</style>
