# AI dialog · Dialogue Board

一个在本机运行的台词管理网页，用来写和润色电影化的人物对白。按场景管理台词，角色由你自己定义。每句台词同时保存中文和英文，可以调用大模型（LLM）润色单句，或者预测接下来的几句。

## 功能

- **场景和台词**：按场景管理台词，每句台词有固定编号（`L001`、`L002`……），显示为"中文名：中文台词"和"英文名: 英文台词"两行。另有"背景介绍"和"旁白"两种特殊说话人。
  - 鼠标移到某一行时，行尾出现五个图标：编辑、润色、翻译、复制（把中英文连同说话人名复制到剪贴板）、删除。
  - **翻译**：只有中文或只有英文的句子才有这个图标，补上缺的那种语言，不改写原句，提示词很短，省 token。对译文不满意就用润色。翻译默认用 `.env` 里 `LLM_TRANSLATE_MODEL` 指定的便宜模型。
  - 拖动 ID 前面的手柄可以调整台词顺序（也可以选中手柄后按 ↑ ↓ 键）。
  - 一个场景太长时，点首页场景卡片上的**复制**图标，新场景带上原剧本参考和人物，不带台词，接着写。
- **登场人物**：每个场景有自己的人物名单。每个人物有英文名，以及三个可选属性：
  - **中文名**：显示在中文台词前，也让 LLM 统一用这个译名；
  - **性格**：性格特点和说话方式，润色和预测时发给 LLM；
  - **台词参考**：粘贴这个人物以前的台词，或填台词页面链接，作为模仿说话方式的参考。
  - 点**从台词参考生成性格**，LLM 会把台词参考（例如 3 万字的 quotes 页面）总结成约 300 字的性格档案。之后润色和预测只发送这份档案，不再每次发送整个台词参考，能省下大量 token。
- **原剧本参考**：新建场景时，或者点场景名旁边的齿轮按钮，可以粘贴这一段的原台词，也可以只填剧本网页链接。润色和预测时会自动带上。
- **AI 润色**：按 3 种可自定义的风格各生成一个版本（中英双语），选一个再改，确认后保存。风格在 `/styles` 页面设置。
- **AI 预测**：预测接下来的 1～10 句台词，勾选后再添加到场景。
  - 打开"优先使用参考里的原台词"时，会在原剧本里找到当前位置，直接按顺序取后面的原台词（英文不变，模型只负责翻译中文）。
  - 关闭时，模型参考原剧本里人物的说话方式，续写新的台词。
- **AI 日志**：每次预测和润色（包括失败的）分别记录到 `logs/predict.jsonl` 和 `logs/refine.jsonl`，方便分析结果为什么不对或为什么失败。各保留最近 100 条。
- **界面语言**：可以切换中文和英文。

润色和预测使用的规则来自 `.claude/skills/dialogue-refiner/SKILL.md`。这份 skill 同时也给 Claude Code 使用，所以网页和对话里的润色规则是一致的。想写别的角色或别的风格，改这份 skill 就行，不用改代码。

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

**启动不了时**：

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| PowerShell 报"无法加载文件 …\npm.ps1，因为在此系统上禁止运行脚本" | PowerShell 里的 `npm` 实际运行的是 `npm.ps1`，被执行策略拦下，还没读到 `package.json` | 改用 `npm.cmd start`；或在 cmd / Git Bash 里运行；或执行一次 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| 报 `EADDRINUSE` | 3000 端口已被占用，常见是开发用的 `npm run server:watch` 还开着 | 关掉占用端口的进程，或在 `.env` 里改 `PORT` |

**开发**：前后端改代码后都会自动生效，需要开两个终端：

```bash
npm run server:watch   # 后端：改了 server.js / server/*.js 自动重启
npm run dev            # 前端：Vite 热更新
```

然后打开 http://localhost:5173 。

服务只监听 `127.0.0.1`，只能在本机访问。

## 测试

```bash
npm test
```

- `test/api/`：启动真实的后端，用临时的模拟数据测试所有接口（场景、台词、排序、人物、风格、润色、预测、生成性格、参考链接、旧数据迁移）。
- `test/client/`：测试前端的请求函数、工具函数和中英文案。
- 需要 AI 的功能用一个假的 LLM（`test/helpers/mockLlm.js`）返回模拟回复，不会调用真实模型，也不需要 API key。测试不会改动你的 `dialogue.json`、`styles.json` 和 `.env`。

## 数据文件

| 文件 | 内容 |
| --- | --- |
| `dialogue.json` | 场景、人物和台词。第一次运行时自动创建，不提交到 Git |
| `styles.json` | 润色的 3 种默认风格 |
| `logs/predict.jsonl`、`logs/refine.jsonl` | 最近 100 次 AI 预测 / 润色的记录，不提交到 Git |

## 项目结构

```
server.js          后端入口（Node 原生 http）：/api 接口、托管 dist/、读写 dialogue.json
server/            LLM 客户端、提示词、润色、预测、参考资料抓取、AI 日志
client/            前端（React + Vite）：page/ 页面、component/ 组件、service/ 请求与工具、translation/ 中英文案
prd/               产品需求文档
plans/             开发计划
test/              测试：api/ 后端接口、client/ 前端、helpers/ 启动服务和假 LLM
.claude/skills/    dialogue-refiner（润色规则）、dialogue-board-conventions（代码规范）
```

修改代码前请先阅读 `.claude/skills/dialogue-board-conventions/SKILL.md` 里的代码规范；详细的功能说明见 `prd/dialogue-board-prd.md`。
