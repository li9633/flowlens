// ===========================================================================
// 测试驱动——由 verify.sh 追加在 luci.wrtbwstat 源文件（去掉末行 return）之后，
// 因此可以直接使用插件里定义的 methods。
//
// fixture（见 mock-nlbw）：每日全网 rx=1510 tx=151
//   A aa:bb:cc:00:11:01  rx1000 tx100  —— 有别名「客厅电视」，协议 HTTPS 700 / HTTP 300
//   B aa:bb:cc:00:11:02  rx 500 tx 50  —— 有 DHCP 租约 hostname「MacBook-Pro」
//   ? 00:00:00:00:00:00  rx  10 tx  1  —— nlbwmon 未解析到源 MAC
//
// FL_PHASE=read  只读阶段（可重复执行以验证缓存）
// FL_PHASE=write 写阶段（set_settings / reset_database）
// ===========================================================================

let failed = 0;

function check(label, actual, expected) {
	let ok = (actual == expected);
	if (!ok) failed++;
	printf("%s %-46s got=%s want=%s\n", ok ? "PASS" : "FAIL", label, actual, expected);
}

function check_share(label, value, expected) {
	check(label, sprintf('%.4f', value), expected);
}

let phase = getenv('FL_PHASE') ?? 'read';

// ---------------------------------------------------------------------------
// 只读阶段
// ---------------------------------------------------------------------------

if (phase == 'read') {

	printf("\n### get_settings\n");
	let st = methods.get_settings.call({ args: {} });
	printf("%.J\n", st);
	check('settings.storage_dir', st.storage_dir, '/srv/nlbw');
	check('settings.retention_days', st.retention_days, 95);
	check('settings.compress', st.compress, true);
	check('collector.generations', st.collector.generations, 95);
	check('collector.binary_present', st.collector.binary_present, true);
	check('collector.local_networks[0]', st.collector.local_networks[0], 'lan');
	check('warnings.non_empty', length(st.warnings) > 0, true);

	printf("\n### get_summary（窗口与逐日枚举）\n");
	let sum = methods.get_summary.call({ args: { range: 'last7' } });
	let want = { today: 1510, yesterday: 1510, last7: 10570, last30: 45300, last90: 135900 };

	for (let r in sum.ranges) {
		printf("  %-10s days=%-2d rx=%-7d tx=%-6d total=%-7d series=%d\n",
			r.range, r.days, r.rx_bytes, r.tx_bytes, r.total_bytes, length(r.series));
		check('summary.' + r.range + '.rx', r.rx_bytes, want[r.range]);
		check('summary.' + r.range + '.tx', r.tx_bytes, want[r.range] / 10);
	}

	check('summary.last90.series_len', length(sum.ranges[4].series), 90);
	check('summary.days_with_data', sum.days_with_data, 90);
	check('summary.range_echo', sum.range, 'last7');

	printf("\n### get_devices(last7, sort=total)\n");
	let dv = methods.get_devices.call({ args: { range: 'last7', sort: 'total', keyword: '' } });
	printf("  total=%d count=%d\n", dv.total_bytes, dv.device_count);
	for (let d in dv.devices)
		printf("  %-12s %-17s rx=%-6d tx=%-5d total=%-6d share=%.4f days=%d\n",
			d.hostname, d.mac, d.rx_bytes, d.tx_bytes, d.total_bytes, d.share, d.days_active);

	check('devices.count', dv.device_count, 3);
	check('devices.total_bytes', dv.total_bytes, 11627);

	if (dv.device_count == 3) {
		check('devices[0].mac (total desc)', dv.devices[0].mac, 'aa:bb:cc:00:11:01');
		check('devices[0].hostname_alias', dv.devices[0].hostname, '客厅电视');
		check('devices[0].rx', dv.devices[0].rx_bytes, 7000);
		check('devices[0].total', dv.devices[0].total_bytes, 7700);
		check('devices[0].days_active', dv.devices[0].days_active, 7);
		check_share('devices[0].share', dv.devices[0].share, '0.6623');
		check('devices[1].mac', dv.devices[1].mac, 'aa:bb:cc:00:11:02');
		check('devices[1].hostname_dhcp', dv.devices[1].hostname, 'MacBook-Pro');
		check_share('devices[1].share', dv.devices[1].share, '0.3311');
		check('devices[2].hostname_unknown', dv.devices[2].hostname, '');
		check('devices[2].unknown_source', dv.devices[2].unknown_source, true);
	}

	printf("\n### 排序与关键词\n");
	let hm = methods.get_devices.call({ args: { range: 'last7', sort: 'hostname', keyword: '' } });
	check('sort.hostname.first', hm.devices[0].mac, 'aa:bb:cc:00:11:02');

	let macs = methods.get_devices.call({ args: { range: 'today', sort: 'mac', keyword: '' } });
	check('sort.mac.first', macs.devices[0].mac, '00:00:00:00:00:00');

	let rx = methods.get_devices.call({ args: { range: 'last7', sort: 'rx', keyword: '' } });
	check('sort.rx.first_total', rx.devices[0].total_bytes, 7700);

	let kw = methods.get_devices.call({ args: { range: 'last7', sort: 'hostname', keyword: 'macbook' } });
	check('keyword.macbook.count', kw.device_count, 1);
	if (kw.device_count == 1)
		check('keyword.macbook.mac', kw.devices[0].mac, 'aa:bb:cc:00:11:02');
	else
		{ printf("FAIL keyword.macbook.mac 无结果可校验\n"); failed++; }

	let kw2 = methods.get_devices.call({ args: { range: 'last7', sort: 'rx', keyword: '00:11:01' } });
	check('keyword.mac.count', kw2.device_count, 1);

	let kw3 = methods.get_devices.call({ args: { range: 'last7', sort: 'rx', keyword: 'zzz-none' } });
	check('keyword.none.count', kw3.device_count, 0);

	printf("\n### get_device(A, last7)\n");
	let one = methods.get_device.call({ args: { mac: 'AA:BB:CC:00:11:01', range: 'last7' } });
	printf("  mac=%s hostname=%s proto_field=%s days=%d errors=%d\n",
		one.mac, one.hostname, one.proto_field, length(one.days), length(one.errors));
	for (let p in one.protocols)
		printf("  proto %-8s rx=%-5d tx=%-4d share=%.4f\n", p.name, p.rx_bytes, p.tx_bytes, p.share);

	check('device.mac_normalized', one.mac, 'aa:bb:cc:00:11:01');
	check('device.hostname', one.hostname, '客厅电视');
	check('device.days_len', length(one.days), 7);
	check('device.last_day_rx', one.days[6].rx_bytes, 1000);
	check('device.errors_empty', length(one.errors), 0);

	if (getenv('FL_NLBW_BREAK_LAYER7')) {
		check('device.proto_field_fallback', one.proto_field, 'proto');
		check('device.fallback_protocols', length(one.protocols), 1);
		check('device.fallback_name', one.protocols[0].name, 'proto 6');
		check('device.fallback_rx', one.protocols[0].rx_bytes, 7000);
	}
	else {
		check('device.proto_field', one.proto_field, 'layer7');
		check('device.protocols_len', length(one.protocols), 2);
		if (length(one.protocols) == 2) {
			check('device.https_rx', one.protocols[0].rx_bytes, 4900);
			check('device.https_share', sprintf('%.2f', one.protocols[0].share), '0.70');
			check('device.http_rx', one.protocols[1].rx_bytes, 2100);
		}
	}

	let bad = methods.get_device.call({ args: { mac: 'not-a-mac', range: 'last7' } });
	check('device.invalid_mac_error', bad.error.code, 'errInvalidMac');
}

