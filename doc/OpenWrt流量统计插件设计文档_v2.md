# OpenWrt / iStoreOS 按设备流量统计插件设计文档 v2

| 项目 | 内容 |
| --- | --- |
| 版本 | v2（修订版） |
| 项目名称 | FlowLens（工作区目录 `flowlens/`） |
| 日期 | 2026-11-18 |
| 修订说明 | 基于 v1 修订：前端由 LuCI 原生 JS view 改为 **Vue 3 + Vite + LuCI 薄壳**；补充 2026 年 LuCI 主线迁移事实、Vue 接入约束、构建链与体积预算。采集、后端、打包基线不变。 |
| 目标系统 | OpenWrt 25.12 / main 及 iStoreOS 对应分支 |
| 交付物形态 | LuCI 应用 + 采集配置，主交付 apk；前端预编译 bundle 随包分发 |
| 前序版本 | v1：`doc/OpenWrt流量统计插件设计文档_v1.md`（保留作为历史版本） |

## 1. 背景与目标

### 1.1 背景

用户现有 iStoreOS 的 `网络 → Traffic Status → Details` 页面（路径 `/cgi-bin/luci/admin/network/usage/details`）来自 `luci-app-wrtbwmon`。该插件的前端是 LuCI 原生 JS，后端是 shell + `jshn.sh` 的 rpcd 脚本，采集端用 `iptables -t mangle` 建 `RRDIPT_*` 链并读后清零计数器，再由 `readDB.awk` 聚合，数据以 CSV 形式存于 `/tmp/usage.db`。

需要澄清的是：OpenWrt 自 22.03 起默认使用 firewall4（nftables），`iptables` 命令默认已是 `iptables-nft` 兼容层，legacy 版本被改名为 `iptables-zz-legacy`。因此 wrtbwmon 的落后之处主要不是"内核还在跑 iptables"，而是它的 mangle 计数器模型、shell/awk 聚合、CSV 累计存储与 shell 版 rpcd 后端。

它只能回答"累计用了多少"，无法回答"昨天用了多少、近 7 天每台设备各用了多少"，且数据库位于 `/tmp`，重启即失效。上游 README 也明确标注不兼容 flow offloading 与 Routing/NAT。

本项目的目标是提供一个可长期运行、按设备维度、支持多时间窗的流量统计插件，并在前端采用现代化的 Vue 3 开发体验。

### 1.2 目标

- 在 LuCI 中提供总览与设备明细两个视图。
- 支持今日、昨日、近 7 天、近 30 天、近 90 天五个时间窗。
- 每台设备展示上行、下行、合计与占比，并可按 MAC / 设备名识别。
- 数据重启不丢失，默认保留不少于 90 个自然日。
- 前端使用 Vue 3 组件化开发；后端保持 ucode；不为旧系统回退。

### 1.3 技术基线（v2 强制约束）

| 维度 | 选定 | 说明 |
| --- | --- | --- |
| 固件 | OpenWrt 25.12+ / main，iStoreOS 对应分支 | 24.10 已停止安全更新，不作为目标 |
| 防火墙 | firewall4 / nftables | 不创建 iptables 兼容层规则，不依赖 mangle 链 |
| 包管理 | apk | 主交付 `.apk` |
| 后端 | ucode + rpcd（`rpcd-mod-ucode`） | 不使用 shell + `jshn.sh` 旧写法 |
| 前端框架 | Vue 3 + Vite | 以 LuCI view 为宿主挂载，不替换 LuCI |
| 前端与 LuCI 桥接 | `rpc.declare()` / `poll.add()` 注入 | Vue 不直接访问 CGI 或自行管理会话 |
| 采集 | conntrack netlink（nlbwmon） | 位于规则层之下，不新增 nftables 计数规则 |

### 1.4 v2 相对 v1 的变更摘要

| 变更项 | v1 | v2 |
| --- | --- | --- |
| 前端实现 | LuCI 原生 JS view，`E()` 直接构建 DOM | LuCI view 仅作薄壳，Vue 3 应用挂载到其中 |
| 前端构建 | 无独立构建，源码即产物 | Vite 预编译 SFC，产物提交进包，SDK 不跑 npm |
| 组件库 | 无 | 仍不引入；明确禁止 Element Plus 等重型库 |
| 会话与 RPC | view 内 `rpc.declare()` | view 内声明后注入 Vue，Vue 不碰会话 |
| i18n | LuCI `_()` 直接在模板/JS 中使用 | 由 view 以 `_()` 注入 Vue 文案，暂不引入 vue-i18n |
| 验收 | 原 6 条 | 增加前端挂载、体积预算、无 `unsafe-eval` 依赖等条目 |

