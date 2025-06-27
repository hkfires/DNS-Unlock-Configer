from flask import Flask, request, jsonify, send_from_directory
import requests, re
from app_utils import _extract_and_validate_common_params, _generate_adguard_domain_rules, _generate_dnsmasq_domain_rules, _generate_smardns_domain_rules, _generate_sniproxy_config, _generate_xray_domain_list, _parse_stream_text_list, _get_alice_whitelist_domains, STREAM_TEXT_LIST_URL

app = Flask(__name__)

@app.route('/')
def index():
    try:
        return send_from_directory('web', 'index.html')
    except FileNotFoundError:
        return "Error: web/index.html not found.", 404

@app.route('/<path:filename>')
def serve_web_files(filename):
    try:
        return send_from_directory('web', filename)
    except FileNotFoundError:
        return "Error: File not found in web directory.", 404

@app.route('/api/generate_adguard_config', methods=['POST'])
def api_generate_adguard_config():
    try:
        data = request.get_json()
        ipv4_address, ipv6_address, selected_domains, error_response = _extract_and_validate_common_params(data)
        
        if error_response:
            return error_response

        rules = []
        for domain in selected_domains:
            rules.extend(_generate_adguard_domain_rules(domain, ipv4_address, ipv6_address))

        result_string = "\n".join(rules)
        return jsonify({"config": result_string})

    except Exception as e:
        print(f"Error in /api/generate_adguard_config: {e}")
        return jsonify({"error": "生成 AdGuard Home 规则时发生内部服务器错误。"}), 500

@app.route('/api/generate_dnsmasq_config', methods=['POST'])
def api_generate_dnsmasq_config():
    try:
        data = request.get_json()
        ipv4_address, ipv6_address, selected_domains, error_response = _extract_and_validate_common_params(data)

        if error_response:
            return error_response

        rules = [
            "no-resolv",
        ]

        if ipv4_address:
            rules.extend(["server=1.0.0.1", "server=8.8.8.8"])
        if ipv6_address:
            rules.extend(["server=2606:4700:4700::1001", "server=2001:4860:4860::8888"])

        rules.extend([
            "cache-size=2048",
            "local-ttl=60",
            "listen-address=127.0.0.1",
            ""
        ])
        for domain in selected_domains:
            rules.extend(_generate_dnsmasq_domain_rules(domain, ipv4_address, ipv6_address))

        result_string = "\n".join(rules) + "\n"
        return jsonify({"config": result_string})

    except Exception as e:
        print(f"Error in /api/generate_dnsmasq_config: {e}")
        return jsonify({"error": "生成 Dnsmasq 规则时发生内部服务器错误。"}), 500

@app.route('/api/generate_smartdns_config', methods=['POST'])
def api_generate_smartdns_config():
    try:
        data = request.get_json()
        ipv4_address, ipv6_address, selected_domains, error_response = _extract_and_validate_common_params(data)

        if error_response:
            return error_response

        rules = [
            "bind [::]:53",
        ]

        if ipv4_address:
            rules.extend(["server 1.0.0.1", "server 8.8.8.8"])
        if ipv6_address:
            rules.extend(["server 2606:4700:4700::1001", "server 2001:4860:4860::8888"])

        rules.extend([
            "cache-size 32768",
            "cache-persist yes",
            "cache-file /etc/smartdns/cache/file",
            ""
        ])
        for domain in selected_domains:
            rules.extend(_generate_smardns_domain_rules(domain, ipv4_address, ipv6_address))

        result_string = "\n".join(rules) + "\n"
        return jsonify({"config": result_string})

    except Exception as e:
        print(f"Error in /api/generate_smartdns_config: {e}")
        return jsonify({"error": "生成 SmartDNS 规则时发生内部服务器错误。"}), 500

