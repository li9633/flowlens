# OpenWrt / iStoreOS 按设备流量统计插件设计文档 v1

| 项目 | 内容 |
| --- | --- |
| 版本 | v1（草案） |
| 日期 | 2026-11-18 |
| 修订 | 2026-11-18：技术基线改为 firewall4 / nftables 优先，移除旧 iptables 兼容目标 |
| 目标系统 | OpenWrt 25.12 / main 及 iStoreOS 对应分支 |
| 交付物形态 | LuCI 应用 + 采集配置，主交付 apk |

## 1. 背景与目标

用户现有 iStoreOS 的 `网络 → Traffic Status → Details` 页面（路径 `/cgi-bin/luci/admin/network/usage/details`）来自 `luci-app-wrtbwmon`。该插件的前端是 LuCI 原生 JS，后端是 shell + `jshn.sh` 的 rpcd 脚本，采集端用 `iptables -t mangle` 建 `RRDIPT_*` 链并读后清零计数器，再由 `readDB.awk` 聚合，数据以 CSV 形式存于 `/tmp/usage.db`。

需要澄清的是：OpenWrt 自 22.03 起默认使用 firewall4（nftables），`iptables` 命令默认已是 `iptables-nft` 兼容层，legacy 版本被改名为 `iptables-zz-legacy`。因此 wrtbwmon 的落后之处主要不是"内核还在跑 iptables"，而是它的 mangle 计数器模型、shell/awk 聚合、CSV 累计存储与 shell 版 rpcd 后端。

它只能回答"累计用了多少"，无法回答"昨天用了多少、近 7 天每台设备各用了多少"，且数据库位于 `/tmp`，重启即失效。上游 README 也明确标注不兼容 flow offloading 与 Routing/NAT。

本项目的目标是提供一个可长期运行、按设备维度、支持多时间窗的流量统计插件。

### 1.1 目标

- 在 LuCI 中提供总览与设备明细两个视图。
- 支持今日、昨日、近 7 天、近 30 天、近 90 天五个时间窗。
- 每台设备展示上行、下行、合计与占比，并可按 MAC / 设备名识别。
- 数据重启不丢失，默认保留不少于 90 个自然日。
- 以 2026 年主线技术栈为唯一基线：firewall4 / nftables、apk、ucode，不为旧系统回退。

### 1.2 技术基线（v1 强制约束）

| 维度 | 选定 | 说明 |
| --- | --- | --- |
| 固件 | OpenWrt 25.12+ / main，iStoreOS 对应分支 | 24.10 已接近 EOL，不作为目标 |
| 防火墙 | firewall4 / nftables | 不创建 iptables 兼容层规则，不依赖 mangle 链 |
| 包管理 | apk | 主交付 `.apk` |
| 后端 | ucode + rpcd（`rpcd-mod-ucode`） | 不使用 shell + `jshn.sh` 旧写法 |
| 前端 | LuCI 客户端 JS view | 沿用新 LuCI 的 `rpc.declare` / `E()` 范式 |
| 采集 | conntrack netlink（nlbwmon） | 位于规则层之下，不新增 nftables 计数规则 |

### 1.3 非目标

- 不适配 OpenWrt 24.10 及更早的 opkg / ipk / firewall3 / Lua 版 LuCI 组合；如确有需求另立兼容分支。
- 不做流量限速、黑名单、上网行为管控。
- 不做域名、URL、应用内容识别与审计。
- 不承诺在开启流量卸载时的数据完整性（缓解措施见第 6 节）。
- 不替代 vnStat 的接口级总量统计，二者可并存。

## 2. 需求定义

### 2.1 功能需求

| 编号 | 需求 | 优先级 |
| --- | --- | --- |
| FR-01 | 总览页展示五个时间窗的上下行汇总与趋势条 | P0 |
| FR-02 | 设备列表展示每台设备在各时间窗的用量，支持排序与搜索 | P0 |
| FR-03 | 设备详情页展示单台设备的日序列与协议分布 | P1 |
| FR-04 | 设备名解析：优先自定义别名，其次 DHCP 租约 hostname，最后回退 MAC | P0 |
| FR-05 | 支持 IPv4 与 IPv6，按 MAC 归并同一物理设备 | P1 |
| FR-06 | 支持手动清空数据库与切换存储目录 | P2 |
| FR-07 | 自动刷新间隔可配置（关闭 / 10s / 30s / 60s） | P2 |

### 2.2 时间窗定义

