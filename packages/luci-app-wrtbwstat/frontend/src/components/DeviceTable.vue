<script setup>
import { computed } from 'vue';
import { formatBytes, formatShare } from '../utils/format.js';

// 设备列表：排序 + 搜索 + 占比条。
// 排序与搜索由后端完成（get_devices 的 sort / keyword 参数），
// 组件只负责把状态通过 v-model 抛给父组件，避免前后端两套排序口径。

const props = defineProps({
	devices: { type: Array, required: true },
	totalBytes: { type: Number, default: 0 },
	hasData: { type: Boolean, default: false },
	loading: { type: Boolean, default: false },
	label: { type: Function, required: true },
	sort: { type: String, default: 'total' },
	keyword: { type: String, default: '' },
	selected: { type: String, default: '' }
});

const emit = defineEmits([ 'update:sort', 'update:keyword', 'select' ]);

const columns = [
	{ key: 'hostname', text: 'device', sortable: true, align: '' },
	{ key: 'rx', text: 'download', sortable: true, align: 'right' },
	{ key: 'tx', text: 'upload', sortable: true, align: 'right' },
	{ key: 'total', text: 'total', sortable: true, align: 'right' },
	{ key: 'share', text: 'share', sortable: false, align: 'right' }
];

const rows = computed(function() {
	return props.devices.map(function(d) {
		const share = props.totalBytes > 0 ? (d.total_bytes || 0) / props.totalBytes : 0;
		return Object.assign({}, d, { _share: share });
	});
});

function sortBy(key) {
	if (key === props.sort)
		return;
	emit('update:sort', key);
}
</script>

<template>
	<div class="cbi-section flowlens-devices">
		<div class="flowlens-devices-head">
			<h3>{{ label('device') }}</h3>
			<input
				class="cbi-input-text flowlens-search"
				type="search"
				:value="keyword"
				:placeholder="label('search')"
				@input="emit('update:keyword', $event.target.value)"
			>
		</div>

		<div v-if="loading && !hasData" class="flowlens-empty">{{ label('loading') }}</div>

		<div v-else-if="!hasData" class="flowlens-empty">{{ label('empty') }}</div>

		<table v-else class="table flowlens-table">
			<thead>
				<tr>
					<th
						v-for="col in columns"
						:key="col.key"
						:class="[ col.align, col.sortable ? 'is-sortable' : '', sort === col.key ? 'is-sorted' : '' ]"
						@click="col.sortable && sortBy(col.key)"
					>{{ label(col.text) }}</th>
				</tr>
			</thead>
			<tbody>
				<tr
					v-for="row in rows"
					:key="row.mac"
					class="flowlens-row"
					:class="{ 'is-selected': row.mac === selected }"
					@click="emit('select', row)"
				>
					<td class="flowlens-device">
						<span class="flowlens-device-name">{{ row.hostname || row.mac }}</span>
						<span class="flowlens-device-mac">{{ row.mac }}</span>
					</td>
					<td class="right">{{ formatBytes(row.rx_bytes) }}</td>
					<td class="right">{{ formatBytes(row.tx_bytes) }}</td>
					<td class="right">{{ formatBytes(row.total_bytes) }}</td>
					<td class="right">
						<span class="flowlens-share">{{ formatShare(row._share) }}</span>
						<div class="flowlens-bar slim">
							<div class="flowlens-bar-fill" :style="{ width: (row._share * 100).toFixed(1) + '%' }"></div>
						</div>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
