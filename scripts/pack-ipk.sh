#!/bin/sh
# 手工构建 luci-app-wrtbwstat 的 ipk（网络受限时的备用通道）
#
# 正常路径是用 OpenWrt SDK / 完整 buildroot 出包（见 README「打包」一节）。
# 但在 sources.openwrt.org 只有几 KB/s 的网络下，完整 buildroot 需要拖 gcc、
# binutils 等上百 MB 源码，实际跑不完；而本包是纯文件包（PKGARCH:=all），
# luci.mk 的工作也只是把 htdocs/ 与 root/ 拷进包、写 control、加 postinst。
#
# 本脚本按同样的布局与元数据生成 ipk，已在 iStoreOS 24.10.8 上用
# opkg install / remove 实测通过。切换到时序正常的环境后，请优先用 SDK 出包。
#
# 用法：sh scripts/pack-ipk.sh [输出目录，默认 dist]
set -e

ROOT=$(cd "$(dirname "$0")/.." && pwd)
NAME=luci-app-wrtbwstat
VERSION=0.1.0
REL=r1
ARCH=all
OUT=${1:-$ROOT/dist}

SRC=$ROOT/packages/$NAME
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
D=$WORK/data
C=$WORK/control

mkdir -p "$OUT" "$C"

put() { # put <源> <目标相对路径> <权限>
	mkdir -p "$(dirname "$D/$2")"
	cp "$1" "$D/$2"
	chmod "$3" "$D/$2"
}

put "$SRC/htdocs/luci-static/resources/wrtbwstat/app.js"           www/luci-static/resources/wrtbwstat/app.js 0644
put "$SRC/htdocs/luci-static/resources/wrtbwstat/app.css"          www/luci-static/resources/wrtbwstat/app.css 0644
put "$SRC/htdocs/luci-static/resources/view/wrtbwstat/overview.js" www/luci-static/resources/view/wrtbwstat/overview.js 0644
put "$SRC/root/usr/share/rpcd/ucode/luci.wrtbwstat"                usr/share/rpcd/ucode/luci.wrtbwstat 0755
put "$SRC/root/usr/share/rpcd/acl.d/luci-app-wrtbwstat.json"       usr/share/rpcd/acl.d/luci-app-wrtbwstat.json 0644
put "$SRC/root/usr/share/luci/menu.d/luci-app-wrtbwstat.json"      usr/share/luci/menu.d/luci-app-wrtbwstat.json 0644

# 翻译：po -> lmo（与 luci.mk 做的事一致）。luci.mk 会把翻译单独打成
# luci-i18n-* 包，这里直接并进主包，减少一次安装步骤。
PO2LMO=${PO2LMO:-po2lmo}
if command -v "$PO2LMO" >/dev/null 2>&1; then
	for po in "$SRC"/po/*/*.po; do
		[ -f "$po" ] || continue
		lang=$(basename "$(dirname "$po")")
		dom=$(basename "$po" .po)
		# iStoreOS/旧版 LuCI 用 zh-cn，上游用 zh_Hans，两个名字都装一份
		case "$lang" in
			zh_Hans|zh_Hant) extra=$(echo "$lang" | sed 's/zh_Hans/zh-cn/; s/zh_Hant/zh-tw/') ;;
			*) extra="" ;;
		esac
		"$PO2LMO" "$po" "$WORK/$dom.$lang.lmo"
		put "$WORK/$dom.$lang.lmo" "usr/lib/lua/luci/i18n/$dom.$lang.lmo" 0644
		if [ -n "$extra" ]; then
			put "$WORK/$dom.$lang.lmo" "usr/lib/lua/luci/i18n/$dom.$extra.lmo" 0644
		fi
	done
else
	echo "警告: 未找到 po2lmo（可设 PO2LMO=/path/to/po2lmo），本次不打包翻译" >&2
fi

SIZE=$(du -sk "$D" | cut -f1)

cat > "$C/control" <<EOF
Package: $NAME
Version: $VERSION-$REL
Depends: libc, luci-base, wrtbwstat
Source: flowlens/$NAME
SourceName: $NAME
License: Apache-2.0
Section: luci
SourceDateEpoch: $(date +%s)
Maintainer: FlowLens
Architecture: $ARCH
Installed-Size: $SIZE
Description: LuCI app for FlowLens per-device traffic statistics
 Vue 3 frontend (precompiled) plus ucode rpcd backend for per-device daily
 traffic accounting on top of nlbwmon.
EOF

# 必须与 luci.mk 生成的 postinst 一致：清索引缓存并 reload rpcd。
# 少了 reload，新装的 rpcd ucode 脚本不会被加载，ubus 里看不到 luci.wrtbwstat，
# 页面会一直空白（这个坑是实际装机时踩到的）。
cat > "$C/postinst" <<'EOF'
#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload 2>/dev/null
	exit 0
}
EOF
chmod 755 "$C/postinst"

printf '2.0\n' > "$WORK/debian-binary"

( cd "$D" && tar --owner=0 --group=0 --numeric-owner -czf "$WORK/data.tar.gz" ./ )
( cd "$C" && tar --owner=0 --group=0 --numeric-owner -czf "$WORK/control.tar.gz" ./control ./postinst )

PKG="$OUT/${NAME}_${VERSION}-${REL}_${ARCH}.ipk"
( cd "$WORK" && tar --owner=0 --group=0 --numeric-owner -czf "$PKG" ./debian-binary ./control.tar.gz ./data.tar.gz )

echo "产物: $PKG"
