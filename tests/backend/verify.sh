#!/bin/sh
# 在 OpenWrt rootfs 容器内验证后端 luci.wrtbwstat
#
# 用法（在仓库根目录）：
#   sh tests/run-in-container.sh
#
# 设计：把仓库根挂到 /work，脚本用 mock nlbw 产出固定流量，
# 因此每个数字都可预先算出，断言失败即说明聚合/窗口枚举有问题。
#
#   阶段 1：只读 · 冷缓存
#   阶段 2：只读 · 热缓存 —— 断言 nlbw 调用次数骤降
#   阶段 3：写操作（set_settings / reset_database）
#
# 写阶段必须单独跑：它会清缓存，混在只读阶段会让缓存断言失真。
set -e

WORK=${WORK:-/work}
PLUGIN=$WORK/packages/luci-app-wrtbwstat/root/usr/share/rpcd/ucode/luci.wrtbwstat
FAIL=""

echo "== 环境 =="
ucode -e 'let d = localtime(); printf("ucode ok, today=%04d-%02d-%02d\n", d.year, d.mon, d.mday)'

echo "== 安装夹具 =="
mkdir -p /etc/config /usr/bin /srv/nlbw
cp "$WORK/tests/backend/fixtures/nlbwmon" /etc/config/nlbwmon
cp "$WORK/tests/backend/fixtures/wrtbwstat" /etc/config/wrtbwstat
cp "$WORK/tests/backend/mock-nlbw" /usr/bin/nlbw
chmod +x /usr/bin/nlbw

# 01 只有别名；02 只有 DHCP 租约，用于分别验证两级名字回退
printf '%s\n' \
	'1700000000 aa:bb:cc:00:11:01 192.168.2.50 * *' \
	'1700000000 aa:bb:cc:00:11:02 192.168.2.51 MacBook-Pro 01:aa:bb:cc:00:11:02' \
	> /tmp/dhcp.leases

reset_dbfiles() {
	printf 'fake-db-content-0123456789' > /srv/nlbw/nlbwmon.db
	printf 'fake-db-content-0123456789' > /srv/nlbw/nlbwmon.db.1.gz
}
reset_dbfiles

echo "== 组装测试脚本（去掉插件末行 return，接上 driver）=="
sed '$d' "$PLUGIN" > /tmp/test.uc
cat "$WORK/tests/backend/driver.uc" >> /tmp/test.uc

rm -rf /tmp/wrtbwstat-cache
: > /tmp/nlbw.calls

echo
echo "===== 阶段 1：只读 · 冷缓存 ====="
S0=$(date +%s)
ucode /tmp/test.uc || FAIL=1
S1=$(date +%s)
CALLS1=$(wc -l < /tmp/nlbw.calls)
echo "耗时 $((S1 - S0))s / nlbw 调用 $CALLS1 次"

: > /tmp/nlbw.calls
echo
echo "===== 阶段 2：只读 · 热缓存 ====="
S2=$(date +%s)
FL_PHASE=read ucode /tmp/test.uc > /tmp/phase2.log 2>&1 || { FAIL=1; tail -20 /tmp/phase2.log; }
S3=$(date +%s)
CALLS2=$(wc -l < /tmp/nlbw.calls)
echo "耗时 $((S3 - S2))s / nlbw 调用 $CALLS2 次"
tail -2 /tmp/phase2.log

# 失败的 nlbw 查询按设计不写缓存（避免污染），
# 所以 layer7 回退模式下热跑仍会重复 7 次失败的 mac,layer7，阈值放宽到 20。
if [ "$CALLS1" -ge 80 ] && [ "$CALLS2" -lt 20 ] && [ "$CALLS2" -lt $((CALLS1 / 3)) ]; then
	echo "PASS 历史账期缓存生效：冷 $CALLS1 次 -> 热 $CALLS2 次"
else
	echo "FAIL 缓存未达预期：冷 $CALLS1 次 -> 热 $CALLS2 次"
	FAIL=1
fi

echo
echo "===== 阶段 3：写操作 ====="
reset_dbfiles
FL_PHASE=write ucode /tmp/test.uc || FAIL=1

echo
echo "===== 缓存文件 ====="
echo "共 $(ls /tmp/wrtbwstat-cache 2>/dev/null | wc -l) 个"

echo
if [ -n "$FAIL" ]; then echo "### 结果：存在失败项"; exit 1; fi
echo "### 结果：全部通过"
