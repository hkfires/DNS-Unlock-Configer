# DNS 解锁配置生成器

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

不想自己部署的可以直接访问 [dnsconfig.072899.xyz](https://dnsconfig.072899.xyz/) 使用

## 功能简介

本项目用于生成流媒体服务 DNS 解锁所需的配置文件，支持多种 DNS 服务器和代理工具：

- **AdGuard Home** - 生成 DNS 重写规则
- **Dnsmasq** - 生成域名地址规则
- **SmartDNS** - 生成域名分流规则
- **SNIProxy** - 生成 SNI 代理配置
- **Xray** - 生成域名规则列表
- **Sing-box** - 生成域名后缀列表

## 部署方式

### Docker Compose 部署（推荐）

```bash
git clone https://github.com/NFFoX/DNS-Unlock-Configer.git
cd DNS-Unlock-Configer
docker compose up -d
```

服务将在 `http://localhost:5000` 启动。

### Gunicorn 部署

```bash
# 安装依赖
pip install -r requirements.txt

# 使用 Gunicorn 启动（4 worker, 2 threads）
gunicorn --workers 4 --threads 2 --bind 0.0.0.0:5000 app:app
```

## 配置说明

### AdGuard Home 配置

在 Web 界面选择要解锁的流媒体分类，填入代理服务器的 IP 地址：

| 参数 | 说明 | 示例 |
|------|------|------|
| IPv4 地址 | 代理服务器的 IPv4 地址 | `1.2.3.4` |
| IPv6 地址 | 代理服务器的 IPv6 地址（可选） | `2001:db8::1` |
| 选择域名 | 选择要解锁的流媒体平台 | Netflix、Disney+ 等 |

生成的配置示例：
```
||netflix.com^$dnsrewrite=NOERROR;A;1.2.3.4
||disneyplus.com^$dnsrewrite=NOERROR;A;1.2.3.4
```

将生成的规则添加到 AdGuard Home 的 **DNS 重写** 规则中。

### Dnsmasq 配置

生成适用于 Dnsmasq 的域名转发规则：

```
no-resolv
server=1.0.0.1
server=8.8.8.8
cache-size=2048
local-ttl=60
listen-address=127.0.0.1

server=/netflix.com/1.2.3.4
server=/disneyplus.com/1.2.3.4
```

### SmartDNS 配置

生成适用于 SmartDNS 的配置文件：

```
bind [::]:53
server 1.0.0.1
server 8.8.8.8
server 1.2.3.4 -group proxy_ipv4 -exclude-default-group
cache-size 32768
cache-persist yes

nameserver /netflix.com/proxy_ipv4
nameserver /disneyplus.com/proxy_ipv4
```

### SNIProxy 配置

生成 SNIProxy 配置文件（YAML 格式）：

```yaml
listen_addr: ":443"
rules:
  - netflix.com
  - disneyplus.com
```

### Xray 域名列表

生成 Xray 可用的域名规则列表：

```
domain:netflix.com,domain:disneyplus.com,domain:primevideo.com
```

可用于 Xray 的 `routing.rules` 中的 `domain` 字段。

### Sing-box 域名列表

生成 Sing-box 可用的域名后缀列表：

```json
"domain_suffix": [
  "netflix.com",
  "disneyplus.com",
  "primevideo.com"
]
```

可用于 Sing-box 的路由规则配置。

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/get_categories` | GET | 获取可用的流媒体分类列表 |
| `/api/generate_adguard_config` | POST | 生成 AdGuard Home 配置 |
| `/api/generate_dnsmasq_config` | POST | 生成 Dnsmasq 配置 |
| `/api/generate_smartdns_config` | POST | 生成 SmartDNS 配置 |
| `/api/generate_sniproxy_config` | GET/POST | 生成 SNIProxy 配置 |
| `/api/generate_xray_config` | POST | 生成 Xray 域名列表 |
| `/api/generate_singbox_config` | POST | 生成 Sing-box 域名列表 |
| `/api/get_alice_whitelist` | GET | 获取 Alice 白名单域名 |

## SNIProxy 一键安装

项目包含 `install_sniproxy.sh` 脚本，可在 Linux 服务器上一键安装 SNIProxy：

```bash
bash install_sniproxy.sh
```

脚本会自动：
- 检测系统架构（支持 amd64/arm64）
- 从 GitHub 下载最新版 SNIProxy
- 从 API 获取配置文件
- 创建 systemd 服务
- 启动服务并设置开机自启

## 许可证

本项目采用 [MIT License](LICENSE) 开源协议。