### 1.5 非目标

- 不适配 OpenWrt 24.10 及更早的 opkg / ipk / firewall3 / Lua 版 LuCI 组合。
- 不用 Vue 替换 LuCI，不接管 LuCI 的菜单、登录与路由体系。
- 不引入 Element Plus、Ant Design Vue 等重型组件库。
- 不在 OpenWrt SDK / buildroot 内运行 npm 构建，产物在开发环境预编译后提交。
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
| FR-08 | 前端以 Vue 3 单文件组件实现，构建产物纳入 apk | P0 |

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
| 前端体积 | Vue runtime + 应用 JS/CSS 的 gzip 总量目标不超过 120 KB |
| 前端加载 | 不依赖 `unsafe-eval`，不依赖外部 CDN，同源静态资源 |

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

数据模型是"累计量 + 首次/末次时间"，没有按日分桶；库文件在 `/tmp`，重启清零；依赖 mangle 计数器，与流量卸载冲突；后端是 shell + `jshn.sh`。前端交互思路可借鉴，采集、存储与后端实现必须替换。

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

nftables 的命名 counter 虽可在规则重建后保留，但计数只存在内核内存，重启即失，且逐设备计数需要维护大量规则或动态集合。因此不采用它做主采集。

### 3.4 前端框架选型

2026 年 LuCI 主线的事实是：**服务端已转向 ucode，客户端仍是浏览器 JavaScript**。`luci-lua-runtime` 已退为按需兼容层，标准 LuCI 组件不再需要服务端 Lua；但前端并没有、也不太可能统一到某个框架。

| 方案 | 与 LuCI 的关系 | 体积 | 开发体验 | 结论 |
| --- | --- | --- | --- | --- |
| LuCI 原生 JS view | 一等公民 | 最小 | 手工 DOM，状态管理繁琐 | v1 方案，v2 不再采用 |
| Vue 3 薄壳挂载 | 作为单个 view 内的应用 | 约 100 KB min（runtime-only） | 组件化、响应式 | **采用** |
| React 薄壳挂载 | 同 Vue，但需额外 JSX 工具链 | 类似 | 类似 | 可选，非本次范围 |
| oui（Vue 3 + Lua-eco + lighttpd） | 替换 LuCI 的整套框架 | 大 | 完整但重 | 不采用，只做一个页面不划算 |
| Element Plus 等组件库 | 与 Vue 组合 | 增加数百 KB | 桌面后台观感 | 明确禁止 |

选择 Vue 3 的依据：社区已有 `luci-app-quickfile`（Rust 后端 + Vue 3 + Vite + Tailwind）等真实 OpenWrt 插件，证明 Vue 构建产物可直接放进 `luci-static` 并在 LuCI 中运行；同时 Vue 的响应式状态非常适合"时间窗切换 + 表格排序 + 自动刷新"这类交互。

## 4. 总体方案

### 4.1 架构分层

| 层 | 组件 | 职责 |
| --- | --- | --- |
| 展示层 | Vue 3 应用（`App.vue` + 组件） | 时间窗切换、表格渲染、进度条、排序搜索、响应式状态 |
| 宿主层 | LuCI view `wrtbwstat/overview.js` | 提供挂载点、加载 bundle、声明并注入 RPC / poll |
| 桥接层 | `rpc.declare()` / `poll.add()` | 复用 LuCI 会话与轮询机制，隔离 Vue 与 CGI |
| 接口层 | ucode rpcd ubus 对象 `luci.wrtbwstat` | 聚合、查询、配置读写 |
| 采集层 | nlbwmon + conntrack netlink | 从内核 conntrack 读取每日流量，写入账期数据库 |
| 存储层 | 持久化目录 + 每日数据库 | 保留至少 95 个日账期 |
| 系统层 | UCI、procd、ACL、menu.d、firewall4 | 配置、进程托管、授权、菜单注册、nftables 规则集 |

