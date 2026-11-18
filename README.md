# FlowLens

FlowLens 是一个面向 OpenWrt / iStoreOS 的按设备流量统计插件项目，目标是让用户清晰看到"昨天、今天、近 7/30/90 天各设备用了多少流量"。名称取"流量透镜"之意——把内核 conntrack 中的流量数据聚合成可观察的视图。

## 当前状态

- 设计：v2 定稿（Vue 3 + Vite 前端、ucode 后端、nlbwmon 采集）。打包双轨：apk 主推，ipk 维护至 24.10 EOL。
- 后端：M1 已实现——六个 ubus 方法全部落地，逐日读取 nlbw 账期并聚合，带历史账期缓存与采集告警。已在 OpenWrt rootfs 容器内用 mock nlbw 跑通 144 条断言。
- 前端：M2a 已完成——`app.js` / `app.css` 已构建入库，`npm run verify` 在 jsdom 中实测挂载通过，gzip 合计 29 KB。
- 真机：已在 iStoreOS 24.10.8（rockchip/armv8，opkg）上部署跑通，页面可显示数据。
- 前端功能：时间窗切换、汇总卡片、设备表（排序/搜索）、**设备详情（按日用量 + 协议分布）**、**设置页（采集参数 + 清库）** 均已实现。
- 未完成：跨天/重启后历史保留验证（需真实积累）；`luci-app` 出包需完整 buildroot（M3）。

## 目录结构

```text
flowlens/
├── doc/                                  # 设计文档（v1 / v2），随仓库自包含
├── tests/
│   ├── run-backend-tests.sh              # 后端测试入口（OpenWrt rootfs 容器）
│   └── backend/
│       ├── verify.sh                     # 只读/写三阶段验证
│       ├── driver.uc                     # 断言驱动（追加在插件源码之后执行）
│       ├── mock-nlbw                     # nlbw 桩，产出固定流量
│       ├── test-uci-defaults.sh          # 安装脚本落盘验证
│       └── fixtures/                     # nlbwmon / wrtbwstat 的 UCI 配置
├── packages/
│   ├── wrtbwstat/                        # 数据面配置包：nlbwmon 日账期基线
│   │   ├── Makefile                      # DEPENDS:=+nlbwmon +rpcd-mod-ucode
│   │   └── root/
│   │       ├── etc/config/wrtbwstat      # 插件层设置（存储目录、保留期、刷新间隔、别名）
│   │       ├── etc/sysctl.d/99-wrtbwstat.conf
│   │       └── etc/uci-defaults/80_wrtbwstat
│   └── luci-app-wrtbwstat/               # 应用包：菜单 + ACL + 薄壳 view + 前端产物 + 后端
│       ├── Makefile                      # include $(TOPDIR)/feeds/luci/luci.mk
│       ├── frontend/                     # Vue 3 源码，不安装到设备
│       │   ├── package.json
│       │   ├── vite.config.js
│       │   ├── index.html                # M2a 开发预览宿主页
│       │   └── src/
│       │       ├── main.js               # 对外唯一入口 window.WrtbwstatApp
│       │       ├── App.vue
│       │       ├── dev.js                # 开发入口，注入 mock api
│       │       ├── mock.js               # mock RPC，形状与注入 api 一致
│       │       ├── style.css
│       │       ├── utils/format.js
│       │       └── components/
│       │           ├── RangeTabs.vue
│       │           ├── SummaryCards.vue
│       │           └── DeviceTable.vue
│       ├── htdocs/luci-static/resources/
│       │   ├── view/wrtbwstat/overview.js   # LuCI 薄壳 view
│       │   └── wrtbwstat/                   # Vite 产物落点（app.js / app.css）
│       └── root/usr/share/
│           ├── luci/menu.d/luci-app-wrtbwstat.json
│           └── rpcd/
│               ├── acl.d/luci-app-wrtbwstat.json
│               └── ucode/luci.wrtbwstat     # ubus 对象 luci.wrtbwstat
```

## 开发

前端（Node 18+）：