以路由器本地时区的自然日为边界，依赖 NTP 校时：

- 今日：当日 00:00 至当前时刻。
- 昨日：前一自然日 00:00 至 24:00。
- 近 7 天：今日及此前 6 个自然日，共 7 日。
- 近 30 天：今日及此前 29 个自然日，共 30 日。
- 近 90 天：今日及此前 89 个自然日，共 90 日。

跨天边界以 `date` 系统时间为准；时区变更或 NTP 大幅校时会造成当日数据漂移，需在运行说明中提示。

### 2.3 非功能需求

| 类别 | 要求 |
| --- | --- |
| 资源占用 | 常驻内存与 CPU 占用低于同设备运行 `luci-app-statistics` 的量级 |
| 持久化 | 数据库目录可指向 USB 挂载点，避免写入闪存 |
| 保留期 | 默认保留 95 个日账期，覆盖 90 天查询窗口 |
| 权限 | 通过 rpcd ACL 显式授权，不依赖 `luci-compat` 的宽松授权 |
| 兼容性 | OpenWrt 25.12+（firewall4 + apk），x86_64 / aarch64 优先 |

## 3. 现状与技术选型

### 3.1 现有 wrtbwmon 插件技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | LuCI 原生 JS view（`rpc.declare`、`poll`、`fs.exec_direct`、`E()`），CSS 进度条，无前端框架与图表库 |
| 通信 | ubus + rpcd，菜单 `menu.d/*.json`，权限 `acl.d/*.json`，复用 `luci-rpc` 的 DHCP / DSL 接口 |
| 后端 | `/usr/libexec/rpcd/luci.wrtbwmon`，POSIX shell + `jshn.sh` 手工拼 JSON |
| 采集 | `/usr/sbin/wrtbwmon`（shell）+ `readDB.awk`；`iptables -t mangle` 建 `RRDIPT_*` 链，读后清零，读取 `/proc/net/arp` |
| 存储 | `/tmp/usage.db`（及 `.6`、`.46`），CSV，表头为 mac/ip/iface/speed_in/speed_out/in/out/total/first_date/last_date |
| 打包 | `luci.mk`，`LUCI_PKGARCH:=all`，`LUCI_DEPENDS:=+wrtbwmon`，上游发布 ipk |

### 3.2 不能直接复用的原因

数据模型是"累计量 + 首次/末次时间"，没有按日分桶；库文件在 `/tmp`，重启清零；依赖 mangle 计数器，与流量卸载冲突；后端是 shell + `jshn.sh`。因此前端交互可借鉴，采集、存储与后端实现必须替换。

### 3.3 采集方案对比

| 方案 | 设备维度 | 历史能力 | 流量卸载影响 | 结论 |
| --- | --- | --- | --- | --- |
| wrtbwmon（mangle 计数） | MAC | 仅累计 | 严重 | 不采用 |
| nftables 原生规则计数器 | 需逐 IP 规则 / 动态集合 | 仅内核内存，需自行导出 | 规则计数在卸载后失效 | 仅作总量校验备选 |
| vnStat | 无（仅接口） | 小时/日/月 | 较小 | 可作总量校验 |
| collectd + RRD | 需扩展 | 强 | 视插件而定 | 过重 |
| NetFlow/IPFIX | 强 | 依赖外部采集器 | 小 | 高精度备选 |
| conntrack netlink（nlbwmon） | MAC / IP | 按账期分库 | 可用 flowtable counter 缓解 | 采用 |

选用 nlbwmon 的理由：它经 nfnetlink 读取内核 conntrack 条目，处在 iptables / nftables 规则层**之下**，不新增任何防火墙规则，比"改成 nftables 计数器"更贴近数据源头；CPU 开销低，原生按账期分库，并支持 `nlbw -c json -n -t <date>` 读取指定日期。

nftables 的命名 counter 虽可在规则重建后保留，但计数只存在内核内存，重启即失，且逐设备计数需要维护大量规则或动态集合。因此 v1 不采用它做主采集。

## 4. 总体方案

### 4.1 架构分层

| 层 | 组件 | 职责 |
| --- | --- | --- |
| 展示层 | LuCI JS view `wrtbwstat/overview.js` | 时间窗切换、表格渲染、进度条、排序搜索 |
| 接口层 | ucode rpcd ubus 对象 `luci.wrtbwstat` | 聚合、查询、配置读写 |
| 采集层 | nlbwmon + conntrack netlink | 从内核 conntrack 读取每日流量，写入账期数据库 |
| 存储层 | 持久化目录 + 每日数据库 | 保留至少 95 个日账期 |
| 系统层 | UCI、procd、ACL、menu.d、firewall4 | 配置、进程托管、授权、菜单注册、nftables 规则集 |

