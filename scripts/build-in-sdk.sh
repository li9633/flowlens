#!/bin/sh
# 在 OpenWrt SDK 里构建 FlowLens 的两个包，自动适配 ipk / apk
#
# 用法：
#   sh scripts/build-in-sdk.sh /path/to/openwrt-sdk
#   SDK_ROOT=/path/to/openwrt-sdk sh scripts/build-in-sdk.sh
#
# 同一份 Makefile 在 SDK 里出什么格式，取决于该 SDK 的 CONFIG_USE_APK：
#   25.12+ / main（=y）        -> bin/packages/*/flowlens/*.apk
#   24.10 / iStoreOS 对应分支  -> bin/packages/*/flowlens/*.ipk
#
# 脚本不修改仓库内容，只往 SDK 的 package/flowlens/ 复制一份源码。
set -e

SRC=$(cd "$(dirname "$0")/.." && pwd)
SDK=${1:-$SDK_ROOT}

if [ -z "$SDK" ]; then
	echo "用法: $0 /path/to/openwrt-sdk" >&2
	exit 1
fi

if [ ! -f "$SDK/rules.mk" ]; then
	echo "错误: $SDK 不是 OpenWrt SDK 根目录（缺 rules.mk）" >&2
	exit 1
fi

if [ ! -f "$SDK/feeds/luci/luci.mk" ]; then
	echo "错误: 缺少 $SDK/feeds/luci/luci.mk" >&2
	echo "请先在该 SDK 里执行：" >&2
	echo "  ./scripts/feeds update luci && ./scripts/feeds install -a -p luci" >&2
	exit 1
fi

echo "== 源码: $SRC"
echo "== SDK : $SDK"

if grep -q '^CONFIG_USE_APK=y' "$SDK/.config" 2>/dev/null; then
	echo "== 目标格式: apk（CONFIG_USE_APK=y）"
	FORMAT=apk
else
	echo "== 目标格式: ipk（未启用 CONFIG_USE_APK）"
	FORMAT=ipk
fi

echo "== 复制包源码到 SDK"
DEST="$SDK/package/flowlens"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -a "$SRC/packages/wrtbwstat" "$DEST/"
cp -a "$SRC/packages/luci-app-wrtbwstat" "$DEST/"

echo "== 生成 .config"
cd "$SDK"
make defconfig >/dev/null

echo "== 编译 wrtbwstat"
make package/flowlens/wrtbwstat/compile V=s

echo "== 编译 luci-app-wrtbwstat"
make package/flowlens/luci-app-wrtbwstat/compile V=s

echo
echo "== 产物"
FOUND=$(find "$SDK/bin/packages" -type f \( -name "wrtbwstat*.$FORMAT" -o -name "luci-app-wrtbwstat*.$FORMAT" \) 2>/dev/null || true)

if [ -z "$FOUND" ]; then
	echo "未找到 .$FORMAT 产物，请检查上面的编译输出" >&2
	exit 1
fi

echo "$FOUND" | while read -r f; do
	printf '%8s  %s\n' "$(du -h "$f" | cut -f1)" "$f"
done
