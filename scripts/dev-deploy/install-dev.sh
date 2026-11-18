#!/bin/sh
# FlowLens 开发版部署脚本（联调用，不是正式安装包）
#
# 在路由器上执行：
#   cd /tmp && sh install-dev.sh
#
# 做四件事：装 nlbwmon（若缺）→ 铺文件 → 应用采集基线 → 重启 rpcd 并冒烟测试。
# 卸载用同目录的 uninstall-dev.sh。
set -e

SRC=$(cd "$(dirname "$0")" && pwd)/stage

say() { printf '\n=== %s ===\n' "$1"; }

say "1/5 环境检查"
if ! command -v nlbw >/dev/null 2>&1; then
	echo "nlbwmon 未安装，尝试安装 ..."
	if command -v apk >/dev/null 2>&1; then
		apk update >/dev/null 2>&1 || true
		apk add nlbwmon
	elif command -v opkg >/dev/null 2>&1; then
		opkg update >/dev/null 2>&1 || true
		opkg install nlbwmon
	else
		echo "找不到 apk / opkg，请手动安装 nlbwmon 后重跑"; exit 1
	fi
fi

command -v nlbw >/dev/null 2>&1 || { echo "nlbw 仍不可用，退出"; exit 1; }
echo "nlbw: $(command -v nlbw)"
echo "ucode: $(command -v ucode)"

say "2/5 部署文件"
# 注意：OpenWrt 基础系统没有 install 命令（busybox 未编译该 applet），
# 只能用 mkdir -p + cp + chmod。
put() { # put <源> <目标> <权限>
	mkdir -p "$(dirname "$2")"
	cp -f "$1" "$2"
	chmod "$3" "$2"
}

put "$SRC/usr/share/rpcd/ucode/luci.wrtbwstat"                      /usr/share/rpcd/ucode/luci.wrtbwstat 0755
put "$SRC/usr/share/rpcd/acl.d/luci-app-wrtbwstat.json"             /usr/share/rpcd/acl.d/luci-app-wrtbwstat.json 0644
put "$SRC/usr/share/luci/menu.d/luci-app-wrtbwstat.json"            /usr/share/luci/menu.d/luci-app-wrtbwstat.json 0644
put "$SRC/www/luci-static/resources/view/wrtbwstat/overview.js"      /www/luci-static/resources/view/wrtbwstat/overview.js 0644
put "$SRC/www/luci-static/resources/wrtbwstat/app.js"                /www/luci-static/resources/wrtbwstat/app.js 0644
put "$SRC/www/luci-static/resources/wrtbwstat/app.css"               /www/luci-static/resources/wrtbwstat/app.css 0644
put "$SRC/etc/sysctl.d/99-wrtbwstat.conf"                            /etc/sysctl.d/99-wrtbwstat.conf 0644
put "$SRC/etc/uci-defaults/80_wrtbwstat"                             /etc/uci-defaults/80_wrtbwstat 0755

# 已存在的配置不覆盖，避免把用户改过的存储目录抹掉
if [ -f /etc/config/wrtbwstat ]; then
	echo "/etc/config/wrtbwstat 已存在，保留"
else
	put "$SRC/etc/config/wrtbwstat" /etc/config/wrtbwstat 0600
fi

say "3/5 应用 nlbwmon 采集基线"
/etc/uci-defaults/80_wrtbwstat || echo "(脚本返回非 0，继续)"

say "4/5 重启 rpcd"
if [ -x /etc/init.d/rpcd ]; then
	/etc/init.d/rpcd restart
	sleep 2
else
	echo "(未找到 /etc/init.d/rpcd，跳过)"
fi

say "5/5 冒烟测试"
if ! ubus list 2>/dev/null | grep -qx 'luci.wrtbwstat'; then
	echo "FAIL: ubus 对象 luci.wrtbwstat 未注册"
	echo "排查：/usr/share/rpcd/ucode/luci.wrtbwstat 权限应为 0755，rpcd-mod-ucode 是否安装"
	exit 1
fi
echo "OK: ubus 对象已注册"

echo
echo "--- nlbw 实际列名（这段最重要，请整段贴回来）---"
nlbw -c json -n -g mac -o -rx_bytes 2>&1 | head -c 500; echo
echo "--- -g mac,layer7 是否可用 ---"
nlbw -c json -n -g mac,layer7 -o -rx_bytes 2>&1 | head -c 300; echo

echo
echo "--- get_settings ---"
ubus call luci.wrtbwstat get_settings 2>&1 | head -40

echo
echo "--- get_summary(today) ---"
ubus call luci.wrtbwstat get_summary '{"range":"today"}' 2>&1 | head -30

echo
echo "--- get_devices(last7) ---"
ubus call luci.wrtbwstat get_devices '{"range":"last7","sort":"total","keyword":""}' 2>&1 | head -30

echo
echo "部署完成。浏览器打开 LuCI → 网络 → FlowLens 查看页面。"
