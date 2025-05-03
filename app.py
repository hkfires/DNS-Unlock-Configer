from flask import Flask, request, jsonify, render_template_string, send_from_directory
import process_streamlist
import os

STREAM_LIST_URL = "https://raw.githubusercontent.com/1-stream/1stream-public-utils/refs/heads/main/stream.list"
STREAM_TEXT_LIST_URL = "https://raw.githubusercontent.com/1-stream/1stream-public-utils/refs/heads/main/stream.text.list"

app = Flask(__name__)

@app.route('/')
def index():
    try:
        return send_from_directory('.', 'index.html')
    except FileNotFoundError:
        return "Error: index.html not found. Please create it first.", 404

@app.route('/api/generate_stream_list', methods=['POST'])
def api_generate_stream_list():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "无效的请求：需要 JSON 数据。"}), 400

        ipv4_address = data.get('ipv4', '').strip()
        ipv6_address = data.get('ipv6', '').strip()

        if not ipv4_address and not ipv6_address:
            return jsonify({"error": "无效的请求：必须提供 IPv4 或 IPv6 地址中的至少一个。"}), 400

        ipv4_param = ipv4_address if ipv4_address else None
        ipv6_param = ipv6_address if ipv6_address else None

        result_string = process_streamlist.process_stream_list_web(
            STREAM_LIST_URL,
            ipv4_address=ipv4_param,
            ipv6_address=ipv6_param
        )
        return jsonify({"config": result_string})

    except ValueError as e:
        return jsonify({"error": f"输入错误: {e}"}), 400
    except ConnectionError as e:
         return jsonify({"error": f"网络错误: {e}"}), 500
    except RuntimeError as e:
         return jsonify({"error": f"处理错误: {e}"}), 500
    except Exception as e:
        print(f"发生意外服务器错误: {e}")
        return jsonify({"error": "生成 stream list 配置时发生内部服务器错误。"}), 500

@app.route('/api/generate_config_yaml', methods=['GET', 'POST'])
def api_generate_config_yaml():
    try:
        result_string = process_streamlist.generate_config_yaml_web(
            STREAM_TEXT_LIST_URL
        )
        return jsonify({"config": result_string})

    except ConnectionError as e:
         return jsonify({"error": f"网络错误: {e}"}), 500
    except RuntimeError as e:
         return jsonify({"error": f"处理错误: {e}"}), 500
    except Exception as e:
        print(f"发生意外服务器错误: {e}")
        return jsonify({"error": "生成 config.yaml 配置时发生内部服务器错误。"}), 500

if __name__ == '__main__':
    try:
        import flask
    except ImportError:
        print("错误：找不到 Flask 模块。")
        print("请先安装 Flask： pip install Flask")
        exit(1)

    print("启动 Flask 服务器...")
    print("请在浏览器中访问 http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