本插件**不向 nftables 规则集写入任何规则**，也不调用 iptables / ip6tables。

### 4.2 数据流

1. 确保 conntrack accounting 已开启，nlbwmon 经 netlink 读取 conntrack 条目计数，按 MAC / IP / 协议累加并写入当前账期库。
2. 到日边界切换账期，压缩归档旧库，超过保留期删除最旧库。
3. LuCI view 加载 Vue bundle，Vue 通过注入的 `getSummary` / `getDevices` 发起 ubus 调用。
4. 后端按时间窗枚举日期，逐个读取账期库并聚合，返回统一 JSON。
5. Vue 更新响应式状态，重渲染时间窗卡片、设备表格与进度条；轮询由注入的 `addPoll` 驱动。

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

`/mnt/usb/nlbwmon` 是假设挂载点，需按实际设备替换。

### 4.4 数据模型

后端对外暴露的记录以设备为粒度，v2 保持与 v1 兼容：

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

v2 的后端接口与 v1 完全一致，方便 M1 阶段独立开发和验证。

### 5.2 前端设计

#### 5.2.1 分层原则

- **LuCI view 只做薄壳**：声明 RPC 方法、加载 bundle、创建挂载点、返回 DOM。
- **Vue 应用不接触 LuCI 内部机制**：会话、CSRF、轮询全部通过注入的 API 完成。
- **模板必须预编译**：Vite 将 `.vue` SFC 编译为 render function，产物使用 Vue runtime-only 构建，不使用运行时模板字符串。

#### 5.2.2 LuCI 薄壳 view

文件：`htdocs/luci-static/resources/view/wrtbwstat/overview.js`

```js
'use strict';
'require rpc';
'require poll';
'require view';

const callSummary = rpc.declare({
  object: 'luci.wrtbwstat',
  method: 'get_summary',
  params: ['range'],
  expect: { devices: [] }
});

const callDevices = rpc.declare({
  object: 'luci.wrtbwstat',
  method: 'get_devices',
  params: ['range', 'sort', 'keyword'],
  expect: { devices: [] }
});

function loadBundle() {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/luci-static/resources/wrtbwstat/app.js';
    s.onload = () => resolve(window.UsagestatApp);
    s.onerror = () => reject(new Error('Failed to load usagestat app bundle'));
    document.head.appendChild(s);
  });
}

return view.extend({
  load: loadBundle,

  render(App) {
    const el = E('div', { id: 'usagestat-app' });

    App.mount(el, {
      getSummary: callSummary,
      getDevices: callDevices,
      addPoll: poll.add,
      i18n: {
        title: _('Traffic usage'),
        today: _('Today'),
        yesterday: _('Yesterday'),
        last7: _('Last 7 days'),
        last30: _('Last 30 days'),
        last90: _('Last 90 days')
      }
    });

    return el;
  }
});
```

说明：

- `view.extend()` 的 `load()` 结果会作为 `render()` 参数，这里传入 Vue bundle 暴露的 `window.UsagestatApp`。
- `rpc.declare()` 在 view 中声明，LuCI 负责附带会话令牌；Vue 只拿到函数引用。
- `i18n` 通过 `_()` 在 view 侧注入，避免 LuCI 的翻译扫描器无法识别 `.vue` 文件。

#### 5.2.3 Vite 产物契约

文件：`htdocs/luci-static/resources/wrtbwstat/app.js`

- 由 `frontend/` 下的 Vue 3 SFC 编译，格式 IIFE。
- 使用 Vue **runtime-only** 构建，模板全部在构建期编译。
- 对外只暴露一个全局对象：

```js
window.UsagestatApp = {
  mount(el, api) {
    // api = { getSummary, getDevices, addPoll, i18n }
    // 创建 Vue app 并挂载到 el
  }
};
```

- 样式抽取到 `app.css`，由 view 通过 `E('link', ...)` 或 LuCI 资源加载机制引入。
- 产物提交进 Git/包源码树；OpenWrt 构建阶段不执行 npm。

#### 5.2.4 状态与刷新

