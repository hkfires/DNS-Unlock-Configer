import requests
import re
import sys
import ipaddress
import argparse
import yaml

def is_valid_ipv6(ip_str):
    try:
        ipaddress.IPv6Address(ip_str)
        return True
    except ipaddress.AddressValueError:
        return False

def fetch_content(url):
    print(f"正在从 {url} 获取内容...")
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        print("获取内容成功。")
        return response.text.splitlines()
    except requests.exceptions.RequestException as e:
        print(f"错误：无法获取 URL 内容: {e}")
        sys.exit(1)

def process_stream_list(url, output_filename):
    try:
        ipv4_address = input("请输入要用于 dnsrewrite 的 IPv4 地址 (必需): ")
        if not re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", ipv4_address):
            print("错误：输入的 IPv4 地址格式无效。")
            sys.exit(1)

        ipv6_address_input = input("请输入要用于 dnsrewrite 的 IPv6 地址 (可选, 直接回车跳过): ").strip()
        ipv6_address = None
        if ipv6_address_input:
            if is_valid_ipv6(ipv6_address_input):
                ipv6_address = ipv6_address_input
            else:
                 print("错误：输入的 IPv6 地址格式无效。")
                 sys.exit(1)
        else:
            print("未提供 IPv6 地址，将跳过生成 AAAA 记录。")

        lines = fetch_content(url)
        processed_lines = []
        pattern = re.compile(r'^~(.*);$')

        print("正在处理 stream.list 内容...")
        for line in lines:
            match = pattern.match(line)
            if match:
                extracted_regex = match.group(1)
                new_line_v4 = f'/{extracted_regex}/$dnsrewrite=NOERROR;A;{ipv4_address}'
                processed_lines.append(new_line_v4)

                if ipv6_address:
                    new_line_v6 = f'/{extracted_regex}/$dnsrewrite=NOERROR;AAAA;{ipv6_address}'
                    processed_lines.append(new_line_v6)
            else:
                processed_lines.append(line)
        print("处理完成。")

        print(f"正在将结果写入 {output_filename}...")
        with open(output_filename, 'w', encoding='utf-8') as f:
            for line in processed_lines:
                f.write(line + '\n')
        print(f"成功将结果写入 {output_filename}。")

    except IOError as e:
        print(f"错误：无法写入文件 {output_filename}: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"发生意外错误: {e}")
        sys.exit(1)

def generate_config_yaml(url, output_filename="config.yaml"):
    try:
        lines = fetch_content(url)
        print("正在提取域名...")
        domains = [line.strip() for line in lines if line.strip() and not line.strip().startswith('#')]
        print(f"提取到 {len(domains)} 个域名。")

        config_data = {
            'listen_addr': ':443',
            'rules': domains
        }

        print(f"正在将配置写入 {output_filename}...")
        with open(output_filename, 'w', encoding='utf-8') as f:
            yaml.dump(config_data, f, sort_keys=False, allow_unicode=True, default_flow_style=False)

        print(f"正在为 {output_filename} 添加注释...")
        with open(output_filename, 'r+', encoding='utf-8') as f:
            content = f.read()
            f.seek(0, 0)
            content = content.replace("listen_addr:", "# 监听端口（注意需要引号）\nlisten_addr:")
            content = content.replace("rules:", "# 可选：仅允许指定域名\nrules:")
            comment_block = """
# 可选：启用 Socks5 前置代理
#enable_socks5: true
# 可选：配置 Socks5 代理地址
#socks_addr: 127.0.0.1:40000
# 可选：允许所有域名（会忽略下面的 rules 列表）
# allow_all_hosts: true
"""
            lines = content.splitlines()
            insert_point = -1
            for i, line in enumerate(lines):
                if line.strip().startswith("listen_addr:"):
                    insert_point = i + 1
                    break
            if insert_point != -1:
                 final_content = "\n".join(lines[:insert_point]) + comment_block + "\n".join(lines[insert_point:])
            else:
                 final_content = comment_block + content
            f.write(final_content)

        print(f"成功生成并写入 {output_filename}。")

    except IOError as e:
        print(f"错误：无法写入文件 {output_filename}: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"发生意外错误: {e}")
        sys.exit(1)

def process_stream_list_web(url, ipv4_address=None, ipv6_address=None):
    try:
        if not ipv4_address and not ipv6_address:
            raise ValueError("必须提供 IPv4 或 IPv6 地址中的至少一个。")

        if ipv4_address and not re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", ipv4_address):
            raise ValueError("提供的 IPv4 地址格式无效。")
        if ipv6_address and not is_valid_ipv6(ipv6_address):
             raise ValueError("提供的 IPv6 地址格式无效。")

        lines = fetch_content(url)
        processed_lines = []
        pattern = re.compile(r'^~(.*);$')

        print("正在处理 stream.list 内容 (Web)...")
        for line in lines:
            match = pattern.match(line)
            if match:
                extracted_regex = match.group(1)
                if ipv4_address:
                    new_line_v4 = f'/{extracted_regex}/$dnsrewrite=NOERROR;A;{ipv4_address}'
                    processed_lines.append(new_line_v4)
                if ipv6_address:
                    new_line_v6 = f'/{extracted_regex}/$dnsrewrite=NOERROR;AAAA;{ipv6_address}'
                    processed_lines.append(new_line_v6)
            else:
                processed_lines.append(line)
        print("处理完成 (Web)。")

        if (ipv4_address or ipv6_address) and not any(l.startswith('/') for l in processed_lines if l not in lines):
             print("警告：提供了 IP 地址，但似乎没有生成任何 DNS Rewrite 规则。请检查 stream.list 格式。")

        return "\n".join(processed_lines)

    except requests.exceptions.RequestException as e:
        print(f"错误：无法获取 URL 内容 (Web): {e}")
        raise ConnectionError(f"无法获取上游列表内容: {e}")
    except ValueError as e:
        print(f"错误：输入验证失败 (Web): {e}")
        raise
    except Exception as e:
        print(f"发生意外错误 (Web): {e}")
        raise RuntimeError(f"处理 stream list 时发生意外错误: {e}")

def generate_config_yaml_web(url):
    try:
        lines = fetch_content(url)
        print("正在提取域名 (Web)...")
        domains = [line.strip() for line in lines if line.strip() and not line.strip().startswith('#')]
        print(f"提取到 {len(domains)} 个域名 (Web)。")

        config_data = {
            'listen_addr': ':443',
            'rules': domains
        }

        print("正在生成 YAML 配置字符串 (Web)...")
        yaml_string = yaml.dump(config_data, sort_keys=False, allow_unicode=True, default_flow_style=False)

        commented_yaml_string = yaml_string.replace("listen_addr:", "# 监听端口（注意需要引号）\nlisten_addr:", 1)
        commented_yaml_string = commented_yaml_string.replace("rules:", "# 可选：仅允许指定域名\nrules:", 1)

        comment_block = """# 可选：启用 Socks5 前置代理
#enable_socks5: true
# 可选：配置 Socks5 代理地址
#socks_addr: 127.0.0.1:40000
# 可选：允许所有域名（会忽略下面的 rules 列表）
# allow_all_hosts: true
"""
        lines_out = commented_yaml_string.splitlines()
        final_lines = []
        listen_addr_found = False
        for line in lines_out:
            final_lines.append(line)
            if line.strip().startswith("listen_addr:") and not listen_addr_found:
                final_lines.append(comment_block.strip())
                listen_addr_found = True

        if not listen_addr_found:
            final_yaml_string = comment_block + "\n".join(lines_out)
        else:
            final_yaml_string = "\n".join(final_lines)

        print("成功生成 YAML 配置字符串 (Web)。")
        return final_yaml_string

    except requests.exceptions.RequestException as e:
        print(f"错误：无法获取 URL 内容 (Web): {e}")
        raise ConnectionError(f"无法获取上游列表内容: {e}")
    except Exception as e:
        print(f"发生意外错误 (Web): {e}")
        raise RuntimeError(f"生成 config YAML 时发生意外错误: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="处理流媒体列表或生成配置文件。")
    parser.add_argument(
        '--mode',
        choices=['process_stream', 'generate_config'],
        default='process_stream',
        help="选择执行模式: 'process_stream' (处理 stream.list) 或 'generate_config' (生成 config.yaml)。默认为 'process_stream'。"
    )
    args = parser.parse_args()

    if args.mode == 'process_stream':
        STREAM_LIST_URL = "https://raw.githubusercontent.com/1-stream/1stream-public-utils/refs/heads/main/stream.list"
        OUTPUT_FILE = "stream.list"
        process_stream_list(STREAM_LIST_URL, OUTPUT_FILE)
    elif args.mode == 'generate_config':
        STREAM_TEXT_LIST_URL = "https://raw.githubusercontent.com/1-stream/1stream-public-utils/refs/heads/main/stream.text.list"
        OUTPUT_YAML_FILE = "config.yaml"
        generate_config_yaml(STREAM_TEXT_LIST_URL, OUTPUT_YAML_FILE)
