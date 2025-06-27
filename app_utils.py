from flask import jsonify
import requests
import yaml

STREAM_TEXT_LIST_URL = "https://raw.githubusercontent.com/1-stream/1stream-public-utils/refs/heads/main/stream.text.list"

class QuotedString(str):
    pass

def quoted_presenter(dumper, data):
    return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='"')

yaml.add_representer(QuotedString, quoted_presenter)

def _extract_and_validate_common_params(request_data):
    if not request_data:
        return None, None, None, (jsonify({"error": "无效的请求：需要 JSON 数据。"}), 400)

    ipv4_address = request_data.get('ipv4', '').strip()
    ipv6_address = request_data.get('ipv6', '').strip()

    if not ipv4_address and not ipv6_address:
        return None, None, None, (jsonify({"error": "无效的请求：必须提供 IPv4 或 IPv6 地址中的至少一个。"}), 400)

    selected_domains = request_data.get('selected_domains', [])

    if not isinstance(selected_domains, list):
        return None, None, None, (jsonify({"error": "无效的请求：'selected_domains' 必须是一个列表。"}), 400)
    
    return ipv4_address, ipv6_address, selected_domains, None

def _generate_adguard_domain_rules(domain, ipv4_address, ipv6_address):
    rules = []
    if domain:
        if ipv4_address:
            rules.append(f"||{domain}^$dnsrewrite=NOERROR;A;{ipv4_address}")
        if ipv6_address:
            rules.append(f"||{domain}^$dnsrewrite=NOERROR;AAAA;{ipv6_address}")
    return rules

def _generate_dnsmasq_domain_rules(domain, ipv4_address, ipv6_address):
    rules = []
    if domain:
        if ipv4_address:
            rules.append(f"server=/{domain}/{ipv4_address}")
        if ipv6_address:
            rules.append(f"server=/{domain}/{ipv6_address}")
    return rules

def _generate_smardns_domain_rules(domain, ipv4_address, ipv6_address):
    rules = []
    if domain:
        if ipv4_address:
            rules.append(f"nameserver /{domain}/proxy_ipv4")
        if ipv6_address:
            rules.append(f"nameserver /{domain}/proxy_ipv6")
    return rules

def _fetch_content(url):
    print(f"正在从 {url} 获取内容...")
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        print("获取内容成功。")
        return response.text.splitlines()
    except requests.exceptions.RequestException as e:
        print(f"错误：无法获取 URL 内容: {e}")
        raise

def _generate_sniproxy_config(url, selected_domains=None, enable_alice_socks=False, allow_all_hosts=False):
    try:
        config_data = {
            'listen_addr': QuotedString(":443"),
        }

        if enable_alice_socks:
            config_data['enable_socks5'] = True
            config_data['socks_addr'] = QuotedString("[2a14:67c0:118::1]:35000")
            config_data['socks_username'] = "alice"
            config_data['socks_password'] = "alice..MVM"

        if allow_all_hosts:
            config_data['allow_all_hosts'] = True
        else:
            domains_to_use = []
            if selected_domains is not None and isinstance(selected_domains, list) and selected_domains:
                print(f"使用提供的 {len(selected_domains)} 个选定域名 (Web)...")
                domains_to_use = selected_domains
            else:
                print("未提供选定域名，将从 URL 获取所有域名 (Web)...")
                lines = _fetch_content(url)
                print("正在提取所有域名 (Web)...")
                domains_to_use = [line.strip() for line in lines if line.strip() and not line.strip().startswith('#')]
                print(f"提取到 {len(domains_to_use)} 个域名 (Web)。")
            config_data['rules'] = domains_to_use

        print("正在生成 YAML 配置字符串 (Web)...")
        yaml_string = yaml.dump(config_data, sort_keys=False, allow_unicode=True, default_flow_style=False)

        print("成功生成 YAML 配置字符串 (Web)。")
        return yaml_string

    except requests.exceptions.RequestException as e:
        print(f"错误：无法获取 URL 内容 (Web): {e}")
        raise ConnectionError(f"无法获取上游列表内容: {e}")
    except Exception as e:
        print(f"发生意外错误 (Web): {e}")
        raise RuntimeError(f"生成 config YAML 时发生意外错误: {e}")

def _generate_xray_domain_list(selected_domains):
    if not selected_domains:
        return ""
    
    rules = [f"domain:{domain}" for domain in selected_domains]
    return ",".join(rules)

def _parse_stream_text_list(content):
    import re
    categories_list = []
    current_major_category_obj = None
    current_minor_category_obj = None

    major_regex = re.compile(r'^#\s*-+\s*>\s*(.+)')
    minor_regex = re.compile(r'^#\s*>\s*(.+)')

    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue

        major_match = major_regex.match(line)
        minor_match = minor_regex.match(line)

        if major_match:
            major_name = major_match.group(1).strip()
            if major_name == "Global Plaform":
                major_name = "Global Platform"
            current_major_category_obj = {"name": major_name, "minors": []}
            categories_list.append(current_major_category_obj)
            current_minor_category_obj = None
        elif minor_match and current_major_category_obj is not None:
             if not major_match:
                minor_name = minor_match.group(1).strip()
                current_minor_category_obj = {"name": minor_name, "domains": []}
                current_major_category_obj["minors"].append(current_minor_category_obj)
        elif current_major_category_obj is not None and current_minor_category_obj is not None and not line.startswith('#'):
            if '.' in line and ' ' not in line:
                current_minor_category_obj["domains"].append(line)

    filtered_list = []
    for major_cat in categories_list:
        filtered_minors = [minor_cat for minor_cat in major_cat["minors"] if minor_cat["domains"]]
        if filtered_minors:
            major_cat["minors"] = filtered_minors
            filtered_list.append(major_cat)
            
    return filtered_list

def _get_alice_whitelist_domains():
    try:
        content = "\n".join(_fetch_content(STREAM_TEXT_LIST_URL))
        structured_data = _parse_stream_text_list(content)

        target_major_categories = [
            "Taiwan Media", "Japan Media", "Hong Kong Media", "AI Platform"
        ]
        global_platform_specific_minors = [
            "DAZN", "Hotstar", "Disney+", "Netflix", "Amazon Prime Video:",
            "TVBAnywhere+", "Viu.com", "Tiktok"
        ]

        alice_domains = set()

        for major_cat in structured_data:
            if major_cat['name'] in target_major_categories:
                for minor_cat in major_cat['minors']:
                    for domain in minor_cat['domains']:
                        alice_domains.add(domain)
            elif major_cat['name'] == "Global Platform":
                for minor_cat in major_cat['minors']:
                    if minor_cat['name'] in global_platform_specific_minors:
                        for domain in minor_cat['domains']:
                            alice_domains.add(domain)
                            
        return sorted(list(alice_domains))
    except Exception as e:
        print(f"在获取Alice白名单域名时发生错误: {e}")
        return []