// ---------------------------------------------------------------------------
// 写阶段
// ---------------------------------------------------------------------------

else {

	printf("\n### set_settings 校验\n");
	let e1 = methods.set_settings.call({ args: { storage_dir: '/tmp/nlbw' } });
	printf("  reject tmpfs -> %.J\n", e1);
	check('set_settings.tmpfs_rejected', e1.success, false);
	check('set_settings.tmpfs_err_n', length(e1.errors), 1);

	let e2 = methods.set_settings.call({ args: { storage_dir: '/var/lib/x' } });
	check('set_settings.var_rejected', e2.success, false);

	let e3 = methods.set_settings.call({ args: { refresh_interval: 15 } });
	check('set_settings.refresh_rejected', e3.success, false);

	let e4 = methods.set_settings.call({ args: { commit_interval: 'abc' } });
	check('set_settings.commit_rejected', e4.success, false);

	let e5 = methods.set_settings.call({ args: { retention_days: 30 } });
	check('set_settings.retention_rejected', e5.success, false);

	printf("\n### set_settings 生效\n");
	let ok = methods.set_settings.call({ args: {
		storage_dir: '/srv/nlbw', refresh_interval: 60, retention_days: 120, commit_interval: '3h'
	} });
	printf("  apply -> %.J\n", ok);
	check('set_settings.applied', ok.success, true);

	let after = methods.get_settings.call({ args: {} });
	check('set_settings.refresh_written', after.refresh_interval, 60);
	check('set_settings.retention_written', after.retention_days, 120);
	check('set_settings.commit_written', after.commit_interval, '3h');
	check('set_settings.collector_generations_synced', after.collector.generations, 120);
	check('set_settings.collector_commit_synced', after.collector.commit_interval, '3h');

	printf("\n### reset_database\n");
	let deny = methods.reset_database.call({ args: { confirm: false } });
	check('reset.denied_without_confirm', deny.success, false);

	let reset = methods.reset_database.call({ args: { confirm: true } });
	printf("  reset -> %.J\n", reset);
	check('reset.success', reset.success, true);
	check('reset.removed', reset.removed, 2);
	check('reset.freed_bytes', reset.freed_bytes > 0, true);
	check('reset.directory', reset.directory, '/srv/nlbw');
}

printf("\n=== %s：%d 项断言失败 ===\n", failed ? "FAILED" : "ALL PASS", failed);

if (failed) exit(1);
