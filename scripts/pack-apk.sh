#!/bin/sh
# 用 apk-tools 3 的 `apk mkpkg` 生成 FlowLens 两个包的 .apk（v3 / ADB 格式）
#
# 正常路径是用 OpenWrt 25.12+ SDK 出包（见 scripts/build-in-sdk.sh）。但 SDK 里
# luci.mk 会强制 host 编译 luci-base（需要 ucode/module.h，裸 SDK 没有），而出
# .apk 只需要一个带 `mkpkg` 的 apk-tools 3。本仓库两个包都是 PKGARCH:=all 的
# 纯文件包，因此可以在任意装有 apk-tools 3 的 Linux 环境（Alpine 即可）出包：
#
#   apk mkpkg -o out.apk -I name:x ... -F <数据根目录>
#
# 按 OpenWrt 的布局补齐 lib/apk/packages/<包名>.list|.conffiles|.conffiles_static，
# 使 conffiles 语义与官方 apk 一致。
#
# 产物未签名，安装时用 `apk add --allow-untrusted ./x.apk`。
#
# 用法：sh scripts/pack-apk.sh [输出目录，默认 dist]
set -e

ROOT=$(cd "$(dirname "$0")/.." && pwd)
VERSION=0.1.0
REL=r1
OUT=${1:-$ROOT/dist}
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if ! command -v apk >/dev/null 2>&1; then
	echo "错误: 需要 apk-tools 3（提供 apk mkpkg）。Alpine 自带；Ubuntu/Debian 没有，请用 alpine:latest 执行本脚本。" >&2
	exit 1
fi
if ! apk mkpkg --help 2>&1 | grep -q 'Mkpkg options'; then
	echo "错误: 当前 apk 版本没有 mkpkg（需要 apk-tools 3.x）" >&2
	exit 1
fi

mkdir -p "$OUT"

put() { # put <目录根> <包内路径> <源文件> <权限>
	mkdir -p "$1/$(dirname "$2")"
	cp "$3" "$1/$2"
	chmod "$4" "$1/$2"
}

# gen_apkmeta <数据根> <包名> [conffile...]
gen_apkmeta() {
	data=$1
	name=$2
	shift 2
	meta=$data/lib/apk/packages
	mkdir -p "$meta"
	(
		cd "$data"
		find . \( -type f -o -type l \) ! -path './lib/apk/packages/*' |
			sed 's|^\.||' | sort
	) > "$meta/$name.list"
	: > "$meta/$name.conffiles"
	: > "$meta/$name.conffiles_static"
	for f in "$@"; do
		echo "$f" >> "$meta/$name.conffiles"
		echo "$f $(sha256sum "$data$f" | cut -d' ' -f1)" >> "$meta/$name.conffiles_static"
	done
	chmod 0644 "$meta/$name.list" "$meta/$name.conffiles" "$meta/$name.conffiles_static"
}

# ── wrtbwstat：数据面配置包 ────────────────────────────────────────────────
S=$ROOT/packages/wrtbwstat/root
D=$WORK/wrtbwstat/data
mkdir -p "$D"
put "$D" etc/uci-defaults/80_wrtbwstat "$S/etc/uci-defaults/80_wrtbwstat" 0755
put "$D" etc/config/wrtbwstat "$S/etc/config/wrtbwstat" 0600
put "$D" etc/sysctl.d/99-wrtbwstat.conf "$S/etc/sysctl.d/99-wrtbwstat.conf" 0644
gen_apkmeta "$D" wrtbwstat /etc/config/wrtbwstat

apk mkpkg -o "$OUT/wrtbwstat-$VERSION-$REL.apk" \
	-I name:wrtbwstat -I "version:$VERSION-$REL" -I arch:noarch \
	-I "description:FlowLens data source (nlbwmon daily-bucket baseline)" \
	-I license:Apache-2.0 -I url:https://example.invalid/flowlens \
	-I maintainer:FlowLens -I origin:wrtbwstat \
	-I "depends:libc nlbwmon rpcd-mod-ucode" \
	-F "$D"
echo "产物: $OUT/wrtbwstat-$VERSION-$REL.apk"

# ── luci-app-wrtbwstat：应用包 ─────────────────────────────────────────────
S=$ROOT/packages/luci-app-wrtbwstat
D=$WORK/luci-app-wrtbwstat/data
mkdir -p "$D"
put "$D" www/luci-static/resources/wrtbwstat/app.js "$S/htdocs/luci-static/resources/wrtbwstat/app.js" 0644
put "$D" www/luci-static/resources/wrtbwstat/app.css "$S/htdocs/luci-static/resources/wrtbwstat/app.css" 0644
put "$D" www/luci-static/resources/view/wrtbwstat/overview.js "$S/htdocs/luci-static/resources/view/wrtbwstat/overview.js" 0644
put "$D" usr/share/rpcd/ucode/luci.wrtbwstat "$S/root/usr/share/rpcd/ucode/luci.wrtbwstat" 0755
put "$D" usr/share/rpcd/acl.d/luci-app-wrtbwstat.json "$S/root/usr/share/rpcd/acl.d/luci-app-wrtbwstat.json" 0644
put "$D" usr/share/luci/menu.d/luci-app-wrtbwstat.json "$S/root/usr/share/luci/menu.d/luci-app-wrtbwstat.json" 0644

# po -> lmo；没有 po2lmo 时跳过（view 内置中文词典兜底，不会中英混排）
PO2LMO=${PO2LMO:-po2lmo}
if command -v "$PO2LMO" >/dev/null 2>&1; then
	for po in "$S"/po/*/*.po; do
		[ -f "$po" ] || continue
		lang=$(basename "$(dirname "$po")")
		dom=$(basename "$po" .po)
		"$PO2LMO" "$po" "$WORK/$dom.$lang.lmo"
		put "$D" "usr/lib/lua/luci/i18n/$dom.$lang.lmo" "$WORK/$dom.$lang.lmo" 0644
		case "$lang" in
			zh_Hans) extra=zh-cn ;;
			zh_Hant) extra=zh-tw ;;
			*) extra="" ;;
		esac
		[ -n "$extra" ] && put "$D" "usr/lib/lua/luci/i18n/$dom.$extra.lmo" "$WORK/$dom.$lang.lmo" 0644
	done
else
	echo "警告: 未找到 po2lmo（可设 PO2LMO=/path/to/po2lmo），本次不打包翻译" >&2
fi

# postinst / postrm 与 luci.mk 一致：清索引缓存并 reload rpcd。
# 少了 reload，安装后 ubus 里没有对象；卸载后对象会一直留到下次重启。
for s in post-install post-deinstall; do
	cat > "$WORK/$s" <<'EOF'
#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload 2>/dev/null
	exit 0
}
EOF
	chmod 0755 "$WORK/$s"
done
gen_apkmeta "$D" luci-app-wrtbwstat

apk mkpkg -o "$OUT/luci-app-wrtbwstat-$VERSION-$REL.apk" \
	-I name:luci-app-wrtbwstat -I "version:$VERSION-$REL" -I arch:noarch \
	-I "description:LuCI app for FlowLens per-device traffic statistics" \
	-I license:Apache-2.0 -I url:https://example.invalid/flowlens \
	-I maintainer:FlowLens -I origin:luci-app-wrtbwstat \
	-I "depends:libc luci-base wrtbwstat" \
	-s "post-install:$WORK/post-install" \
	-s "post-deinstall:$WORK/post-deinstall" \
	-F "$D"
echo "产物: $OUT/luci-app-wrtbwstat-$VERSION-$REL.apk"
