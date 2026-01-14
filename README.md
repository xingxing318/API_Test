# API 连通性测试器（HTML 小应用）

## 功能概览
- 支持多家厂商/中转平台的 API 连通性测试与模型列表拉取。
- 数字卡片：保存常用配置（不含 API Key），支持新增/编辑/删除/清空，点击卡片一键回填表单。
- 常用模型：维护常用模型名称，点击即可填充并复制到剪贴板。

## 运行（推荐）
1) 在项目根目录启动静态站点：

```bash
python -m http.server 5173
```

2) 浏览器打开：`http://127.0.0.1:5173`

## 若遇到 CORS（推荐开启本地代理）
1) 启动代理：

```bash
node proxy/server.mjs
```

2) 页面中将“连接方式”切换为“本地代理”，代理地址填 `http://127.0.0.1:8787`

## Docker 运行（本机部署）
1) 启动（首次会自动构建镜像）：

```bash
docker compose up -d --build
```

2) 访问：
- 页面：`http://127.0.0.1:5173`
- 代理健康检查：`http://127.0.0.1:8787/health`

3) 停止：

```bash
docker compose down
```

如端口被占用，可临时改端口启动：

```bash
WEB_PORT=15173 PROXY_PORT=18787 docker compose up -d --build
```

## 配置与价格表
- 配置页支持直接编辑 Provider JSON 并保存到本地（含 `pricing` / `pricingTable`）。
- 可导入/导出 Provider 覆盖配置（JSON）。

## 本地数据说明
- 数字卡片与常用模型使用浏览器本地存储（localStorage），不会上传服务器。