本插件**不向 nftables 规则集写入任何规则**，也不调用 iptables / ip6tables。

### 4.2 数据流

1. 确保 conntrack accounting 已开启，nlbwmon 经 netlink 读取 conntrack 条目计数，按 MAC / IP / 协议累加并写入当前账期库。
2. 到日边界切换账期，压缩归档旧库，超过保留期删除最旧库。
3. 前端发起 ubus 调用，后端按时间窗枚举日期，逐个读取账期库并聚合。
4. 后端返回统一 JSON：时间窗汇总 + 设备数组 + 设备名映射。
5. 前端渲染表格与进度条，并按配置自动刷新。

### 4.3 采集配置基线

```sh
uci set nlbwmon.@nlbwmon[0].database_directory='/mnt/usb/nlbwmon'
uci set nlbwmon.@nlbwmon[0].database_interval='2026-01-01/1'
uci set nlbwmon.@nlbwmon[0].database_generations='95'
uci set nlbwmon.@nlbwmon[0].commit_interval='6h'
uci set nlbwmon.@nlbwmon[0].database_compress='1'
uci add_list nlbwmon.@nlbwmon[0].local_network='lan'
uci commit nlbwmon

sysctl -w net.netfilter.nf_conntrack_acct=1
echo 'net.netfilter.nf_conntrack_acct=1' > /etc/sysctl.d/99-wrtbwstat.conf
/etc/init.d/nlbwmon restart
```

`database_interval='2026-01-01/1'` 表示每 1 天开启一个账期；`database_generations=95` 提供 90 天查询窗口外的事故冗余。conntrack accounting 默认可能关闭，需显式开启；该参数仅对新建立的连接生效，部署后需重启相关服务或等待连接重建。

### 4.4 数据模型

后端对外暴露的记录以设备为粒度：

| 字段 | 说明 |
| --- | --- |
| mac | 设备唯一标识，小写冒号分隔 |
| hostname | 别名 / DHCP hostname / MAC 回退 |
| rx_bytes | 时间窗内下行字节数 |
| tx_bytes | 时间窗内上行字节数 |
| total_bytes | rx + tx |
| share | 占全网同期百分比 |
| first_seen / last_seen | 时间窗内有流量的首尾时间 |

## 5. 详细设计

### 5.1 后端接口

ubus 对象 `luci.wrtbwstat`：

| 方法 | 入参 | 返回 |
| --- | --- | --- |
| `get_summary` | `range` | 五个时间窗的上下行总量与趋势序列 |
| `get_devices` | `range`, `sort`, `keyword` | 设备数组与占比 |
| `get_device` | `mac`, `range` | 单设备日序列与协议分布 |
| `get_settings` | 无 | 当前配置 |
| `set_settings` | 配置对象 | 写入结果 |
| `reset_database` | 无 | 清空结果（危险操作，需二次确认） |

后端采用 ucode 实现，依赖 `rpcd-mod-ucode`，与 LuCI 25.12 主线一致；不使用 shell + `jshn.sh`。读取历史库通过 `nlbw -c json -n -t YYYY-MM-DD`，避免直接解析数据库文件。

### 5.2 前端视图

- 文件：`htdocs/luci-static/resources/view/wrtbwstat/overview.js`。
- 使用 `rpc.declare()` 声明上述方法，`poll.add()` 实现可关闭的自动刷新。
- 总览区：五个时间窗卡片 + 上下行进度条；设备区：可排序表格与搜索框。
- 不引入第三方图表库，趋势用 CSS 条形或内联 SVG 绘制。
- 设备名解析复用现有思路：自定义映射文件优先，DHCP 租约次之，MAC 回退。

### 5.3 包结构

```text
wrtbwstat/
├── Makefile                       # DEPENDS:=+nlbwmon +rpcd-mod-ucode
└── root/etc/uci-defaults/80_wrtbwstat

luci-app-wrtbwstat/
├── Makefile                       # include luci.mk
├── htdocs/luci-static/resources/view/wrtbwstat/overview.js
└── root/usr/share/
    ├── luci/menu.d/luci-app-wrtbwstat.json
    └── rpcd/acl.d/luci-app-wrtbwstat.json
```

