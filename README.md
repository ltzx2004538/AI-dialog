# AI dialog · Dialogue Board

一个在本机运行的台词管理网页，用来写和润色**里昂（Leon S. Kennedy）与艾达（Ada Wong）**的电影化对白（场景里也可以有其他角色）。每句台词同时保存中文和英文，可以调用大模型（LLM）润色单句，或者预测接下来的几句。

## 功能

- **场景和台词**：按场景管理台词，每句台词有固定编号（`L001`、`L002`……），支持编辑、删除，以及"背景介绍"和"旁白"两种特殊说话人。
- **登场人物**：每个场景有自己的人物名单。人物设定（性格、说话方式、台词参考链接）会作为参考发给 LLM。
- **原剧本参考**：新建场景时，或者点场景名旁边的齿轮按钮，可以粘贴这一段的原台词，也可以只填剧本网页链接。润色和预测时会自动带上。
- **AI 润色**：按 3 种可自定义的风格各生成一个版本（中英双语），选一个再改，确认后保存。风格在 `/styles` 页面设置。
- **AI 预测**：预测接下来的 1～10 句台词，勾选后再添加到场景。
  - 打开"优先使用参考里的原台词"时，会在原剧本里找到当前位置，直接按顺序取后面的原台词（英文不变，模型只负责翻译中文）。
  - 关闭时，模型参考原剧本里人物的说话方式，续写新的台词。
- **预测日志**：每次预测都会记录到 `logs/predict.jsonl`，方便分析结果为什么不对。只保留最近 100 条。
- **界面语言**：可以切换中文和英文。

润色和预测使用的规则来自 `.claude/skills/re-dialogue-refiner/SKILL.md`。这份 skill 同时也给 Claude Code 使用，所以网页和对话里的润色规则是一致的。

## 环境要求

- [Node.js](https://nodejs.org/) **20.12 或更高版本**：后端用到了内置的 `process.loadEnvFile` 和 `fetch`。开发时的自动重启用的是 `node --watch`。
- 至少一个 **OpenAI 兼容接口**的 LLM 服务，例如 Google AI Studio 的 Gemini（有免费额度）、Groq、OpenRouter，或者本地运行的 Ollama / LM Studio。没有配置 LLM 时，网页的其他功能照常可用，只是不能润色和预测。

## 安装

```bash
git clone https://github.com/ltzx2004538/AI-dialog.git
cd AI-dialog
npm install
```

> Windows PowerShell 如果禁止运行 `.ps1` 脚本，把下文所有的 `npm` 换成 `npm.cmd`、`npx` 换成 `npx.cmd`。

## 配置

复制配置模板，然后填写你要用的 LLM 服务：

```bash
cp .env.example .env
```

以 Gemini 为例（在 https://aistudio.google.com/apikey 申请 API Key）：

```ini
LLM_PROVIDERS=gemini
LLM_GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_GEMINI_API_KEY=你的 API Key
LLM_GEMINI_MODELS=gemini-3.5-flash,gemini-3.5-flash-lite
# 长上下文模型可以把整部剧本全文发过去，由模型自己找到当前场景
LLM_GEMINI_REFERENCE_MAX_CHARS=300000
```

| 变量 | 说明 |
| --- | --- |
| `LLM_PROVIDERS` | 启用的服务名，用逗号分隔，例如 `gemini,ollama`。第一个服务的第一个模型是默认模型 |
| `LLM_<NAME>_BASE_URL` | 该服务的 OpenAI 兼容接口地址 |
| `LLM_<NAME>_API_KEY` | API Key，本地模型可以不填 |
| `LLM_<NAME>_MODELS` | 模型名，用逗号分隔，每个都会出现在网页的模型下拉菜单里 |
| `LLM_<NAME>_REFERENCE_MAX_CHARS` | 可选，用这个服务时每份参考资料最多发送的字数 |
| `REFERENCE_MAX_CHARS` | 每份参考资料默认最多发送的字数（默认 20000），本地小模型可以调小 |
| `LLM_TIMEOUT_MS` | 请求超时时间（默认 120000 毫秒） |
| `PORT` | 后端端口（默认 3000） |

Groq、OpenRouter、Ollama、LM Studio 的填写示例都在 `.env.example` 里。`.env` 不会被提交到 Git。修改 `.env` 后需要重启服务。

## 运行

**日常使用**：先构建前端，再启动服务。

```bash
npm start
```

然后打开 http://localhost:3000 。

**开发**：前后端改代码后都会自动生效，需要开两个终端：

```bash
npm run server:watch   # 后端：改了 server.js / server/*.js 自动重启
npm run dev            # 前端：Vite 热更新
```

然后打开 http://localhost:5173 。

服务只监听 `127.0.0.1`，只能在本机访问。

## 数据文件

| 文件 | 内容 |
| --- | --- |
| `dialogue.json` | 场景、人物和台词。第一次运行时自动创建，不提交到 Git |
| `styles.json` | 润色的 3 种默认风格 |
| `logs/predict.jsonl` | 最近 100 次 AI 预测的记录，不提交到 Git |

## 项目结构

```
server.js          后端入口（Node 原生 http）：/api 接口、托管 dist/、读写 dialogue.json
server/            LLM 客户端、提示词、润色、预测、参考资料抓取、预测日志
client/            前端（React + Vite）：page/ 页面、component/ 组件、service/ 请求与工具、translation/ 中英文案
prd/               产品需求文档
.claude/skills/    re-dialogue-refiner（润色规则）、dialogue-board-conventions（代码规范）
```

修改代码前请先阅读 `.claude/skills/dialogue-board-conventions/SKILL.md` 里的代码规范；详细的功能说明见 `prd/dialogue-board-prd.md`。
