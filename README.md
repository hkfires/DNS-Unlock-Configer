# DNS 解锁配置生成器 (DNS Unlock Config Generator)

## 简介

本项目提供了一套工具，用于方便地生成 DNS 解锁所需的配置，主要包括：

*   适用于 AdGuardHome 等 DNS 服务器的自定义重写规则。
*   适用于 SNIProxy (特别是 [XIU2/SNIProxy](https://github.com/XIU2/SNIProxy)) 的 `config.yaml` 配置文件。

本项目旨在简化根据上游列表和用户自定义解锁服务器 IP 生成配置的过程。

## 功能

*   **Web 用户界面**: 通过简单的网页界面输入 IP 地址，一键生成所需配置。
*   **AdGuardHome 规则生成**: 从指定的 `stream.list` URL 获取规则模板，结合用户提供的 IPv4/IPv6 地址生成 DNS 重写规则。
*   **SNIProxy 配置生成**: 从指定的 `stream.text.list` URL 获取域名列表，生成 SNIProxy 所需的 `config.yaml` 文件。
*   **命令行工具**: 提供 `process_streamlist.py` 脚本，支持在命令行下生成上述两种配置。
*   **SNIProxy 自动部署 (Linux)**: 提供 `install_sniproxy.sh` 脚本，可在 Linux (amd64/arm64) 服务器上自动下载、安装、配置并启动 SNIProxy 服务。

## 使用方法

### 1. Web UI (推荐方式)

这是最简单快捷的使用方式。

1.  **安装依赖**:
    ```bash
    pip install -r requirements.txt
    ```
2.  **运行 Web 服务器**:
    ```bash
    python app.py
    ```
    服务器默认运行在 `0.0.0.0:5000`。
3.  **访问界面**:
    在浏览器中打开 `http://<你的服务器IP>:5000` (如果在本地运行，则是 `http://127.0.0.1:5000`)。
4.  **生成配置**:
    *   在输入框中填入你的解锁服务器的 IPv4 或 IPv6 地址（至少填一个）。
    *   点击 "生成 AdguardHome 自定义规则" 或 "生成 SNIProxy 配置" 按钮。
    *   生成的配置会显示在下方的文本框中。
    *   可以使用 "复制到剪贴板" 或 "下载配置" 按钮获取配置。

### 2. 命令行工具 (`process_streamlist.py`)

如果你需要在脚本中或其他自动化流程中使用。

1.  **安装依赖**:
    ```bash
    pip install -r requirements.txt
    ```
2.  **生成 AdGuardHome 规则**:
    ```bash
    python process_streamlist.py --mode process_stream
    ```
    脚本会提示你输入 IPv4 和 IPv6 地址，并将生成的规则输出到当前目录的 `stream.list` 文件。
3.  **生成 SNIProxy 配置**:
    ```bash
    python process_streamlist.py --mode generate_config
    ```
    脚本会直接从上游列表生成 `config.yaml` 文件到当前目录。

### 3. SNIProxy 自动部署脚本 (`install_sniproxy.sh` - 仅限 Linux)

此脚本用于在 Linux 服务器上快速部署 SNIProxy。

**方法一：手动下载和执行 (推荐，更安全)**

1.  **前置条件**:
    *   确保你的 Linux 服务器是 amd64 或 arm64 架构。
    *   确保服务器已安装 `curl`, `unzip`, `jq`。 (例如: `sudo apt update && sudo apt install -y curl unzip jq`)
    *   你需要先在某处运行 `app.py` Web 服务器 (可以在本机、部署脚本的服务器或其他可访问的机器上)，记下其可访问的 IP 地址和端口。
2.  **下载脚本**:
    ```bash
    # 假设脚本位于项目的根目录，你需要提供其可访问的原始 URL
    # 例如:
    curl -O https://raw.githubusercontent.com/hkfires/DNS-Unlock-Server/main/install_sniproxy.sh
    # 或者:
    # wget https://raw.githubusercontent.com/hkfires/DNS-Unlock-Server/main/install_sniproxy.sh
    ```
3.  **检查并修改脚本**:
    *   使用文本编辑器打开 `install_sniproxy.sh`。
    *   **仔细检查脚本内容确保没有恶意代码。**
4.  **运行脚本**:
    *   赋予脚本执行权限: `chmod +x install_sniproxy.sh`
    *   以 root 权限运行: `sudo bash install_sniproxy.sh`

**方法二：通过网络一键执行 (便捷但风险高)**

⚠️ **警告：** 此方法直接从网络下载脚本并以 root 权限执行，存在严重安全风险。请仅在完全信任脚本来源且了解潜在风险的情况下使用。脚本将使用预设的 API 地址获取配置。

1.  **前置条件**:
    *   同方法一。
2.  **执行命令**:
    ```bash
    # 假设脚本位于项目的根目录，你需要提供其可访问的原始 URL
    # 例如:
    curl -sSL https://raw.githubusercontent.com/hkfires/DNS-Unlock-Server/main/install_sniproxy.sh | sudo bash
    ```

## 配置文件来源

本工具依赖以下上游列表：

*   DNS 重写规则模板: `https://raw.githubusercontent.com/1-stream/1stream-public-utils/refs/heads/main/stream.list`
*   SNIProxy 域名列表: `https://raw.githubusercontent.com/1-stream/1stream-public-utils/refs/heads/main/stream.text.list`
