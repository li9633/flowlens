#!/bin/sh
# 卸载 FlowLens 开发版部署（只删本脚本铺的文件，不动 nlbwmon 与既有配置）
set -e

echo "移除文件 ..."
rm -f /usr/share/rpcd/ucode/luci.wrtbwstat
rm -f /usr/share/rpcd/acl.d/luci-app-wrtbwstat.json
rm -f /usr/share/luci/menu.d/luci-app-wrtbwstat.json
rm -f /www/luci-static/resources/view/wrtbwstat/overview.js
rm -rf /www/luci-static/resources/wrtbwstat
rmdir /www/luci-static/resources/view/wrtbwstat 2>/dev/null || true
rm -f /etc/uci-defaults/80_wrtbwstat
rm -f /etc/sysctl.d/99-wrtbwstat.conf

echo "保留 /etc/config/wrtbwstat（如需删除请手动 rm）"
echo "重启 rpcd ..."
/etc/init.d/rpcd restart
echo "完成"