```sh
cd packages/luci-app-wrtbwstat/frontend
npm ci               # 或首次 npm install；package-lock.json 已入库
npm run dev          # 打开 http://localhost:5173，使用 mock 数据
npm run build        # 产物直接写入 ../htdocs/luci-static/resources/wrtbwstat/
npm run verify       # 在 jsdom 中挂载产物并断言渲染，同时检查体积与 new Function
```

构建机（OpenWrt 25.12 SDK）**不执行 npm**，只消费已提交的 `app.js` / `app.css`。

改动前端后必须 `npm run build && npm run verify` 再提交，防止产物与源码漂移（验收条目 8/9）。

### 体积实测（2026-11-18，vite 7.3.8 / vue 3.5.45）

| 产物 | 原始 | gzip |
| --- | --- | --- |
| `app.js`（Vue runtime + 应用组件） | 73.3 KB | 28.7 KB |
| `app.css` | 2.6 KB | 0.9 KB |
| 合计 | 75.9 KB | **29.6 KB**（预算 120 KB） |

### 构建注意

- **lib 模式不会自动替换 `process.env.NODE_ENV`**：Vue 的 esm-bundler 构建通篇用它做 dev 校验开关，若不在 `vite.config.js` 的 `define` 里显式替换，产物会残留 `process.env`，浏览器加载即抛 `process is not defined` 导致整页白屏。已在配置中固定，`npm run verify` 也会拦截该情况。
- 产物必须是 IIFE 而非 ES Module：LuCI 的自定义模块加载器与 ESM 不兼容，view 只能用同源 `<script>` 注入。
- 模板全部预编译（`vue.runtime.esm-bundler.js`），产物中不含 `new Function`，未来 CSP 落地无需放宽策略。

## 打包：apk 与 ipk 双轨

**策略**：apk 为主推，ipk 维护到 OpenWrt 官方停止支持 24.10 为止。两条线共用同一份源码、同一份 Makefile——出什么格式由 SDK 的 `CONFIG_USE_APK` 决定，代码里没有任何版本分支。

```sh
# 25.12+ / main SDK（CONFIG_USE_APK=y）→ 产出 .apk
sh scripts/build-in-sdk.sh ~/sdk/openwrt-sdk-25.12

# 24.10 / iStoreOS 对应分支 SDK → 产出 .ipk
sh scripts/build-in-sdk.sh ~/sdk/openwrt-sdk-24.10
```

脚本会校验 SDK、把 `packages/` 复制到 `package/flowlens/`、编译两个包并打印产物路径。前提是 SDK 里已 `./scripts/feeds update luci && ./scripts/feeds install -a -p luci`，否则 `luci.mk` 不存在（也可以用 `LUCI_MK=...` 指定其他位置）。

### 实测记录（2026-11-18）

| 包 | ipk（24.10.5 SDK） | apk（25.12.6 SDK） |
| --- | --- | --- |
| `wrtbwstat` | ✅ `wrtbwstat_0.1.0-r1_all.ipk`（3.1 KB） | ✅ `wrtbwstat-0.1.0-r1.apk`（3.0 KB） |
| `luci-app-wrtbwstat` | ⚠️ 未产出（环境限制，见下） | ⚠️ 未产出（同一限制） |

`wrtbwstat` 两种格式都已核验，元数据一致、仅格式不同：

```text
ipk control : Package: wrtbwstat / Version: 0.1.0-r1 / Architecture: all
              Depends: libc, nlbwmon, rpcd-mod-ucode / License: Apache-2.0
              conffiles: /etc/config/wrtbwstat
apk adbdump : name: wrtbwstat / version: 0.1.0-r1 / arch: noarch
              depends: libc, nlbwmon, rpcd-mod-ucode / provides: wrtbwstat-any
              conffiles 记录在 lib/apk/packages/wrtbwstat.conffiles
data（两者） : /etc/config/wrtbwstat (0600)
              /etc/sysctl.d/99-wrtbwstat.conf (0644)
              /etc/uci-defaults/80_wrtbwstat (0755)
```

