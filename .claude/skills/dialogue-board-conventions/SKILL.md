---
name: dialogue-board-conventions
description: Coding conventions for the Dialogue Board web app (React + Vite frontend in client/, Node server.js backend, dialogue.json storage). Load before adding, changing, or reviewing any code in client/, server.js, vite.config.js, or package.json.
---

# Dialogue Board 代码规范

修改网页代码（`client/`、`server.js`、`vite.config.js`、`package.json`）前先读这份规范，写完后按文末的检查清单自查。

## 1. 目录结构与职责

```
server.js                 // 后端入口：Node 原生 http，路由 /api、托管 dist/、读写 dialogue.json
server/                   // 后端模块：llm.js（OpenAI 兼容接口客户端）、prompt.js（润色和预测共用的提示词工具：读 skill、场景台词、人物设定、参考资料、解析 JSON）、refine.js（润色）、predict.js（AI 预测后续台词）、predictLog.js（预测日志）、styles.js（读写 styles.json）、references.js（抓取额外要求里的参考链接）
.env / .env.example       // LLM 配置（.env 不提交；新增配置项要同步写进 .env.example）
dialogue.json             // 台词数据（运行时生成，不要手动改结构）
styles.json               // 润色的三个风格（网页 /styles 页面和 dialogue-refiner skill 共用）
vite.config.js            // root = client，构建输出到 dist/
prd/                      // 产品需求文档
client/
  index.html
  src/
    main.jsx              // 入口，只负责挂载 <App />
    App.jsx               // 全局 Provider + 路由表，不写业务逻辑
    styles.css            // 全局样式（唯一的样式文件）
    page/                 // 页面（每个路由一个）：持有数据和状态，调用 service，组装组件
    component/            // 组件：只负责显示和交互，数据和回调都通过 props 传入
    service/              // 非 UI 逻辑：api.js（后端请求）、routes.js（网址生成/解析）、storage.js（localStorage）
    translation/          // 界面文案：cn.js、en.js，以及 index.jsx（LanguageProvider、useTranslation）
```

- **page** 可以用 `useState` / `useEffect` 管理数据、调用 `service`；一个文件一个页面，命名为 `XxxPage.jsx`。现有页面：`HomePage`（场景列表）、`ScenePage`（某个场景的台词）、`NotFoundPage`。
- **component** 不直接调用 `service/api.js`、不直接 `fetch`。组件内部只保留纯界面状态（比如菜单是否打开、输入框草稿）。
- **service** 只导出普通函数；`api.js` 的函数返回 Promise，出错时抛出带后端 `error` 信息的 `Error`。
- 新增文件夹前先确认现有的四个文件夹放不下。

### 可复用组件（新功能优先复用，不要再写一份）

| 组件 | 用途 |
| --- | --- |
| `AppLayout` | 所有页面共用的外框：标题（回首页）+ 语言切换 + `<Outlet />` |
| `IconButton` | 只有图标的按钮，props：`icon`（`'pencil'` / `'bin'`…）、`label`（无障碍名称和提示）、`onClick`、`danger`。现有 `pencil` / `bin` / `gear`，新图标加到它的 `ICONS` 里，**不要再单独写图标组件** |
| `ActionMenu` | 铅笔图标 + 下拉菜单，传 `items: [{ label, onClick, danger }]` |
| `TextInputDialog` | 输入一个文本的弹窗（首页重命名场景用它） |
| `SceneDialog` | 场景名 + 原剧本参考（`source`）的弹窗：首页新建场景、场景页标题旁的齿轮按钮编辑场景都用它 |
| `SpeakerSelect` | 说话人下拉列表，**只选择不添加**；人物名单由父组件传入 |
| `CharactersDialog` | 管理本场景的人物（添加 / 编辑名字和人物设定 / 删除），处理函数失败时抛错，错误显示在弹窗里 |
| `RefineDialog` | AI 润色弹窗，三步：确认风格（不请求 LLM）→ 选一个版本 → 只显示选中的版本，改中文和英文 → 再次润色或保存 |
| `StylesEditor` | 编辑三个风格（名称 + 说明），`StylesPage` 和 `RefineDialog` 共用；传 `enabled` + `onToggle` 时每张卡片显示开关，关掉的卡片变灰 |
| `PredictDialog` | AI 预测弹窗，两步：选句数（1～10 下拉）+ 额外要求 → 勾选结果后添加 |
| `InstructionField` | "额外要求"输入框（含参考链接提示）+ "优先使用参考里的原台词"开关，`RefineDialog` 和 `PredictDialog` 共用 |
| `ReferenceList` | 显示参考链接读取结果，`RefineDialog` 和 `PredictDialog` 共用 |
| `ToggleButton` | 开关按钮（`role="switch"`），props：`checked`、`label`、`onToggle` |
| `LlmSelect` | LLM 下拉列表（数据来自 `/api/llms`） |

