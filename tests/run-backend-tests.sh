#!/bin/sh
# 后端测试总入口：把仓库根挂进 OpenWrt rootfs 容器跑三组验证
#
#   sh tests/run-backend-tests.sh
#
# 镜像默认用官方 openwrt/rootfs:x86-64。国内网络拉不动 Docker Hub 时可换镜像源：
#   IMAGE=docker.1panel.live/openwrt/rootfs:x86-64 sh tests/run-backend-tests.sh
#
# 之所以用 OpenWrt rootfs 而不是 Ubuntu：验证需要真实的 ucode 解释器，
# 以及它自带的 fs / uci 模块。本机（Windows）没有 ucode，容器是最省事的办法。
set -e

cd "$(dirname "$0")/.."
ROOT=$(pwd)
IMAGE=${IMAGE:-openwrt/rootfs:x86-64}

run() {
	desc=$1
	script=$2
	shift 2

	echo
	echo "############################################################"
	echo "# $desc"
	echo "############################################################"

	docker run --rm -v "$ROOT:/work" "$@" "$IMAGE" /bin/sh "$script"
}

status=0

run "后端只读/写阶段（正常模式）" /work/tests/backend/verify.sh || status=1
run "后端 layer7 不可用时的回退分支" /work/tests/backend/verify.sh -e FL_NLBW_BREAK_LAYER7=1 || status=1
run "uci-defaults 落盘行为" /work/tests/backend/test-uci-defaults.sh || status=1

echo
if [ "$status" = "0" ]; then
	echo "全部测试通过。"
else
	echo "存在失败项。"
fi
exit $status