`luci-app-wrtbwstat` 在裸 SDK 里编不出来，两条线原因相同：`luci.mk` 强制 host 编译 `luci-base`，而 `luci-base` 依赖 `liblucihttp-ucode` → `lucihttp` 的 ucode 绑定需要 `ucode/module.h`。OpenWrt SDK **不包含核心包源码**（`package/` 下只有 kernel 与 toolchain，`staging_dir/target-*/usr/include` 为空），且该绑定由 `luci-base` 强制选中，无法通过改 `.config` 绕开。这不是本仓库的问题——任何 LuCI 应用都会撞上。出应用包需要：

- 完整 buildroot（`git clone openwrt` + feeds，`make package/flowlens/luci-app-wrtbwstat/compile`），或
- 一个 `staging_dir` 里带 `libucode` 头文件的 SDK。

`wrtbwstat` 能出包正因为它只 `include $(INCLUDE_DIR)/package.mk`，不碰 `luci.mk`。

**完整 buildroot 也试过，被网络挡住**：克隆源码、配好 feeds 后，工具链阶段需要从 `sources.openwrt.org` 下载 gcc/binutils/musl 等上百 MB 源码，该站此网络只有 3–15 KB/s（`downloads.openwrt.org` 同样慢），实际跑不完。脚本保留在 `scripts/build-in-sdk.sh`，换到网络正常的环境可直接用。

### 手工打包 ipk（备用通道，已实测）

`scripts/pack-ipk.sh` 按 OpenWrt 的 ipk 规范（`debian-binary` + `control.tar.gz` + `data.tar.gz`）打包，元数据与 `luci.mk` 对齐。已在 iStoreOS 24.10.8 上实测：`opkg install` → 对象自动注册 → 数据正常；`opkg remove` → 文件清除干净；重装再次生效。

```sh
sh scripts/pack-ipk.sh          # 产物在 dist/
```

**一个只有真装才会发现的坑**：包里的 `postinst` 必须与 `luci.mk` 生成的保持一致——除了清 LuCI 索引缓存，还要 `/etc/init.d/rpcd reload`。少了这一步，`opkg install` 明明成功，但 `ubus list` 里没有 `luci.wrtbwstat`，页面一直空白（rpcd 只在启动时加载 ucode 脚本）。`luci.mk` 第 236 行本来就做了这件事，手工打包时容易漏。

> 附：25.12.6 SDK 解压后约 2.5 GB；构建前若缺 `.config`，直接 `make` 会拉起交互式 menuconfig 并因 `$TERM=unknown` 失败，先 `make defconfig` 即可。

安装：

```sh
apk add --allow-untrusted ./wrtbwstat-0.1.0-r1.apk ./luci-app-wrtbwstat-0.1.0-r1.apk   # 25.12+
opkg install ./wrtbwstat_0.1.0-1_all.ipk ./luci-app-wrtbwstat_0.1.0-1_all.ipk          # 24.10
```

### 两条线的差异与兼容性

| 项 | 25.12+（apk，主推） | 24.10（ipk，维护中） |
| --- | --- | --- |
| 包管理器 | apk | opkg |
| 防火墙 | firewall4 / nftables | firewall4 / nftables（22.03 起） |
| 后端运行时 | ucode + `rpcd-mod-ucode` | 同左（24.10 已具备） |
| LuCI 客户端 | 浏览器 JS（`require rpc` / `poll` / `view`） | 同左，薄壳 view 无需另写 |
| `/etc/sysctl.d/*.conf` | 支持 | 支持（18.06 起） |
| 预编译产物 | app.js / app.css | 同一份，无差异 |
| 本项目的差异处理 | 无 | 仅打包格式不同 |

因为两个包都是 `PKGARCH:=all` 的纯配置 / 纯脚本包，产物内容一致，区别只在包格式与依赖解析方式。`wrtbwstat` 依赖 `+nlbwmon +rpcd-mod-ucode`，`luci-app-wrtbwstat` 依赖 `+luci-base +wrtbwstat`，两条线同名可解析。

24.10 EOL 后：删除本节 ipk 部分、`scripts/build-in-sdk.sh` 的格式探测与 README 的技术基线，代码无需改动（本就无版本分支）。



## 接口契约

ubus 对象 `luci.wrtbwstat`，方法与入参见设计文档 5.1：

