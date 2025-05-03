#!/bin/bash

SCRIPT_DIR=$(pwd)
BASE_DIR="$SCRIPT_DIR/sniproxy"

API_URL="https://dnsconfig.072899.xyz/api/generate_config_yaml"
INSTALL_DIR="$BASE_DIR"
CONFIG_DIR="$BASE_DIR"
CONFIG_FILE="$CONFIG_DIR/config.yaml"
SERVICE_FILE="/etc/systemd/system/sniproxy.service"
BINARY_NAME="sniproxy" # Correct binary name to lowercase
LOG_FILE="$BASE_DIR/sniproxy.log"

print_info() {
    echo "[INFO] $1"
}

print_error() {
    echo "[ERROR] $1" >&2
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_error "命令 '$1' 未找到。请先安装它 (例如: apt update && apt install -y $1)"
        exit 1
    fi
}

print_info "开始 SNIProxy 安装和配置..."

if [ "$(id -u)" -ne 0 ]; then
   print_error "此脚本需要 root 权限运行。请使用 sudo 或以 root 用户身份运行。"
   exit 1
fi
print_info "Root 权限检查通过。"

print_info "检查依赖项 (curl, unzip, jq)..."
check_command "curl"
check_command "unzip"
check_command "jq"
print_info "所有依赖项已找到。"

print_info "创建工作目录 $BASE_DIR..."
mkdir -p "$BASE_DIR"
if [ $? -ne 0 ]; then
    print_error "创建目录 $BASE_DIR 失败。"
    exit 1
fi

print_info "正在从 GitHub API 获取最新的 SNIProxy 版本..."
SNIPROXY_VERSION=$(curl -sSL "https://api.github.com/repos/XIU2/SNIProxy/releases/latest" | jq -r '.tag_name')

if [ -z "$SNIPROXY_VERSION" ] || [ "$SNIPROXY_VERSION" = "null" ]; then
    print_error "无法从 GitHub API 获取最新版本号。请检查网络或 API 状态。"
    exit 1
fi
print_info "获取到最新版本: $SNIPROXY_VERSION"

ARCH=$(dpkg --print-architecture)
if [ "$ARCH" = "amd64" ] || [ "$ARCH" = "arm64" ]; then
    print_info "检测到系统架构: $ARCH"
else
    print_error "不支持的系统架构: $ARCH。仅支持 amd64 和 arm64。"
    exit 1
fi

# Correct filename format for Linux tar.gz files
TAR_FILENAME="sniproxy_linux_${ARCH}.tar.gz"
DOWNLOAD_URL="https://github.com/XIU2/SNIProxy/releases/download/${SNIPROXY_VERSION}/${TAR_FILENAME}"
TAR_FILE="/tmp/${TAR_FILENAME}"

print_info "正在从 $DOWNLOAD_URL 下载 SNIProxy ${SNIPROXY_VERSION}..."
# Use -fL for better error reporting on download failure
if ! curl -fL "$DOWNLOAD_URL" -o "$TAR_FILE"; then
    print_error "下载 SNIProxy 失败。请检查网络连接、URL 是否有效或 GitHub Releases 状态。"
    exit 1
fi
print_info "下载完成。正在验证文件..."

# Test the downloaded tar.gz file integrity before extracting
# Use tar -tzf to list contents without extracting; exit code indicates validity
if ! tar -tzf "$TAR_FILE" > /dev/null; then
    print_error "下载的文件 $TAR_FILE 无效或已损坏。请尝试重新运行脚本。"
    rm -f "$TAR_FILE"
    exit 1
fi
print_info "文件验证成功。"

print_info "正在解压 $TAR_FILE 到 /tmp..."
EXTRACT_TMP_DIR="/tmp/sniproxy_extract_$$"
mkdir -p "$EXTRACT_TMP_DIR"
# Use tar -xzf to extract
if ! tar -xzf "$TAR_FILE" -C "$EXTRACT_TMP_DIR"; then
    print_error "解压 SNIProxy 失败。"
    rm -f "$TAR_FILE"
    rm -rf "$EXTRACT_TMP_DIR"
    exit 1
fi

# Find the binary within the extracted structure
SNIPROXY_BINARY_PATH=$(find "$EXTRACT_TMP_DIR" -type f -name "$BINARY_NAME" | head -n 1)

if [ -z "$SNIPROXY_BINARY_PATH" ]; then
    print_error "在解压的文件中未找到 $BINARY_NAME 可执行文件。"
    rm -f "$TAR_FILE"
    rm -rf "$EXTRACT_TMP_DIR"
    exit 1
fi

print_info "正在安装 $BINARY_NAME 到 $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
if ! mv "$SNIPROXY_BINARY_PATH" "$INSTALL_DIR/$BINARY_NAME"; then
    print_error "移动 $BINARY_NAME 到 $INSTALL_DIR 失败。"
    rm -f "$TAR_FILE"
    rm -rf "$EXTRACT_TMP_DIR"
    exit 1
fi

print_info "设置执行权限..."
chmod +x "$INSTALL_DIR/$BINARY_NAME"

print_info "清理临时文件..."
rm -f "$TAR_FILE"
rm -rf "$EXTRACT_TMP_DIR"

print_info "SNIProxy 安装成功。"

print_info "配置目录为 $CONFIG_DIR"
mkdir -p "$CONFIG_DIR"

print_info "正在从 $API_URL 获取配置文件..."
YAML_CONTENT=$(curl -sSL "$API_URL" | jq -r '.config')

if [ -z "$YAML_CONTENT" ] || [ "$YAML_CONTENT" = "null" ]; then
    print_error "从 API 获取配置失败或返回内容为空。请检查 API 是否正常工作。"
    print_info "尝试获取原始 API 响应:"
    curl -sSL "$API_URL"
    exit 1
fi

print_info "正在写入配置文件 $CONFIG_FILE..."
echo "$YAML_CONTENT" > "$CONFIG_FILE"
if [ $? -ne 0 ]; then
    print_error "写入配置文件 $CONFIG_FILE 失败。"
    exit 1
fi
print_info "配置文件写入成功。"

print_info "创建 systemd 服务文件 $SERVICE_FILE..."
cat << EOF > "$SERVICE_FILE"
[Unit]
Description=SNI Proxy
After=network.target

[Service]
ExecStart=$INSTALL_DIR/$BINARY_NAME -c $CONFIG_FILE -l $LOG_FILE
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

if [ $? -ne 0 ]; then
    print_error "创建 systemd 服务文件失败。"
    exit 1
fi
print_info "Systemd 服务文件创建成功。"

print_info "重新加载 systemd 配置..."
systemctl daemon-reload

print_info "设置 SNIProxy 服务开机自启..."
systemctl enable sniproxy

print_info "启动 SNIProxy 服务..."
systemctl start sniproxy

print_info "检查 SNIProxy 服务状态:"
sleep 2
systemctl status sniproxy --no-pager -l

if [ $? -eq 0 ]; then
    print_info "SNIProxy 安装和配置完成！服务正在运行。"
else
    print_error "SNIProxy 服务启动失败或状态异常。请检查上面的日志输出。"
    exit 1
fi

exit 0
