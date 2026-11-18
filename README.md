# FlowLens

面向 OpenWrt 的按设备流量统计插件，适用于标准 OpenWrt 及基于它的衍生发行版（如 iStoreOS）。基于 nlbwmon 的 conntrack 账期，按自然日聚合每个设备的上下行流量，在 LuCI 中提供 Today / Yesterday / 7 / 30 / 90 天视图。

## 功能

- 五个时间窗口的汇总卡与趋势线（总量、上行、下行）
- 设备列表：按流量排序、关键词搜索、MAC 归并（同一设备的 IPv4/IPv6 合并）
- 设备详情：按日用量柱状图与协议分布
- 设置页：存储目录、保留天数、落盘间隔、压缩、自动刷新，以及清空数据库
- 采集告警：tmpfs 目录、nlbw 缺失、`nf_conntrack_acct` 未开启、fullcone 冲突

## 兼容性

| 项 | 说明 |
| --- | --- |
| 固件 | 标准 OpenWrt 25.12+（apk，主推）与 24.10（ipk）；iStoreOS 等衍生发行版同样适用 |
| 防火墙 | firewall4 / nftables，不写入任何规则 |
| 后端 | ucode + `rpcd-mod-ucode` |
| 采集 | nlbwmon（安装时自动作为依赖带入） |
| 前端 | Vue 3 + Vite，预编译为 IIFE 产物，无构建依赖 |

## 安装

25.12+（apk）：

```sh
apk add --allow-untrusted ./wrtbwstat-0.1.0-r1.apk ./luci-app-wrtbwstat-0.1.0-r1.apk
```

24.10（ipk）：

```sh
opkg install ./wrtbwstat_0.1.0-1_all.ipk ./luci-app-wrtbwstat_0.1.0-1_all.ipk
```

安装后打开 LuCI → **网络 → FlowLens**。`wrtbwstat` 的采集参数由 `/etc/uci-defaults/80_wrtbwstat` 在开机时应用；如需立即生效（会重启 nlbwmon，未落盘计数清零）：

```sh
sh /etc/uci-defaults/80_wrtbwstat
```

卸载：`apk del luci-app-wrtbwstat wrtbwstat` 或 `opkg remove ...`。被修改过的 `/etc/config/wrtbwstat` 会保留。

## 配置

插件设置位于 `/etc/config/wrtbwstat`，nlbwmon 的采集参数仍在 `/etc/config/nlbwmon`。

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `storage_dir` | `/mnt/usb` | 存储父目录，建议指向持久化磁盘；不能是 `/tmp`、`/var` |
| `retention_days` | `95` | 账期保留天数，需覆盖 90 天窗口 |
| `commit_interval` | `6h` | nlbwmon 落盘间隔 |
| `compress` | `1` | 压缩历史账期 |
| `refresh_interval` | `30` | 页面自动刷新秒数，可选 `0/10/30/60` |

设备别名（可选）：

```uci
config alias
	option mac 'aa:bb:cc:dd:ee:ff'
	option name '客厅电视'
```

## 数据与存储

数据库固定落在 `<storage_dir>/wrtbwstat/`，目录里只有插件写入的库文件：

```text
/mnt/usb/wrtbwstat/
├── 20261117.db.gz   # 历史账期（按日归档）
└── 20261118.db      # 当天活跃库
```

- 「清空数据库」只删除该子目录内的库文件，不会影响父目录中的其他文件。
- 更换存储目录时先停止 nlbwmon，再把历史库迁移到新目录（跨文件系统自动回退为 `mv`）。
- 目录设在 tmpfs 上会在重启后丢失历史，设置页会直接拒绝。

## fullcone NAT 冲突

部分分支（如 ImmortalWrt）的 `firewall4` 硬依赖 `kmod-nft-fullcone`，启动时会用 `nft -c` 探测 fullcone 表达式，探测本身就会把 `nft_fullcone` 加载进内核。该模块加载后 conntrack 事件不再投递，nlbwmon 计数恒为 0（`conntrack -L` 正常、`conntrack -E` 无事件）。

插件会在页面顶部给出告警，并支持一键处理：

- 关闭 `firewall.fullcone` / `fullcone6`
- 将 `/etc/modules.d/nft-fullcone` 与 `nft_fullcone.ko*` 改名禁用
- 修改前把原文件备份到 `/etc/wrtbwstat/backup/<时间戳>/`，并生成 `restore.sh`；备份失败则不做任何修改
- **不会自动重启**，需要手动重启路由器后生效

代价是不再支持 fullcone NAT（影响 P2P、游戏联机的 NAT 类型）。若希望保留 fullcone，只能放弃本插件的统计功能。

对应的命令行接口：

```sh
ubus call luci.wrtbwstat fix_fullcone '{"confirm":true}'
```

## 开发

### 前端

```sh
cd packages/luci-app-wrtbwstat/frontend
npm ci
npm run dev      # http://localhost:5173，使用 mock 数据
npm run build    # 产物写入 ../htdocs/luci-static/resources/wrtbwstat/
npm run verify   # jsdom 挂载断言 + 体积检查
```

构建机（OpenWrt SDK）不执行 npm，只使用仓库中已提交的 `app.js` / `app.css`。改动前端后需重新 `build` 并提交产物。

### 后端测试

```sh
sh tests/run-backend-tests.sh
# Docker Hub 不可用时：
IMAGE=docker.1panel.live/openwrt/rootfs:x86-64 sh tests/run-backend-tests.sh
```

在 OpenWrt rootfs 容器内用 mock `nlbw` 跑固定流量数据，覆盖聚合、排序、缓存、设置校验、清库与 fullcone 修复的备份/恢复。

### 打包

```sh
sh scripts/build-in-sdk.sh ~/sdk/openwrt-sdk-25.12   # SDK 出包（.apk）
sh scripts/build-in-sdk.sh ~/sdk/openwrt-sdk-24.10   # SDK 出包（.ipk）
sh scripts/pack-ipk.sh                               # 手工 ipk
sh scripts/pack-apk.sh                               # 手工 apk（需 apk-tools 3）
```

两个包都是 `PKGARCH:=all` 的脚本/配置包，apk 与 ipk 内容一致，仅封装格式不同。SDK 出应用包需要完整 buildroot 或带 `libucode` 头文件的 staging_dir，详见脚本注释。

## 目录结构

```text
.
├── packages/
│   ├── wrtbwstat/               # 数据面配置包：nlbwmon 日账期基线、sysctl、uci-defaults
│   └── luci-app-wrtbwstat/      # 应用包：菜单 / ACL / view / 预编译前端 / ucode 后端
│       ├── frontend/            # Vue 3 源码（不装入设备）
│       ├── htdocs/              # LuCI 静态资源（app.js / app.css / overview.js）
│       └── root/                # rpcd ucode 后端、acl.d、menu.d
├── tests/backend/              # 容器内后端验证脚本与断言
├── scripts/                    # 打包与部署脚本
└── doc/                        # 设计文档
```

## 排错

| 现象 | 处理 |
| --- | --- |
| 页面空白 / `ubus list` 无 `luci.wrtbwstat` | `/etc/init.d/rpcd reload`，清理 `/tmp/luci-indexcache.*` |
| 统计一直为 0 | 检查 fullcone 告警；确认 `nlbwmon` 在运行 |
| 重启后历史丢失 | `storage_dir` 指向了 tmpfs，改为持久化磁盘 |
| 提示 nlbw 缺失 | 安装 `nlbwmon`（`apk add nlbwmon` / `opkg install nlbwmon`） |

## 许可

[Apache-2.0](LICENSE)