- 时间窗选择、排序字段、搜索关键词、设备行数据均为 Vue `ref` / `reactive` 状态。
- 时间窗切换时调用 `getSummary(range)` 与 `getDevices(range, sort, keyword)`，更新状态后由 Vue 自动重渲染。
- 自动刷新使用注入的 `addPoll(fn, interval)`，不自行 `setInterval`，以保证与 LuCI 页面生命周期一致。
- 错误状态在 Vue 内部以简单 toast / 行内提示呈现，不弹浏览器原生 alert。

#### 5.2.5 图表

v2 仍不引入 Chart.js / ECharts。趋势用内联 SVG 或 CSS 条形实现，理由：

- 与 LuCI 现有视觉风格一致；
- 避免额外体积；
- 五个时间窗的汇总图与设备占比条不需要复杂图表能力。

若后续确实需要交互式折线图，再评估 uPlot（体积小、Canvas 渲染）作为可选增强。

#### 5.2.6 CSP 与 `unsafe-eval`

截至 2026 年 LuCI 默认尚未强制 CSP，但相关 PR 已在推进，草案中的策略包含 `unsafe-eval`。Vue 全量构建依赖 `new Function` 进行运行时模板编译，未来可能被拦。

v2 采用 runtime-only + 预编译模板，从根上不依赖 `unsafe-eval`，即使 CSP 落地也无需放宽策略。

### 5.3 包结构

```text
wrtbwstat/
├── Makefile                       # DEPENDS:=+nlbwmon +rpcd-mod-ucode
└── root/etc/uci-defaults/80_wrtbwstat

luci-app-wrtbwstat/
├── Makefile                       # include luci.mk
├── frontend/                      # Vue 源码，不安装到设备
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── scripts/verify-bundle.js    # 产物挂载校验
│   └── src/
│       ├── main.js                 # 对外入口 window.WrtbwstatApp
│       ├── App.vue                 # 只做区块编排
│       ├── assets/styles/          # tokens.css + base.css
│       ├── components/
│       │   ├── layout/             # AppHeader
│       │   ├── ui/                 # 设计系统原子件
│       │   ├── summary/            # 汇总卡 + 趋势线
│       │   ├── devices/            # 设备表/行/详情/图表/协议
│       │   └── settings/           # 设置面板/字段/危险区
│       ├── composables/            # useTrafficData / useDeviceDetail /
│       │                           #   useSettingsForm / useI18n
│       ├── constants/              # 与后端契约绑定的枚举
│       ├── utils/                  # 纯函数
│       ├── mocks/                  # dev 预览数据
│       └── dev/main.js             # 开发入口
├── htdocs/luci-static/resources/
│   ├── view/wrtbwstat/overview.js  # LuCI 薄壳
│   └── wrtbwstat/
│       ├── app.js                  # Vite 产物，预编译提交
│       └── app.css                 # Vite 产物，预编译提交
└── root/usr/share/
    ├── luci/menu.d/luci-app-wrtbwstat.json
    └── rpcd/
        ├── acl.d/luci-app-wrtbwstat.json
        └── ucode/luci.wrtbwstat    # ucode 后端脚本
```

### 5.4 构建与打包

**前端构建（开发环境）**

```sh
cd luci-app-wrtbwstat/frontend
npm ci
npm run build
```

产物复制到 `htdocs/luci-static/resources/wrtbwstat/`，与源码一同提交。`package-lock.json` 必须提交，保证构建可复现。

不在 OpenWrt SDK 内运行 npm；虽然 `node.mk` 可以做到，但会拖慢 SDK 构建并使工具链复杂化。v2 明确选择"预编译 + 提交产物"。

**固件包构建（25.12 SDK）**

- `CONFIG_USE_APK=y`，由构建系统的 `apk mkpkg` 产出 `.apk`。
- `PKG_RELEASE` 体现为 `rN` 修订号。
- 安装：`apk -U add wrtbwstat luci-app-wrtbwstat`，本地包用 `apk --allow-untrusted add ./xxx.apk`。
- 不产出 ipk，不维护 24.10 分支。
- 无需编写 APKBUILD；那是 Alpine 原生 abuild 的格式。Alpine 源的 apk 因 ABI、内核与 feed 不同，不可直接安装到 OpenWrt。

### 5.5 前端体积预算

