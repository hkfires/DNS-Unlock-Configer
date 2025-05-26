from flask import Flask, request, jsonify, send_from_directory
import requests, re
from app_utils import _extract_and_validate_common_params, _generate_adguard_domain_rules, _generate_dnsmasq_domain_rules, _generate_sniproxy_config

STREAM_TEXT_LIST_URL = "https://raw.githubusercontent.com/1-stream/1stream-public-utils/refs/heads/main/stream.text.list"

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
            "server=1.0.0.1",
            "server=8.8.8.8",
            "cache-size=2048",
            "local-ttl=60",
            "listen-address=127.0.0.1",
            ""
        ]
        for domain in selected_domains:
            rules.extend(_generate_dnsmasq_domain_rules(domain, ipv4_address, ipv6_address))

        result_string = "\n".join(rules)
        return jsonify({"config": result_string})

    except Exception as e:
        print(f"Error in /api/generate_dnsmasq_config: {e}")
        return jsonify({"error": "生成 Dnsmasq 规则时发生内部服务器错误。"}), 500

@app.route('/api/generate_sniproxy_config', methods=['GET', 'POST'])
def api_generate_sniproxy_config():
    selected_domains = None
    if request.method == 'POST':
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


        except Exception as e:
            print(f"Error processing POST request for /api/generate_sniproxy_config: {e}")
            return jsonify({"error": "处理请求时发生内部服务器错误。"}), 500

    elif request.method == 'GET':
         print("收到 GET 请求，将生成包含所有域名的配置。")

    try:
        result_string = _generate_sniproxy_config(
            STREAM_TEXT_LIST_URL,
            selected_domains=selected_domains
        )
        return jsonify({"config": result_string})
    except ConnectionError as e:
         return jsonify({"error": f"网络错误: {e}"}), 500
    except RuntimeError as e:
         return jsonify({"error": f"处理错误: {e}"}), 500
    except Exception as e:
        print(f"Error in /api/generate_sniproxy_config: {e}")
        return jsonify({"error": "生成 SNIProxy 配置时发生内部服务器错误。"}), 500

@app.route('/api/get_categories', methods=['GET'])
def api_get_categories():
    try:
        response = requests.get(STREAM_TEXT_LIST_URL, timeout=15)
        response.raise_for_status()
        content = response.text

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

        return jsonify(filtered_list)

    except requests.exceptions.RequestException as e:
        print(f"获取 stream.text.list 时出错: {e}")
        return jsonify({"error": f"无法获取分类列表: {e}"}), 503
    except Exception as e:
        print(f"解析分类时发生意外错误: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "处理分类列表时发生内部服务器错误。"}), 500

if __name__ == '__main__':
    print("启动 Flask 服务器...")
    print("请在浏览器中访问 http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