## 1.1 路由

- 用 `react-router-dom`，路由表只写在 `App.jsx`，所有页面挂在 `AppLayout` 下面。
- 现有路由：`/` → `HomePage`，`/scene/:sceneNumber` → `ScenePage`，`*` → `NotFoundPage`。
- 网址里的场景用数字（`/scene/1`），数据里是 `S001`。两者转换只能用 `service/routes.js` 的 `scenePath()` / `sceneIdFromParam()`，不要在别处手动拼网址。
- 页面内跳转用 `<Link>` / `useNavigate`，不用 `<a href>` 或 `window.location`。
- 页面要能直接打开或刷新，不能依赖从别的页面传过来的状态；需要的数据在页面里自己加载。
- 后端对没有扩展名的路径统一返回 `index.html`。新增前端路由不需要改后端，但新增的路由不能以 `/api/` 开头。

## 2. 命名

| 类型 | 规则 | 例子 |
| --- | --- | --- |
| 组件 / 页面文件 | PascalCase，`.jsx`，一个文件 `export default` 一个组件，文件名 = 组件名 | `LineItem.jsx`、`DialogueBoardPage.jsx` |
| 非组件文件 | camelCase，`.js` | `api.js`、`cn.js` |
| 变量、函数 | camelCase | `addedSpeakers`、`startEdit` |
| 模块级常量 | UPPER_SNAKE_CASE | `SPECIAL_SPEAKERS`、`LLM_STORAGE_KEY` |
| 回调 props | `onXxx` | `onSubmit`、`onDelete` |
| 页面里的事件处理函数 | `handleXxx` | `handleAdd`、`handleUpdate` |
| service 函数 | 动词开头 | `fetchLines`、`createLine`、`updateLine`、`deleteLine` |
| CSS 类名 | kebab-case | `line-speaker`、`modal-backdrop` |

## 3. React 写法

- 只用函数组件和 Hooks，不用 class 组件。
- import 顺序：React / 第三方库 → 项目内其他文件夹（`../service`、`../translation`）→ 同文件夹（`./Xxx.jsx`）。import 路径带上扩展名。
- 列表渲染的 `key` 用台词 ID 这类稳定的值，不用数组下标。
- 弹窗用 `createPortal` 渲染到 `document.body`。如果弹窗里有 form，要 `stopPropagation`，避免触发背后的表单。
- 不使用 `alert` / `confirm` / `prompt`，需要确认的操作用页面内的确认 UI（参考 `LineItem` 的删除确认）。
- 有"保存"的编辑界面（弹窗或页面）都要配一个"取消"，放弃未保存的修改（参考 `StylesPage` 的 `cancel()`）。
- **事件处理写成具名函数**：`onClick`、`onMouseDown`、`onKeyDown`，以及传给子组件的回调（`onSave`、`onClose`、`onConfirm`、`onCancel`、菜单项的 `onClick` 等），都在组件里 `return` 之前定义具名函数（如 `editChar`、`deleteChar`、`backToView`、`closeOnBackdrop`），JSX 里只写函数名：`onClick={cancelEdit}`。
  - 唯一例外：列表里需要把当前项传进去时，可以写一行箭头函数，且只调用一个具名函数，不能有其他逻辑：`onClick={() => deleteChar(name)}`。
  - 不要在 JSX 里写 `() => setXxx(...)`、`() => { ...多行... }`、`async () => ...` 或 `&&` 条件判断，这些都提到上面的具名函数里。
  - 受控输入框的 `onChange={(e) => setValue(e.target.value)}` 这种单行赋值不受此限制。
  - 点遮罩关闭弹窗统一用 `closeOnBackdrop(e)`（`e.target === e.currentTarget` 时关闭）。
- **JSX 里不写任何判断（必须遵守）**：凡是要根据条件决定显示什么（`if`、三元 `? :`、`&&`、`||` 兜底文字、按条件切换 className 等），都提取到 `return` 之前的 `renderXxx()` 函数里，用 `if / else` 判断，最后 `return` 一个元素（没有内容时 `return null`）；JSX 里只调用它。
  - 例：`CharactersDialog` 的 `renderCharRow(character)`：编辑中返回表单，否则返回 `<div>`（名字、台词数、图标按钮、删除确认、人物设定）；列表里只写 `<li key={...}>{renderCharRow(character)}</li>`。
  - 函数内部的可选部分也用 `if` 赋给变量再放进 JSX（如 `let confirm = null; if (...) confirm = (...)`，然后 `{confirm}`），不要在 JSX 里写 `&&`。
  - 新写或修改的组件都按这条来；改到旧组件时，顺手把那一块的判断也提取出来。