| 方法 | 入参 | 当前状态 |
| --- | --- | --- |
| `get_summary` | `range` | M1 已实现：聚合 90 个自然日后按窗口求和，附 `series`、`warnings` |
| `get_devices` | `range`, `sort`, `keyword` | M1 已实现：按 MAC 归并、别名/DHCP 名回退、排序与关键词过滤 |
| `get_device` | `mac`, `range` | M1 已实现；前端点击设备行即展开日序列 + 协议分布 |
| `get_settings` | — | M1 已实现：插件设置 + nlbwmon 采集状态 + 风险告警 |
| `set_settings` | 配置对象 | M1 已实现；设置页可改目录/保留期/落盘间隔/压缩/刷新间隔，目录未变则不重启采集 |
| `reset_database` | `confirm` | M1 已实现；设置页危险区需勾选确认后才可点，强制 `confirm=true` |

`range` 取值固定为 `today | yesterday | last7 | last30 | last90`；`sort` 取 `total | rx | tx | hostname | mac`。

### M1 实现要点

- **只读 `nlbw -c json`**，不解析 nlbwmon 数据库文件。`nlbw` 的 JSON 是 `{"columns":[...],"data":[[...]]}`，列集合随 `-g` 变化，所以按**列名**映射而非固定下标。
- **账期归属**：今天读守护进程活跃库（不带 `-t`），历史日期读归档库（`-t YYYY-MM-DD`）。历史账期归档后不再变化，因此落 `/tmp/wrtbwstat-cache/` 缓存；今天的账期不缓存。`reset_database` 与更换存储目录都会清缓存。
- **自然日枚举**走 ucode 原生 `localtime()` / `timelocal()`：以本地时间 12:00 为锚点、`mday` 减去偏移，越界由 `timelocal` 归一化进位。取中午而非 00:00，避免少数时区午夜切换夏令时的日期歧义。
- **成本**：`nlbw` 一次只能读一个账期，`get_summary` 要覆盖近 90 天，首调用会有 90 次进程派生（约 1-3 秒，视设备而定），之后命中缓存。`get_devices(range)` 只读该窗口所需的日数。
- **已知取舍**：
  - `first_seen` / `last_seen` 无法从账期摘要还原，返回 `null`，改用 `days_active`（窗口内有流量的天数）表达。
  - **设备标识**：`hostname` 取不到时返回空串（而不是回退成 MAC），并另给 `ip` 字段（DHCP 租约优先、其次 `/proc/net/arp`）。前端据此决定排版——有名称时「名称 + MAC 副标题」，无名称时「MAC 标题 + IP 副标题」，避免同一串 MAC 上下重复两遍。关键词搜索同时匹配名称、MAC 与 IP。
  - MAC 为 `00:00:00:00:00:00` 的流量（nlbwmon 未解析到源 MAC，多见于 IPv6）单独成一行，标记 `unknown_source: true`。
  - 协议分布优先按 `layer7` 分组；若该 nlbw 版本不支持按复合字段分组，自动回退 `-g mac,proto`，标签变成 `proto 6` 之类。

## 多语言（只维护简体中文与英文）

只做两种语言：**英文作为源码语言**（`_()` 的 msgid），**简体中文**放 `po/zh_Hans/wrtbwstat.po`。

三层机制，缺一层就会出现中英混排：

1. **后端不写自然语言**。告警与校验错误只回 `code` + 参数，例如
   `{ code: 'warnTmpfs', dir: '/var/lib/nlbwmon' }`、`'errRetention'`，由前端翻译。
   否则中文文案会直接漏到英文界面里（这正是最初"一半中文一半英文"的根因之一）。
2. **po → lmo**。打包时用 `po2lmo` 编译，安装到 `/usr/lib/lua/luci/i18n/`。
   由于固件语言目录命名不一致（iStoreOS 用 `zh-cn`、上游用 `zh_Hans`），**两个名字各装一份**。
3. **视图内置词典兜底**。`overview.js` 里带一份中文词典，`T()` 先问 LuCI 的 `_()`，
   翻译未生效时按 `<html lang>` 决定是否用内置中文。这样即使某台机器没有加载 `.lmo`，
   页面也只会是"全中文"或"全英文"，不会混排。