| 项目 | 目标 | 说明 |
| --- | --- | --- |
| Vue runtime-only | 约 100 KB min / 约 35 KB gzip | 不含模板编译器 |
| 应用组件 JS | 约 30-50 KB gzip | 按需拆分组件，避免大依赖 |
| 应用 CSS | 约 10 KB gzip | 复用 LuCI 视觉变量，不打包 UI 库样式 |
| 合计 | ≤ 120 KB gzip | 写入验收标准 |
| Element Plus | 禁止 | 单独就会增加数百 KB |

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
| LuCI 自定义模块加载器与 ES Module 不兼容 | Vue bundle 无法用 `import` 直接加载 | 通过 `<script>` 注入同源 bundle；自有 helper 可用 `'require xxx as yyy'` |
| Vue 绕过 LuCI 会话 | 认证失效或 CSRF 错误 | Vue 不直接 fetch CGI，只使用注入的 `rpc.declare()` 函数 |
| CSP 落地后拦截运行时模板编译 | 页面白屏 | runtime-only + Vite 预编译 SFC，验证产物中无 `new Function` |
| 前端体积失控 | 低端设备加载慢、占用高 | 体积预算 ≤120 KB gzip，禁止重型 UI 库，验收时实测 |
| i18n 扫描失效 | Vue 组件文案不翻译 | 文案在 view 中以 `_()` 注入；暂不引入 vue-i18n |
| 主题样式不一致 | Vue 页面与 LuCI 观感割裂 | 复用 `cbi-*` 类与主题 CSS 变量；不写死浅色/深色 |
| Vite 产物与源码漂移 | 提交旧 bundle，页面行为不符 | `package-lock.json` 入库；M2 验收时从干净 checkout 重建并比对产物 |

## 7. 实施计划

| 阶段 | 内容 | 产出 |
| --- | --- | --- |
| M0 | 安装 nlbwmon，配置日账期、持久化目录与 conntrack accounting；用 `conntrack -E` 与 `nlbw` 验证事件与计数；运行 7 天 | 可用的数据源、体积实测与 fullcone 冲突结论 |
| M1 | 实现 ucode 后端与 ACL / 菜单注册 | 可用 ubus 接口 |
| M2a | 用 Vite 开发 Vue 3 组件，先以 mock RPC 跑通交互 | 可独立运行的前端应用 |
| M2b | 实现 LuCI 薄壳 view，注入真实 RPC / poll / i18n，联调 | 可用的完整页面 |
| M3 | 25.12 SDK 构建 apk，编写安装与排错说明 | 可分发安装包 |

## 8. 验收标准

1. 五个时间窗的总量与各设备明细之和一致，误差在协议开销允许的范围内。
2. 设备重启后，重启前 24 小时内的历史数据仍可查询。
3. 连续运行 30 天，数据库目录未写满，页面响应无明显退化。
4. 在 25.12 SDK 上构建出可安装的 apk；`nft list ruleset` 中不存在本插件新增的规则。
5. `conntrack -E` 有事件输出，nlbwmon 数据库持续产生记录。
6. 未授予 ACL 的用户无法调用写方法。
7. Vue 应用能在 25.12 LuCI 中正常挂载，菜单、登录会话与 ACL 均正常。
8. 从干净 checkout 执行 `npm ci && npm run build` 重建产物，与提交的 `app.js` / `app.css` 一致。
9. 前端 gzip 总量不超过 120 KB；产物中不出现运行时模板编译依赖（无 `new Function`）。
10. 时间窗切换、排序、搜索与自动刷新在浏览器中均正常，且无静态资源 404。

## 9. 待定问题

- 目标固件是否为 25.12+，以及是否启用 fullcone NAT（决定是否需要处理 ctnetlink 通知冲突）。
- 是否已有可用 USB 存储作为数据库目录，需现场确认。
- 是否开启 flow offloading，需在目标设备上核实并决定 flowtable counter 的落地方式。
- 是否允许通过 `/etc/sysctl.d/` 持久化开启 `nf_conntrack_acct`，需现场确认。
- 90 天历史的实际磁盘占用需在 M0 阶段实测后回填本文档。
- 是否接受"前端预编译产物入库、SDK 不跑 npm"的策略；若要求全链路可复现构建，需评估引入 `node.mk`。
- 是否需要中文以外语言支持；如需要，再评估引入 vue-i18n 与翻译文件管理。
- 是否需要交互式折线图；如需要，再评估 uPlot 的体积与集成方式。