- 需要多个组件共享的东西，先考虑在 page 里管理再通过 props 传下去；只有全局的东西（比如语言）才用 Context。

## 4. 界面文案与多语言（必须遵守）

- **组件和页面里不能出现写死的界面文字**，包括按钮、提示、placeholder、`aria-label`、`title`。全部通过 `useTranslation()` 的 `t()` 获取：
  ```jsx
  const { t } = useTranslation();
  <button>{t('line.save')}</button>
  <span>{t('app.lineCount', { count: lines.length })}</span>
  ```
- 新增文案时，**`cn.js` 和 `en.js` 要同时加**，两个文件的 key 结构必须完全一致。
- key 按所属区域分组，用 camelCase：`app.*`、`composer.*`、`line.*`、`newSpeakerDialog.*`……新组件就新开一组。
- 变量用 `{name}` 占位，调用时传参数，不要用字符串拼接拼句子。
- 用户数据（台词内容、角色名）和后端返回的错误信息不翻译。
- 新增语言：在 `translation/` 加 `xx.js`，在 `index.jsx` 的 `DICTIONARIES` 和 `HTML_LANG` 里注册，语言切换按钮会自动出现。
- 语言选择保存在 `localStorage`（`dialogue-board.language`）。访问 `localStorage` 一律通过 `service/storage.js` 的 `readStorage` / `writeStorage`，不要直接调用。

## 5. 样式

- 所有样式写在 `client/src/styles.css`，不写行内 `style`，不引入 CSS 框架。
- 颜色只用 `:root` 里定义的 CSS 变量（`--bg`、`--surface`、`--text`、`--muted`、`--border`、`--accent`、`--leon`、`--ada`、`--other`、`--hover`）。新增颜色先加变量，并且在 `prefers-color-scheme: dark` 里给出深色值。
- 窄屏（≤ 560px）布局要能正常显示，必要时在文件底部的媒体查询里补规则。
- 删除组件时，把不再使用的样式一起删掉。

## 6. 后端与数据

