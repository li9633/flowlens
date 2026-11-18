# SPDX-License-Identifier: Apache-2.0
#
# luci-app-wrtbwstat —— FlowLens 的 LuCI 应用包
#
# 包含：LuCI 菜单 / ACL 注册、薄壳 view、Vue 3 预编译产物、ucode rpcd 后端。
# 依据：doc/OpenWrt流量统计插件设计文档_v2.md 第 5.3 节
#
# ── 打包格式 ────────────────────────────────────────────────────────────────
# 同一份 Makefile 同时产出两种包，由构建系统的 CONFIG_USE_APK 决定：
#   OpenWrt 25.12+ / main（CONFIG_USE_APK=y） -> .apk（主推）
#   OpenWrt 24.10 / iStoreOS 对应分支          -> .ipk（维护至 24.10 EOL）
# 本文件不含任何版本分支，两条线共用。
#
# ── 注意 ────────────────────────────────────────────────────────────────────
#   1. frontend/ 仅为源码目录，luci.mk 只安装 htdocs/ 与 root/，
#      因此 .vue 源文件与 node_modules 不会进入安装包。
#   2. 前端产物 app.js / app.css 由开发环境 `npm run build` 预编译后提交，
#      构建机（SDK）不执行 npm。
#   3. 24.10 的 LuCI 客户端同样是浏览器 JS（require rpc / poll / view），
#      薄壳 view 无需为 ipk 线另写一份。

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI app for FlowLens per-device traffic statistics
LUCI_DESCRIPTION:=Per-device daily traffic accounting on top of nlbwmon, with Vue 3 frontend
LUCI_DEPENDS:=+luci-base +wrtbwstat
LUCI_PKGARCH:=all
LUCI_LICENSE:=Apache-2.0

# luci.mk 位于 luci feed 根目录。允许用 LUCI_MK=... 覆盖，
# 便于 SDK 的 feed 布局不同时免改文件。
LUCI_MK ?= $(TOPDIR)/feeds/luci/luci.mk

ifeq ($(wildcard $(LUCI_MK)),)
$(error 找不到 $(LUCI_MK)，请先执行 ./scripts/feeds update luci && ./scripts/feeds install -a -p luci)
endif

include $(LUCI_MK)

$(eval $(call BuildPackage,luci-app-wrtbwstat))