@app.route('/api/generate_sniproxy_config', methods=['GET', 'POST'])
def api_generate_sniproxy_config():
    selected_domains = None
    enable_alice_socks = False
    if request.method == 'POST':
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "无效的请求：需要 JSON 数据。"}), 400

            selected_domains = data.get('selected_domains')
            enable_alice_socks = data.get('enable_alice_socks', False)

            if selected_domains is None:
                 return jsonify({"error": "无效的请求：请求体中缺少 'selected_domains' 字段。"}), 400
            if not isinstance(selected_domains, list):
                return jsonify({"error": "无效的请求：'selected_domains' 必须是一个列表。"}), 400
            if not selected_domains:
                 return jsonify({"error": "无效的请求：'selected_domains' 列表不能为空，请至少选择一个分类。"}), 400


        except Exception as e:
            print(f"Error processing POST request for /api/generate_sniproxy_config: {e}")
            return jsonify({"error": "处理请求时发生内部服务器错误。"}), 500

    elif request.method == 'GET':
         print("收到 GET 请求，将生成包含所有域名的配置。")

    try:
        result_string = _generate_sniproxy_config(
            STREAM_TEXT_LIST_URL,
            selected_domains=selected_domains,
            enable_alice_socks=enable_alice_socks
        )
        return jsonify({"config": result_string})
    except ConnectionError as e:
         return jsonify({"error": f"网络错误: {e}"}), 500
    except RuntimeError as e:
         return jsonify({"error": f"处理错误: {e}"}), 500
    except Exception as e:
        print(f"Error in /api/generate_sniproxy_config: {e}")
        return jsonify({"error": "生成 SNIProxy 配置时发生内部服务器错误。"}), 500

@app.route('/api/generate_sniproxy_config_all', methods=['POST'])
def api_generate_sniproxy_config_all():
    try:
        data = request.get_json()
        enable_alice_socks = data.get('enable_alice_socks', False) if data else False

        result_string = _generate_sniproxy_config(
            url=STREAM_TEXT_LIST_URL,
            allow_all_hosts=True,
            enable_alice_socks=enable_alice_socks
        )
        return jsonify({"config": result_string})
    except Exception as e:
        print(f"Error in /api/generate_sniproxy_config_all: {e}")
        return jsonify({"error": "生成 SNIProxy (允许所有) 配置时发生内部服务器错误。"}), 500

@app.route('/api/generate_xray_config', methods=['POST'])
def api_generate_xray_config():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "无效的请求：需要 JSON 数据。"}), 400

        selected_domains = data.get('selected_domains')

        if selected_domains is None:
            return jsonify({"error": "无效的请求：请求体中缺少 'selected_domains' 字段。"}), 400
        if not isinstance(selected_domains, list):
            return jsonify({"error": "无效的请求：'selected_domains' 必须是一个列表。"}), 400
        if not selected_domains:
            return jsonify({"error": "无效的请求：'selected_domains' 列表不能为空，请至少选择一个分类。"}), 400

        result_string = _generate_xray_domain_list(selected_domains)
        return jsonify({"config": result_string})

    except Exception as e:
        print(f"Error in /api/generate_xray_config: {e}")
        return jsonify({"error": "生成 Xray 规则时发生内部服务器错误。"}), 500

@app.route('/api/get_categories', methods=['GET'])
def api_get_categories():
    try:
        response = requests.get(STREAM_TEXT_LIST_URL, timeout=15)
        response.raise_for_status()
        content = response.text
        filtered_list = _parse_stream_text_list(content)
        return jsonify(filtered_list)

    except requests.exceptions.RequestException as e:
        print(f"获取 stream.text.list 时出错: {e}")
        return jsonify({"error": f"无法获取分类列表: {e}"}), 503
    except Exception as e:
        print(f"解析分类时发生意外错误: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "处理分类列表时发生内部服务器错误。"}), 500

@app.route('/api/get_alice_whitelist', methods=['GET'])
def api_get_alice_whitelist():
    try:
        domains = _get_alice_whitelist_domains()
        if not domains:
            return jsonify({"error": "无法生成Alice白名单，请检查上游列表或服务器日志。"}), 500
        return jsonify({"domains": domains})
    except Exception as e:
        print(f"Error in /api/get_alice_whitelist: {e}")
        return jsonify({"error": "生成Alice白名单时发生内部服务器错误。"}), 500

if __name__ == '__main__':
    print("启动 Flask 服务器...")
    print("请在浏览器中访问 http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