新增文案时三处都要改：`po/zh_Hans/wrtbwstat.po`、`overview.js` 的 i18n 表（英文源串）、
`overview.js` 的内置 `ZH` 词典；若新增后端 code，还要在 i18n 表里加同名 key。

`npm run verify` 会分别用英文与中文各渲染一次，并断言中文页里不出现 `Traffic usage`、`Download` 等英文残留。

### 自动化测试（已在 OpenWrt 容器内跑通）

```sh
sh tests/run-backend-tests.sh
# 国内拉不动 Docker Hub 时：
IMAGE=docker.1panel.live/openwrt/rootfs:x86-64 sh tests/run-backend-tests.sh
```

把仓库根挂进 `openwrt/rootfs:x86-64`，用 mock `nlbw` 产出**固定流量**（每日 rx=1510 / tx=151），因此每个数字都能预先算出。三组用例共 144 条断言：

| 用例 | 覆盖 |
| --- | --- |
| `tests/backend/verify.sh` | 五窗口总量与 series 长度、MAC 归并、别名/DHCP/MAC 三级回退、排序、关键词、协议分布、`set_settings` 五种拒绝路径与生效、`reset_database`、缓存命中的调用次数（冷 104 → 热 9） |
| 同上 `FL_NLBW_BREAK_LAYER7=1` | `-g mac,layer7` 失败时回退 `-g mac,proto` 的分支 |
| `tests/backend/test-uci-defaults.sh` | 安装脚本把 tmpfs 目录改为持久化目录、写入日账期/保留代/commit/compress、补 `local_network` |

> 为什么用 OpenWrt rootfs 而不是 Ubuntu：验证需要真实 `ucode` 解释器及自带 `fs`/`uci` 模块。Ubuntu 源里没有 `ucode` 包。

### M1 实测发现并修复的 4 个问题

这几个都是"看起来对、跑起来错"，且大多会静默返回错误数据而非报错：

1. **`int / int` 是整除**：`7700 / 11627` 得到 `0`，导致 `share` 全为 0。必须 `* 1.0` 转 double。
2. **`sort()` 比较器必须返回数值**：返回布尔时比较被视为"相等"，数组**完全不排序**（实测 `[3,1,2]` 原样返回）。排序用 `b - a`，字符串用比较函数返回 -1/0/1。
3. **`split(str)` 省略分隔符返回 `null`**，不是按空白拆分——DHCP 租约全部解析失败。需显式给分隔符并过滤空字段。
4. **按"值当下标"取数组元素**（`REFRESH_CHOICES[60]`、`SORTS[sort]`）：数组只有 4 个元素，索引 60 恒为 null，导致刷新间隔校验永远失败、`sort=rx/hostname/mac` 全部静默回退成 `total`。改用显式成员判断。

### 开发版部署（不打包，直接铺文件）

正式包出来之前，联调用 `scripts/dev-deploy/`：把 `packages/` 下的文件按设备路径铺好再重启 rpcd。

```sh
# 1. 组装（任意 Linux 机器）
mkdir -p /tmp/fl/stage && cp -r packages/luci-app-wrtbwstat/root/usr /tmp/fl/stage/
cp -r packages/luci-app-wrtbwstat/htdocs/luci-static /tmp/fl/stage/www/
cp -r packages/wrtbwstat/root/etc /tmp/fl/stage/
cp scripts/dev-deploy/*.sh /tmp/fl/
tar czf flowlens-dev.tar.gz -C /tmp/fl install-dev.sh uninstall-dev.sh stage

# 2. 路由器上
cd /tmp && wget -O fl.tgz http://<你的文件服务器>/flowlens-dev.tar.gz
mkdir fl && tar xzf fl.tgz -C fl && cd fl && sh install-dev.sh
```

映射关系：`root/` → `/`，`htdocs/luci-static/` → `/www/luci-static/`。

**注意**：OpenWrt 基础系统**没有 `install` 命令**（busybox 未编译该 applet），脚本里必须用 `mkdir -p` + `cp` + `chmod`，不要用 `install -m`。

