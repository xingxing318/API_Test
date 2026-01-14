# Repository Guidelines

## 项目结构与模块组织
- `index.html` 与 `styles.css`：前端页面与样式入口。
- `app/`：前端核心逻辑与模块化代码（`main.js` 入口；`net/` 请求；`ui/` 组件；`storage/` 本地存储；`util/` 工具；`providers.js` 默认提供商配置）。
- `proxy/`：本地代理服务（`server.mjs`），用于绕过浏览器 CORS。
- `docker/` 与 `docker-compose.yml`：容器化运行配置。
- 文档：`产品PRD.md`、`开发TODO.md`。

## 构建、测试与本地开发命令
- `python -m http.server 5173`：启动静态站点，访问 `http://127.0.0.1:5173`。
- `node proxy/server.mjs`：启动本地代理（默认 `http://127.0.0.1:8787`）。
- `docker compose up -d --build`：构建并后台运行前端+代理。
- `docker compose down`：停止并清理容器。
- `WEB_PORT=15173 PROXY_PORT=18787 docker compose up -d --build`：自定义端口启动。

## 编码风格与命名约定
- JavaScript 使用 ES Modules（`import/export`），2 空格缩进，末尾分号风格。
- 文件命名以小写和短词为主（如 `main.js`、`providers.js`）；目录按职责划分（`ui/`、`net/`、`storage/`）。
- 当前未看到专用格式化或 lint 工具；如新增，保持与现有风格一致。

## 测试指南
- 目前未提供自动化测试框架或测试目录。
- 若引入测试，建议在 `app/` 旁新增 `tests/` 并采用清晰命名（如 `request.spec.js`），同时在 README 补充运行命令。

## 提交与 Pull Request 指南
- 本仓库未发现 Git 历史记录，暂无既定提交规范。
- 建议使用简洁的英文或中英文提交标题（例：`feat: add proxy health check`）。
- PR 描述建议包含：变更动机、影响范围、手动验证步骤；涉及 UI 变更可附截图。

## 安全与配置提示
- 本地代理不做鉴权，仅建议在本机使用，不要暴露公网。
- 代理端口可通过环境变量 `PORT`（或 docker 的 `PROXY_PORT`）调整。
