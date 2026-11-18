# SPDX-License-Identifier: Apache-2.0
#
# wrtbwstat —— FlowLens 数据面配置包
#
# 职责：把 nlbwmon 调整为"按日账期 + 持久化目录 + 95 代保留"的采集基线，
# 并确保 conntrack accounting 开启。本包不含任何界面与 rpcd 接口。
# 依据：doc/OpenWrt流量统计插件设计文档_v2.md 第 4.3、5.3 节
#
# 打包格式：同一份 Makefile 双轨出包，由构建系统决定
#   OpenWrt 25.12+（CONFIG_USE_APK=y） -> .apk（主推）
#   OpenWrt 24.10 / iStoreOS           -> .ipk（维护至 24.10 EOL）
# 本包为纯配置包（PKGARCH:=all），两条线的产物内容一致。

include $(TOPDIR)/rules.mk

PKG_NAME:=wrtbwstat
PKG_VERSION:=0.1.0
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=FlowLens

include $(INCLUDE_DIR)/package.mk

define Package/wrtbwstat
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Traffic Control
  TITLE:=FlowLens data source (nlbwmon daily-bucket baseline)
  URL:=https://example.invalid/flowlens
  DEPENDS:=+nlbwmon +rpcd-mod-ucode
  PKGARCH:=all
endef

define Package/wrtbwstat/description
  FlowLens 的数据面配置包。将 nlbwmon 配置为按自然日分账期、
  95 代保留、数据库目录持久化，并开启 nf_conntrack_acct。
  不创建任何 iptables / nftables 规则。
endef

define Package/wrtbwstat/conffiles
/etc/config/wrtbwstat
endef

define Build/Compile
endef

define Package/wrtbwstat/install
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./root/etc/uci-defaults/80_wrtbwstat $(1)/etc/uci-defaults/80_wrtbwstat

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/wrtbwstat $(1)/etc/config/wrtbwstat

	$(INSTALL_DIR) $(1)/etc/sysctl.d
	$(INSTALL_DATA) ./root/etc/sysctl.d/99-wrtbwstat.conf $(1)/etc/sysctl.d/99-wrtbwstat.conf
endef

$(eval $(call BuildPackage,wrtbwstat))
