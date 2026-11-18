# FlowLens

FlowLens 是一个面向 OpenWrt / iStoreOS 的按设备流量统计插件项目，目标是让用户清晰看到"昨天、今天、近 7/30/90 天各设备用了多少流量"。名称取"流量透镜"之意——把内核 conntrack 中的流量数据聚合成可观察的视图。

## 当前状态

- 设计：v2 定稿（Vue 3 + Vite 前端、ucode 后端、nlbwmon 采集、apk 打包）。
- 后端：M1 已实现——六个 ubus 方法全部落地，逐日读取 nlbw 账期并聚合，带历史账期缓存与采集告警。
- 前端：M2a 已完成——`app.js` / `app.css` 已构建入库，`npm run verify` 在 jsdom 中实测挂载通过，gzip 合计 29 KB。
- 未完成：**后端尚未在真机跑过**（本机无 ucode 运行环境，WSL 被安全策略禁用），需按"路由器冒烟测试"验证；25.12 LuCI 联调（M2b）；apk 打包（M3）。

## 目录结构

```text
flowlens/
├── doc/                                  # 设计文档（v1 / v2），随仓库自包含
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

## 接口契约

ubus 对象 `luci.wrtbwstat`，方法与入参见设计文档 5.1：

| 方法 | 入参 | 当前状态 |
| --- | --- | --- |
| `get_summary` | `range` | M1 已实现：聚合 90 个自然日后按窗口求和，附 `series`、`warnings` |
| `get_devices` | `range`, `sort`, `keyword` | M1 已实现：按 MAC 归并、别名/DHCP 名回退、排序与关键词过滤 |
| `get_device` | `mac`, `range` | M1 已实现：日序列 + 协议分布（`layer7`，不可用时回退协议号） |
| `get_settings` | — | M1 已实现：插件设置 + nlbwmon 采集状态 + 风险告警 |
| `set_settings` | 配置对象 | M1 已实现：校验（拒绝 tmpfs 目录、保留期 ≥90、刷新间隔白名单）后写 UCI 并同步 nlbwmon |
| `reset_database` | `confirm` | M1 已实现：停 nlbwmon → 删 `nlbwmon.db*` → 重启，强制 `confirm=true` |

`range` 取值固定为 `today | yesterday | last7 | last30 | last90`；`sort` 取 `total | rx | tx | hostname | mac`。

### M1 实现要点

- **只读 `nlbw -c json`**，不解析 nlbwmon 数据库文件。`nlbw` 的 JSON 是 `{"columns":[...],"data":[[...]]}`，列集合随 `-g` 变化，所以按**列名**映射而非固定下标。
- **账期归属**：今天读守护进程活跃库（不带 `-t`），历史日期读归档库（`-t YYYY-MM-DD`）。历史账期归档后不再变化，因此落 `/tmp/wrtbwstat-cache/` 缓存；今天的账期不缓存。`reset_database` 与更换存储目录都会清缓存。
- **自然日枚举**走 ucode 原生 `localtime()` / `timelocal()`：以本地时间 12:00 为锚点、`mday` 减去偏移，越界由 `timelocal` 归一化进位。取中午而非 00:00，避免少数时区午夜切换夏令时的日期歧义。
- **成本**：`nlbw` 一次只能读一个账期，`get_summary` 要覆盖近 90 天，首调用会有 90 次进程派生（约 1-3 秒，视设备而定），之后命中缓存。`get_devices(range)` 只读该窗口所需的日数。
- **已知取舍**：
  - `first_seen` / `last_seen` 无法从账期摘要还原，返回 `null`，改用 `days_active`（窗口内有流量的天数）表达。
  - MAC 为 `00:00:00:00:00:00` 的流量（nlbwmon 未解析到源 MAC，多见于 IPv6）单独成一行，标记 `unknown_source: true`。
  - 协议分布优先按 `layer7` 分组；若该 nlbw 版本不支持按复合字段分组，自动回退 `-g mac,proto`，标签变成 `proto 6` 之类。

### 路由器冒烟测试

后端**尚未在真机验证过**，装包后按顺序执行：

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

第 3 步的输出直接决定解析是否需要调整：若 `columns` 里没有 `rx_bytes` / `mac` 这两个名字，把实际输出贴回来，改 `nlbw_query()` 的列名映射即可。

## 与设计文档的差异（需确认）

1. **仓库布局**：文档 5.3 画的 `wrtbwstat/`、`luci-app-wrtbwstat/` 位于顶层；本仓库沿用既有 README 约定的 `packages/` 子目录，包名与内部相对路径不变。
2. **ucode 后端归属**：文档 5.3 把 `rpcd/ucode/luci.wrtbwstat` 放在 `luci-app-wrtbwstat` 包内，此处照做；若希望"只装后端不装界面"，可平移到 `wrtbwstat` 包。
3. **命名统一**：文档 5.2.2 示例中前端入口写作 `window.UsagestatApp`、挂载点 `usagestat-app`，与包名 `wrtbwstat` 不一致。骨架统一为 `window.WrtbwstatApp` / `#wrtbwstat-app`。
4. **新增配置项**：文档只提存储目录与保留期，骨架额外固化了 `commit_interval`、`compress`、`refresh_interval`（`/etc/config/wrtbwstat`），对应 4.3 节与 FR-07。

## 待办

- [ ] M0：在目标设备验证 `conntrack -E` 事件、nlbwmon 落库与 fullcone 冲突，回填 90 天体积实测。
- [x] M1：`enumerate_days` / `read_day`（`nlbw -c json -n -t`）/ `aggregate` / `resolve_hostname` / `day_total` / 缓存。
- [x] M1：`set_settings` 校验（拒绝 tmpfs 目录、保留期、刷新间隔白名单）与 `reset_database`。
- [ ] M1-verify：按"路由器冒烟测试"在真机跑一遍，确认 `nlbw -c json` 的列名与 `-g mac,layer7` 是否可分组。
- [x] M2a：依赖安装与构建跑通，`app.js` / `app.css` / `package-lock.json` 入库；`npm run verify` 在 jsdom 中实测挂载通过。
- [ ] M2b：25.12 LuCI 中联调薄壳 view，验证会话、ACL、poll 生命周期。
- [ ] M3：SDK 构建 apk，编写安装与排错说明。

## 技术基线

| 层 | 选型 |
| --- | --- |
| 固件 | OpenWrt 25.12+ / main，iStoreOS 对应分支 |
| 采集 | nlbwmon（conntrack netlink），按日账期持久化 |
| 后端 | ucode + rpcd（`rpcd-mod-ucode`） |
| 前端 | Vue 3 + Vite（runtime-only，IIFE 产物），挂载在 LuCI view 中 |
| 打包 | apk（`CONFIG_USE_APK=y`），不维护 ipk 分支 |

本插件不向 nftables 写入任何规则，也不调用 iptables / ip6tables。