### 真机实测结果（iStoreOS 24.10.8 / rockchip armv8）

已通过 SSH 在目标路由器上部署 `scripts/dev-deploy/` 并验证：

| 项 | 结果 |
| --- | --- |
| 包管理器 / ucode | opkg / ucode 2025.07.18，`rpcd-mod-ucode` 与 `ucode-mod-{fs,uci,ubus}` 齐全 |
| `nlbw` 位置 | **`/usr/sbin/nlbw`**（不是 `/usr/bin`）——已改为启动时按候选列表探测，写死路径会误报"nlbw 缺失" |
| `-g mac` 列名 | `["mac","conns","rx_bytes","rx_pkts","tx_bytes","tx_pkts"]`，与解析器的按列名映射一致 |
| `-g mac,layer7` | 可分组，列含 `proto/port/layer7`；`layer7` 部分为 `null`（协议库只映射少量端口），部分为 `HTTPS` 等 |
| 默认数据库目录 | `/var/lib/nlbwmon`，而 `/var` 是 tmpfs 的软链 → 重启丢历史；已改为 `/dockers-data/nlbwmon`（fstab 挂载，40 G 可用） |
| `nlbw -c commit` | 生成 `20261118.db.gz`（`database_compress=1` 生效），`-t 2026-11-18` 可读 |
| 历史归档校验 | 改名的副本会被拒（`No data available`），即归档按内部日期校验；后端把该错误当日 0 处理，不报错 |
| 实测耗时 | `get_summary` 冷 0.58–0.66 s / 热 0.62 s；`get_devices last7` 0.06 s |
| 静态资源 | `app.js` 73515 B、`app.css` 2774 B、`overview.js` 3206 B 均返回 200 |
| 设备名 | DHCP 租约解析生效（`ubuntu-server`），`share` 计算正确 |

据此修了三处代码：`nlbw` 路径改为运行时探测、协议名在 `layer7` 为 null 时退回 `proto/port`、过滤零字节协议条目。

> 仍需人工确认：浏览器打开 LuCI → 网络 → FlowLens，看页面是否正常渲染（后端与静态资源已通，剩下是 Vue 挂载与轮询）。

### 真机冒烟测试（备查）

**前置条件：路由器必须已安装 `nlbwmon`**（`nlbw` 命令来自该包）。装包时 `wrtbwstat` 的 `DEPENDS:=+nlbwmon` 会自动带入，但手工验证阶段需先自己装：

```sh
opkg update && opkg install nlbwmon      # opkg 系统
apk update  && apk add nlbwmon           # apk 系统（25.12+）
```

未安装时后端不会报错，而是返回空数据并在 `get_summary` / `get_settings` 的 `warnings` 里给出「nlbw 命令缺失」，页面顶部会显示告警条。

容器用的是 mock `nlbw`，**真实 `nlbw -c json` 的列名仍需在设备上确认一遍**。装包后按顺序执行：

```sh
# 1. 对象是否注册（rpcd 需要重载才能看到新脚本）
/etc/init.d/rpcd restart && ubus list luci.wrtbwstat

# 2. 设置与采集状态（最快，先确认 nlbw 路径、目录、conntrack acct、告警文案）
ubus call luci.wrtbwstat get_settings

# 3. 原始数据是否可读——这一步决定后续解析假设是否成立
nlbw -c json -n -g mac -o -rx_bytes | head -c 300
nlbw -c json -n -g mac,layer7 -o -rx_bytes | head -c 300    # 验证 layer7 能否分组
nlbw -t 2026-11-17 -c json -n -g mac -o -rx_bytes | head -c 300

# 4. 汇总（首次会逐日调用 nlbw，较慢）
time ubus call luci.wrtbwstat get_summary '{"range":"today"}'

# 5. 设备列表与单设备详情
ubus call luci.wrtbwstat get_devices '{"range":"last7","sort":"total","keyword":""}'
ubus call luci.wrtbwstat get_device '{"mac":"aa:bb:cc:dd:ee:ff","range":"last7"}'
```