后端 ucode 脚本放在 `root/usr/share/rpcd/ucode/luci.wrtbwstat`。

### 5.4 打包与版本

v1 只面向 OpenWrt 25.12 主线：`CONFIG_USE_APK=y`，由构建系统的 `apk mkpkg` 产出 `.apk`，通过 `apk -U add` 或 `apk --allow-untrusted add ./xxx.apk` 安装。不产出 ipk，不维护 24.10 分支。

无需编写 APKBUILD；那是 Alpine 原生 abuild 的格式。Alpine 源中的 apk 包因 ABI、内核与 feed 不同，不可直接安装到 OpenWrt。

## 6. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| fullcone 模块抢占 ctnetlink 事件通知 | 2026 年已报告：开启 `kmod-nft-fullcone` 时 conntrack 事件无法到达用户态，nlbwmon 数据库为空 | M0 阶段用 `conntrack -E` 验证事件；必要时调整模块加载顺序或应用上游补丁 |
| conntrack accounting 默认关闭 | 计数缺失或偏低 | 显式 `sysctl net.netfilter.nf_conntrack_acct=1` 并持久化；注意仅对新连接生效 |
| 软件/硬件流量卸载（flowtable） | 规则级 counter 在 offload 后不再更新 | 在 flowtable 上启用 `counter`，配合 conntrack accounting 把计数写回 conntrack 条目；仍不精确时提供关闭卸载的校验模式 |
| 默认存储在 tmpfs | 重启后历史清零 | 强制校验存储目录不在 `/tmp`；未配置持久化时页面给出告警 |
| 90 天数据体积 | 闪存写满或查询变慢 | 启用 `database_compress`；控制 `database_limit`；优先 USB 盘；上线前以一周实测外推 |
| IPv6 隐私地址 | 同一物理设备拆成多个身份 | 以 MAC 归并，展示时合并同 MAC 的多个 IPv6 地址 |
| `local_network` 漏配 | guest / IoT 网段无数据 | 默认加入 lan，并在配置页提示补充其他网段 |
| 时区与 NTP 异常 | "今日/昨日"边界漂移 | 依赖系统本地时间，页面显示当前时区与最后校时状态 |
| ACL 授权过宽 | 越权读写配置 | 仅授予自身 ubus 方法与 UCI 段，不依赖 `luci-compat` |
| 设备名解析失败 | 列表出现裸 MAC | 三级回退：自定义别名、DHCP hostname、MAC |
| 误引入 iptables 兼容层 | 与 firewall4 规则集冲突，计数口径混乱 | 插件不创建任何 mangle / filter 规则；验收时检查 `nft list ruleset` 无本插件规则 |

## 7. 实施计划

| 阶段 | 内容 | 产出 |
| --- | --- | --- |
| M0 | 安装 nlbwmon，配置日账期、持久化目录与 conntrack accounting；用 `conntrack -E` 与 `nlbw` 验证事件与计数；运行 7 天 | 可用的数据源、体积实测与 fullcone 冲突结论 |
| M1 | 实现 ucode 后端与 ACL / 菜单注册 | 可用 ubus 接口 |
| M2 | 实现 LuCI 总览与设备明细视图 | 可用前端页面 |
| M3 | 25.12 SDK 构建 apk，编写安装与排错说明 | 可分发安装包 |

## 8. 验收标准

1. 五个时间窗的总量与各设备明细之和一致，误差在协议开销允许的范围内。
2. 设备重启后，重启前 24 小时内的历史数据仍可查询。
3. 连续运行 30 天，数据库目录未写满，页面响应无明显退化。
4. 在 25.12 SDK 上构建出可安装的 apk；`nft list ruleset` 中不存在本插件新增的规则。
5. `conntrack -E` 有事件输出，nlbwmon 数据库持续产生记录。
6. 未授予 ACL 的用户无法调用写方法。

## 9. 待定问题

- 目标固件是否为 25.12+，以及是否启用 fullcone NAT（决定是否需要处理 ctnetlink 通知冲突）。
- 是否已有可用 USB 存储作为数据库目录，需现场确认。
- 是否开启 flow offloading，需在目标设备上核实并决定 flowtable counter 的落地方式。
- 是否允许通过 `/etc/sysctl.d/` 持久化开启 `nf_conntrack_acct`，需现场确认。
- 90 天历史的实际磁盘占用需在 M0 阶段实测后回填本文档。
