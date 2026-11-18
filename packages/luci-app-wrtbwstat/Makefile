# SPDX-License-Identifier: Apache-2.0
#
# luci-app-wrtbwstat —— FlowLens 的 LuCI 应用包
#
# 包含：LuCI 菜单 / ACL 注册、薄壳 view、Vue 3 预编译产物、ucode rpcd 后端。
# 依据：doc/OpenWrt流量统计插件设计文档_v2.md 第 5.3 节
#
# 注意：
#   1. frontend/ 仅为源码目录，luci.mk 只安装 htdocs/ 与 root/，
#      因此 .vue 源文件与 node_modules 不会进入 apk。
#   2. 前端产物 app.js / app.css 由开发环境 `npm run build` 生成后提交，
#      构建机（SDK）不执行 npm。

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI app for FlowLens per-device traffic statistics
LUCI_DESCRIPTION:=Per-device daily traffic accounting on top of nlbwmon, with Vue 3 frontend
LUCI_DEPENDS:=+wrtbwstat
LUCI_PKGARCH:=all
LUCI_LICENSE:=Apache-2.0

# luci.mk 位于 luci feed 根目录；按实际 feed 布局调整此行。
include $(TOPDIR)/feeds/luci/luci.mk

$(eval $(call BuildPackage,luci-app-wrtbwstat))