第 3 步的输出直接决定解析是否要调整：若 `columns` 里没有 `rx_bytes` / `mac` 这两个名字，把实际输出贴回来，改 `nlbw_query()` 的列名映射即可。

## 与设计文档的差异（需确认）

1. **仓库布局**：文档 5.3 画的 `wrtbwstat/`、`luci-app-wrtbwstat/` 位于顶层；本仓库沿用既有 README 约定的 `packages/` 子目录，包名与内部相对路径不变。
2. **ucode 后端归属**：文档 5.3 把 `rpcd/ucode/luci.wrtbwstat` 放在 `luci-app-wrtbwstat` 包内，此处照做；若希望"只装后端不装界面"，可平移到 `wrtbwstat` 包。
3. **命名统一**：文档 5.2.2 示例中前端入口写作 `window.UsagestatApp`、挂载点 `usagestat-app`，与包名 `wrtbwstat` 不一致。骨架统一为 `window.WrtbwstatApp` / `#wrtbwstat-app`。
4. **新增配置项**：文档只提存储目录与保留期，骨架额外固化了 `commit_interval`、`compress`、`refresh_interval`（`/etc/config/wrtbwstat`），对应 4.3 节与 FR-07。
5. **打包策略**：文档 5.4 写的是"不产出 ipk，不维护 24.10 分支"。产品决定调整为主推 apk、同时保留 ipk 至 24.10 EOL，因为目标设备（iStoreOS 分支）当前仍是 opkg。已确认两条线不需要代码分叉：ucode + `rpcd-mod-ucode`、firewall4、`/etc/sysctl.d`、LuCI 浏览器端 JS 在 24.10 均已具备。

## 待办

- [ ] M0：在目标设备验证 `conntrack -E` 事件、nlbwmon 落库与 fullcone 冲突，回填 90 天体积实测。
- [x] M1：`enumerate_days` / `read_day`（`nlbw -c json -n -t`）/ `aggregate` / `resolve_hostname` / `day_total` / 缓存。
- [x] M1：`set_settings` 校验（拒绝 tmpfs 目录、保留期、刷新间隔白名单）与 `reset_database`。
- [x] M1-verify：OpenWrt rootfs 容器内 144 条断言全通过（含 layer7 回退与 uci-defaults），修掉 4 个 ucode 语义问题。
- [x] M1-verify-device：iStoreOS 24.10.8 真机确认列名、`-g mac,layer7` 可分组、`nlbw` 在 `/usr/sbin`。
- [ ] M2b-verify：浏览器确认 LuCI 页面渲染与轮询。
- [x] M2a：依赖安装与构建跑通，`app.js` / `app.css` / `package-lock.json` 入库；`npm run verify` 在 jsdom 中实测挂载通过。
- [ ] M2b：25.12 LuCI 中联调薄壳 view，验证会话、ACL、poll 生命周期。
- [x] M3-ipk：24.10.5 SDK 产出 `wrtbwstat` 的 ipk 并核验 control / conffiles / 文件权限。
- [x] M3-apk：25.12.6 SDK 产出 `wrtbwstat-0.1.0-r1.apk` 并核验元数据与权限。
- [x] M3-app-ipk：`luci-app-wrtbwstat` 的 ipk 已产出并在真机 install/remove 验证（`scripts/pack-ipk.sh`）；SDK/buildroot 出包受 `sources.openwrt.org` 限速所限未完成。
- [ ] M3-apk-app：应用包的 apk 仍需 25.12 完整环境。
- [ ] M3-doc：编写安装与排错说明（apk / opkg 两套）。

## 技术基线

| 层 | 选型 |
| --- | --- |
| 固件 | OpenWrt 25.12+ / main，iStoreOS 对应分支 |
| 采集 | nlbwmon（conntrack netlink），按日账期持久化 |
| 后端 | ucode + rpcd（`rpcd-mod-ucode`） |
| 前端 | Vue 3 + Vite（runtime-only，IIFE 产物），挂载在 LuCI view 中 |
| 打包 | apk（`CONFIG_USE_APK=y`，主推）+ ipk（24.10，维护至 EOL），同一份 Makefile |

本插件不向 nftables 写入任何规则，也不调用 iptables / ip6tables。
