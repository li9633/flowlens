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
	check('settings.data_dir', st.data_dir, '/srv/nlbw/wrtbwstat');
	check('settings.retention_days', st.retention_days, 95);
	check('settings.compress', st.compress, true);
	check('collector.generations', st.collector.generations, 95);
	check('collector.binary_present', st.collector.binary_present, true);
	check('collector.local_networks[0]', st.collector.local_networks[0], 'lan');
	check('warnings.non_empty', length(st.warnings) > 0, true);

	printf("\n### 采集器健康检查\n");
	check('collector.buffer_baseline', target_netlink_buffer(0), 4194304);
	check('collector.buffer_scaled', target_netlink_buffer(10000), 10485760);
	check('collector.buffer_capped', target_netlink_buffer(1000000), 67108864);

	// 卡死判定需要"守护进程在跑"，用 hint 模拟，避免依赖容器里的套接字路径
	let cw = collect_warnings({ today_error: 'bad file descriptor', conntrack: 100, daemon_present: true });
	let stalled = false;
	for (let w in cw)
		if (w.code == 'warnCollectorStalled') stalled = true;
	check('warnings.collector_stalled', stalled, true);

	// 没有连接时今日为空是正常现象，不能误报
	let cw2 = collect_warnings({ today_error: 'bad file descriptor', conntrack: 0, daemon_present: true });
	let cw3 = collect_warnings({ today_error: 'bad file descriptor', conntrack: 100, daemon_present: false });
	let stalled2 = false;
	let stalled3 = false;
	for (let w in cw2)
		if (w.code == 'warnCollectorStalled') stalled2 = true;
	for (let w in cw3)
		if (w.code == 'warnCollectorStalled') stalled3 = true;
	check('warnings.collector_no_false_positive', stalled2, false);
	check('warnings.collector_daemon_down', stalled3, false);

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

	printf("\n### 容量保护（未超阈值）\n");
	// 3 台设备 × 90 天 = 270 设备日；阈值 18000 × 80% = 14400
	check('capacity.limit_device_days', sum.capacity.limit_device_days, 18000);
	check('capacity.device_days', sum.capacity.device_days, 270);
	check('capacity.keep_days', sum.capacity.keep_days, null);
	check('capacity.percent', sprintf('%.3f', sum.capacity.percent), '0.015');

	let st2 = methods.get_settings.call({ args: {} });
	check('settings.capacity_device_days', st2.capacity.device_days, 270);
	check('settings.capacity_limit', st2.capacity.limit_device_days, 18000);

	printf("\n### get_devices(yesterday) 的账期\n");
	let ydev = methods.get_devices.call({ args: { range: 'yesterday', sort: 'total', keyword: '' } });
	printf("  days=%s total=%d count=%d\n", ydev.days[0], ydev.total_bytes, ydev.device_count);
	check('devices.yesterday.days_len', length(ydev.days), 1);
	check('devices.yesterday.day', ydev.days[0], sum.ranges[1].series[0].date);
	check('devices.yesterday.not_today', ydev.days[0] != sum.ranges[0].series[0].date, true);
	check('devices.yesterday.total (单日)', ydev.total_bytes, 1661);

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
	check('reset.removed', reset.removed, 3);
	check('reset.freed_bytes', reset.freed_bytes > 0, true);
	check('reset.directory', reset.directory, '/srv/nlbw/wrtbwstat');

	printf("\n### repair_collector\n");
	let rpDeny = methods.repair_collector.call({ args: { confirm: false } });
	check('repair.denied_without_confirm', rpDeny.success, false);
	check('repair.denied_code', rpDeny.message.code, 'errFixConfirm');

	printf("\n### fix_fullcone\n");
	let fcDeny = methods.fix_fullcone.call({ args: { confirm: false } });
	check('fix.denied_without_confirm', fcDeny.success, false);
	check('fix.denied_code', fcDeny.message.code, 'errFixConfirm');

	let fix = methods.fix_fullcone.call({ args: { confirm: true } });
	printf("  fix -> %.J\n", fix);
	check('fix.success', fix.success, true);
	// 容器里没有 /sys/module/nft_fullcone，等价于"模块尚未加载"
	check('fix.reboot_required', fix.reboot_required, false);
	check('fix.ko_disabled', !!access('/lib/modules/fl-test/nft_fullcone.ko.disabled'), true);
	check('fix.ko_gone', !!access('/lib/modules/fl-test/nft_fullcone.ko'), false);
	check('fix.modules_d_disabled', !!access('/etc/modules.d/nft-fullcone.disabled'), true);

	// 改文件前必须留备份，且备份里要有可执行的恢复脚本
	check('fix.backup_dir', type(fix.backup_dir) == 'string' && length(fix.backup_dir) > 20, true);
	check('fix.backup_firewall', !!access(fix.backup_dir + '/firewall'), true);
	check('fix.backup_modules_d', !!access(fix.backup_dir + '/nft-fullcone'), true);
	check('fix.backup_ko', !!access(fix.backup_dir + '/nft_fullcone.ko'), true);
	check('fix.backup_restore_script', !!access(fix.backup_dir + '/restore.sh'), true);
	check('fix.backup_marker', trim(readfile('/etc/wrtbwstat/fullcone-backup') ?? ''), fix.backup_dir);

	let fwctx = cursor();
	fwctx.load('firewall');
	check('fix.firewall_fullcone_off', fwctx.get('firewall', '@defaults[0]', 'fullcone'), '0');
	check('fix.firewall_fullcone6_off', fwctx.get('firewall', '@defaults[0]', 'fullcone6'), '0');

	// 重复执行必须安全（用户可能连点两次），已改过的项不再重复备份
	let again = methods.fix_fullcone.call({ args: { confirm: true } });
	check('fix.idempotent', again.success, true);
	check('fix.idempotent_failed', length(again.failed), 0);
	check('fix.idempotent_noop', length(again.changed), 0);
	check('fix.idempotent_no_backup', again.backup_dir, null);

	// 备份里的 restore.sh 必须真的能把三处改动还原
	let restore = run(sprintf('sh %s', fix.backup_dir + '/restore.sh'));
	check('fix.restore_rc', restore.rc, 0);

	let rctx = cursor();
	rctx.load('firewall');
	check('fix.restore_firewall', rctx.get('firewall', '@defaults[0]', 'fullcone'), '1');
	check('fix.restore_ko', !!access('/lib/modules/fl-test/nft_fullcone.ko'), true);
	check('fix.restore_ko_disabled_gone', !!access('/lib/modules/fl-test/nft_fullcone.ko.disabled'), false);
	check('fix.restore_modules_d', !!access('/etc/modules.d/nft-fullcone'), true);

	printf("\n### 容量保护：超阈值裁剪\n");
	let capDir = '/tmp/capdb';
	mkdir(capDir);

	let oldest = replace(day_at(95), '-', '');
	let newest = replace(day_at(1), '-', '');

	for (let i = 1; i <= 95; i++)
		writefile(sprintf('%s/%s.db.gz', capDir, replace(day_at(i), '-', '')), 'x');

	// 当前库不能被当成历史归档删掉
	writefile(capDir + '/nlbwmon.db', 'x');

	writefile('/tmp/wrtbwstat-cache/20000101-mac.json', '[]');
	writefile('/tmp/wrtbwstat-cache/20000101-mac.miss', '0\n');
	writefile('/tmp/wrtbwstat-cache/rollup-last90-mac.json', '{}');
	writefile('/tmp/wrtbwstat-cache/capacity.json', '{}');

	let uctx = cursor();
	uctx.load('nlbwmon');
	uctx.set('nlbwmon', '@nlbwmon[0]', 'database_directory', capDir);
	uctx.commit('nlbwmon');

	// 18000 设备日 / 90 天 = 200 台/天；80% 上限 => 保留 72 天（71 个归档）
	let cs = {
		device_days: 18000, days_with_data: 90,
		keep_days: null, cleaned_archives: 0, cleaned_cache_files: 0
	};
	capacity_cleanup(cs);

	check('capacity.cleanup_keep_days', cs.keep_days, 72);
	check('capacity.cleanup_archives', cs.cleaned_archives, 24);
	check('capacity.cleanup_left', length(glob(capDir + '/*.db.gz')), 71);
	check('capacity.cleanup_oldest_gone', !access(sprintf('%s/%s.db.gz', capDir, oldest)), true);
	check('capacity.cleanup_newest_kept', !!access(sprintf('%s/%s.db.gz', capDir, newest)), true);
	check('capacity.cleanup_current_kept', !!access(capDir + '/nlbwmon.db'), true);

	check('capacity.cache_pruned', !access('/tmp/wrtbwstat-cache/20000101-mac.json'), true);
	check('capacity.miss_pruned', !access('/tmp/wrtbwstat-cache/20000101-mac.miss'), true);
	check('capacity.rollup_pruned', !access('/tmp/wrtbwstat-cache/rollup-last90-mac.json'), true);
	check('capacity.status_kept', !!access('/tmp/wrtbwstat-cache/capacity.json'), true);

	uctx.set('nlbwmon', '@nlbwmon[0]', 'database_directory', '/srv/nlbw');
	uctx.commit('nlbwmon');
}

printf("\n=== %s：%d 项断言失败 ===\n", failed ? "FAILED" : "ALL PASS", failed);

if (failed) exit(1);