- 不用数据库，所有数据存在 `dialogue.json`：`{ nextSceneNumber, nextLineNumber, scenes: [{ id, name, source, characters: [{ name, personality, source }] }], lines: [{ id, sceneId, speaker, cn, en }] }`。**台词字段固定是 `cn`（中文）和 `en`（英文），不要用 `text` / `translation` 这类字段**；两者至少一个非空。旧的 `{ text, translation }` 在 `server.js` 的 `migrateLine()` 里自动转换。底部输入框用 `service/lines.js` 的 `splitByLanguage()` 按是否含中文决定存进哪个字段。台词通过 `sceneId` 关联场景，保持扁平结构，不要把台词嵌套进场景。
- 接口统一在 `/api` 下，REST 风格：`/api/scenes`、`/api/scenes/:id`、`/api/lines`、`/api/lines/:id`、`/api/scenes/:id/characters`、`/api/scenes/:id/characters/:name`（GET / POST / PUT / DELETE）。
- 人物名单存在**各自场景**的 `characters` 数组里（不要放到顶层），每项 `{ name, personality, source }`，在场景内按名字识别：名字不区分大小写不能重复，也不能用保留名；改名时同步修改本场景台词的 `speaker`；删除人物会同时删除其在本场景的台词，前端在有台词时必须先确认（确定 / 取消），没有台词直接删除。人物接口都返回该场景完整的新名单。修改场景（PUT）时要保留 `characters`。
- 人物是 `{ name, personality, source }`：`personality` 是性格和说话方式，`server/prompt.js` 的 `characterNotes()` 把出场人物的性格放进提示词（润色时目标说话人在前）；`source` 是台词参考（粘贴的台词和/或链接），用法同场景的 `source`：润色只带目标说话人的，预测带已出场人物的，作为 `loadReferences()` 的 `pasted` 项（`{ text, name }`，排在场景 `source` 之后），其中的链接和额外要求里的一起抓取（额外要求优先）。旧的 `notes` 在 `server.js` 的 `migrateCharacter()` 里拆成链接 → `source`、其余 → `personality`。
- `source`（场景的原剧本参考，粘贴的原台词和/或链接）：润色和预测都把它交给 `loadReferences(text, focus, maxChars, pasted)`，去掉链接后的文字作为 `{ url: '', pasted: true }` 排在最前面，其中的链接和额外要求里的一起抓取（额外要求优先）。`PUT /api/scenes/:id` 不带 `source` 时保留原值（首页重命名只发 `name`）；`load()` 给旧场景补上空的 `source`。
- `preferOriginal`（润色 / 预测请求可带）：`referenceBlock(references, preferOriginal)` 改为要求模型直接使用参考里的原台词；默认的风格参考模式下仍禁止照抄。预测时如果参考里找到了当前场景（`anchor`），`predict.js` 的 `originalLines()` 直接从剧本里按顺序取后面的"说话人: 台词"作为英文（遇到本场景人物以外的说话人就停），模型只负责翻译中文（`translateLines()`）；找不到时才让模型自己写。
- 提示词顺序：参考资料（可能很长）和人物设定放在最前面，场景台词放在后面，最后才是要完成的任务（润色的目标句 / 预测的"最后一句是……，新的一句必须接住它"），让模型最后读到的是要接的台词。
- 润色上下文：发送整个场景的台词（`>>>` 标出目标句）；`handleRefine` 把 `draft` 同时替换进目标句和场景台词，两处必须一致。
- AI 预测（`server/predict.js`，`POST /api/scenes/:id/predict`）：`count` 1～10（前端 `PredictDialog` 的 `COUNTS` 要同步）；说话人只能是本场景人物 / `Narrator` / `Background`，其他的丢弃；只返回候选，前端逐句 `POST /api/lines` 添加。新的 AI 功能先复用 `server/prompt.js` 里的工具，不要复制提示词代码。
- 预测日志：`predictLines()` 每次调用（通过参数校验后，包括失败的）都用 `predictLog.js` 的 `appendPredictLog()` 往 `logs/predict.jsonl` 追加一行 JSON（请求参数、最后 3 句台词、参考资料摘要和匹配位置后的片段、`path: original | model`、模型原始输出、结果或错误、耗时），只保留最近 100 条。写日志失败只打印到控制台，不能影响预测。`logs/` 不提交。
- `load()` 迁移旧格式后会立即写回文件（内容没变就不写）。
- 返回 JSON；出错时返回 `{ "error": "..." }`，并带上合适的状态码（400 参数错误、404 不存在、405 方法不支持、500 服务器错误）。
- 每句台词必须属于一个存在的场景：新建台词时校验 `sceneId`；删除场景时连带删除其台词。
- ID 由服务端计数器自增分配，**永不复用**；编辑时 ID 不变。场景为 `S###`，台词为 `L###`（全局唯一，不按场景重新编号）。台词编号和 `dialogue-refiner` skill 一致，不能改。
- 改数据结构时，在 `server.js` 的 `load()` 里兼容旧格式的文件，不能让已有数据失效。
- 写 `dialogue.json` 一律先写 `.tmp` 再重命名，不要直接覆盖。
- 后端只用 Node 内置模块，不加依赖（`.env` 用 `process.loadEnvFile` 读取，HTTP 请求用内置 `fetch`）；服务只监听 `127.0.0.1`。
- 后端模块出错时抛出带 `status` 的错误（`httpError(status, message)`），由 `server.js` 统一返回 `{ error }`。

## 6.1 LLM

