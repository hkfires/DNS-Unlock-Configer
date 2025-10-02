# 使用官方 Python 运行时作为父镜像
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY requirements.txt .

# 安装依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制项目文件
COPY . .

# 暴露端口
EXPOSE 5000

# 运行 Gunicorn 服务器
CMD ["gunicorn", "--workers", "4", "--threads", "2", "--bind", "0.0.0.0:5000", "app:app"]