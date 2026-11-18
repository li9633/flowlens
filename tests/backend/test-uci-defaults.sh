#!/bin/sh
# 验证安装时执行的 uci-defaults：把 nlbwmon 从默认配置调整为 FlowLens 需要的日账期基线
set -e

WORK=${WORK:-/work}
SETUP=$WORK/packages/wrtbwstat/root/etc/uci-defaults/80_wrtbwstat

echo "=== 运行前 ==="
rm -rf /mnt/usb/wrtbwstat
mkdir -p /etc/config
cat > /etc/config/nlbwmon <<'EOF'
config nlbwmon
	option database_directory '/tmp/nlbwmon'
	option database_generations '10'
EOF
uci -q show nlbwmon

echo
echo "=== 执行 80_wrtbwstat ==="
sh "$SETUP" || echo "(脚本退出码非 0，继续检查结果)"

echo
echo "=== 运行后 ==="
uci -q show nlbwmon

echo
FAIL=0

chk() {
	actual=$(uci -q get "nlbwmon.@nlbwmon[0].$1")
	if [ "$actual" = "$2" ]; then
		echo "PASS nlbwmon.$1 = $actual"
	else
		echo "FAIL nlbwmon.$1 = '$actual'，期望 '$2'"
		FAIL=1
	fi
}

chk database_interval '2026-01-01/1'
chk database_generations '95'
chk commit_interval '6h'
chk database_compress '1'
# 原值是 tmpfs 路径，脚本应当把它替换为持久化目录下的插件独占子目录
chk database_directory '/mnt/usb/wrtbwstat'

NETS=$(uci -q get nlbwmon.@nlbwmon[0].local_network)
case " $NETS " in
	*" lan "*) echo "PASS local_network 含 lan ($NETS)" ;;
	*) echo "FAIL local_network 未含 lan ($NETS)"; FAIL=1 ;;
esac

if [ -d /mnt/usb/wrtbwstat ]; then echo "PASS 存储目录已创建"; else echo "FAIL 存储目录未创建"; FAIL=1; fi

echo
echo "=== 旧版 storage_dir 语义迁移 ==="
cat > /etc/config/wrtbwstat <<'EOF'
config settings 'settings'
	option storage_dir '/mnt/usb/nlbwmon'
EOF
mkdir -p /mnt/usb/nlbwmon
printf 'x' > /mnt/usb/nlbwmon/20261101.db.gz
uci -q set nlbwmon.@nlbwmon[0].database_directory='/mnt/usb/nlbwmon'
uci -q commit nlbwmon
sh "$SETUP"

got=$(uci -q get wrtbwstat.settings.storage_dir)
if [ "$got" = "/mnt/usb" ]; then echo "PASS 旧 storage_dir 收敛为父目录 ($got)"; else echo "FAIL 旧 storage_dir = '$got'，期望 '/mnt/usb'"; FAIL=1; fi
chk database_directory '/mnt/usb/wrtbwstat'
if [ -f /mnt/usb/wrtbwstat/20261101.db.gz ]; then echo "PASS 旧库已迁移"; else echo "FAIL 旧库未迁移"; FAIL=1; fi

echo
if [ "$FAIL" = "1" ]; then echo "### uci-defaults 验证失败"; exit 1; fi
echo "### uci-defaults 验证通过"