- 只对接 **OpenAI 兼容接口**（`POST {LLM_BASE_URL}/chat/completions`），不要为某一家服务写专用 SDK 代码，这样免费在线服务和本地模型（Ollama / LM Studio）可以只靠改 `.env` 切换。
- 所有 LLM 调用都经过 `server/llm.js` 的 `chat(messages, llmId)`；API key 和接口地址只在后端使用，返回给前端的模型列表只能用 `publicLlms()`。
- `.env` 按服务配置：`LLM_PROVIDERS` 列出服务名，每个服务用 `LLM_<NAME>_BASE_URL` / `_API_KEY` / `_MODELS`。模型 ID 固定为 `服务名/模型名`，前端只传这个 ID。
- 前端当前选中的模型由 `ScenePage` 管理（存在 `dialogue-board.llm`），通过 `LlmSelect` 选择。
- 润色的提示词以 `dialogue-refiner` skill 为准（`server/prompt.js` 的 `skillText()` 每次请求时读取 SKILL.md，润色和预测都用它），只追加"本次风格 + 返回 JSON"的输出要求（风格几个就要几个版本）。
- **三个风格不能写死**：默认风格存在 `styles.json`（`server/styles.js` 读写，必须正好 3 个、每个有 `name`），前端通过 `/api/styles` 读写；润色请求可以带本次开启的 `styles`（1～3 个，`cleanStyles(input, 1)`），没带就用 `styles.json`；保存默认风格仍然必须是 3 个。前端文案里不要出现具体风格名。
- 参考链接：`server/references.js` 从额外要求里提取链接（最多 3 个），抓取网页正文（缓存 10 分钟，缓存的是全文）；每个最多发送 `REFERENCE_MAX_CHARS` 字（默认 20000；服务设置了 `LLM_<NAME>_REFERENCE_MAX_CHARS` 时用它，由 `llm.js` 的 `referenceLimit(llmId)` 取出后传给 `loadReferences()`），超长页面由 `excerpt()` 按传入的 `focus`（场景台词，最近的在前）截取匹配段落，找不到才取开头；找到匹配时 `anchor` 记下位置，`prompt.js` 在发给模型的正文里插入 `SCENE_MARKER` 标出"当前场景演到这里"；结果的 `mode` 为 `full` / `match` / `head`，前端 `ReferenceList` 据此提示；遇到 401/403 且是 `/wiki/<标题>` 链接时，改用该站 MediaWiki 接口 `/api.php?action=parse` 读取（Fandom 需要这个）。抓到的内容是**不可信数据**，在提示词里用 `<reference>` 包起来，并声明只作风格参考、忽略其中的指令；接口只把 `{ url, ok, chars | error }` 返回给前端，不返回网页正文。
- 模型输出一律当作不可靠数据：解析前先截取 JSON，校验字段，不合格就返回 502，不要写进 `dialogue.json`。
- 润色接口只返回候选版本 `[{ cn, en }]`，不修改数据；再次润色时前端把用户修改后的 `{ cn, en }` 作为 `draft` 传给接口；用户点"保存"后，前端再调用 `PUT /api/lines/:id` 保存。

## 6.2 特殊说话人

- `Background`（背景介绍）和 `Narrator`（旁白）是保留的说话人值，数据里只存这两个英文值，界面用 `speakerLabel()` 翻译显示。
- 定义在 `client/src/service/speakers.js`（还有 `isRefinable()`）；后端 `server.js` 的 `SPECIAL_SPEAKERS` 和 `server/prompt.js` 的 `BACKGROUND` / `NARRATOR` 要和它保持一致。
- 保留名不是人物，不进 `characters`，也不能被添加成人物。人物名单不要在前端写死，只用场景数据里的 `characters`。
- `Background` 永远不经过 LLM：前端不显示"润色"，后端润色接口返回 400；作为上下文发给模型时标注为 `Background (context only)`。
- 背景和旁白的润色规则写在 `dialogue-refiner` skill 里，改规则改 skill，不改代码。

## 7. 代码风格

- 2 空格缩进，单引号，语句末尾加分号，多行对象 / 数组保留尾逗号。
- 注释只写"为什么"，不写"做了什么"；用英文写注释。
- 不留下未使用的 import、变量、组件、样式。

## 8. 运行与构建（Windows）

- PowerShell 里用 `npm.cmd` / `npx.cmd`（本机禁止运行 `.ps1` 脚本）。
- 日常启动：`npm.cmd start`（先构建再启动服务），打开 http://localhost:3000 。
- 开发热更新：一个终端运行 `npm.cmd run server:watch`（`node --watch`，改了 `server.js` / `server/*.js` 自动重启；改 `.env` 仍需手动重启），另一个运行 `npm.cmd run dev`（Vite 热更新），打开 http://localhost:5173 。
- 服务运行期间改了前端代码，只需运行 `npx.cmd vite build`，再刷新页面即可，不用重启服务；改了 `server.js` 需要重启服务。

## 9. 完成前检查清单

- [ ] `npx.cmd vite build` 构建通过。
- [ ] 组件 / 页面里没有写死的界面文字（可以在 `component/`、`page/` 下搜索中文字符确认）。
- [ ] `cn.js` 和 `en.js` 的 key 一一对应，两种语言切换后都显示正常。
- [ ] 新文件放在了正确的文件夹里，命名符合第 2 节。
- [ ] JSX 里的事件处理都是具名函数（第 3 节）：搜索 `on[A-Z]\w*=\{\(` 只剩列表项传参的一行写法。
- [ ] 新改的组件 JSX 里没有 `? :`、`&&` 这类判断，都提到了 `renderXxx()` 函数里（第 3 节）。
- [ ] 新页面 / 新路由能直接打开和刷新；改了 `server.js` 的话已经重启服务。
- [ ] 功能有变化时，同步更新 `prd/dialogue-board-prd.md`。
