# Zotero Chat – AI 文献助手（中文说明）

Zotero Chat 是一个围绕 Zotero 打造的本地 AI 文献助手。  
它可以读取你的 Zotero 文库，扫描集合、提取 PDF，利用大模型帮你：

- 快速总结文献
- 对多篇文献做综合深度研究
- 按主题快速分类、画出“知识图谱”
- 基于文献进行智能问答
- 做语义搜索，帮你在一堆论文里找“真正相关的那几篇”

后端使用 FastAPI，前端是 Next.js + React，支持流式输出和“思考模式”折叠卡片。

---

## 核心功能

- **连接 Zotero**
  - 扫描任意 Zotero 集合（文件夹）
  - 读取本地 Zotero 数据目录中的 PDF 附件并解析内容

- **AI 总结**
  - 支持单篇和多篇文献的智能总结
  - 模式：完整总结 / 快速摘要 / 关键点提取
  - 支持流式输出，生成过程可以展开“思考卡片”实时查看

- **深度研究（Research）**
  - 针对一组文献和一个研究问题，自动生成结构化研究报告
  - 会综合文献的研究目标、方法、结果、局限性、未来方向等

- **快速分类（Categorize）**
  - 只用摘要即可完成快速分类和趋势分析，不需要加载 PDF
  - 生成：
    - 若干主题类别及代表文献
    - 各类别的特点与差异
    - 研究趋势 + 简单“知识图谱”说明
  - 生成过程同样是流式的，在折叠卡片中滚动展示最新内容

- **对话问答（Chat）**
  - 选定若干文献后，可以与 AI 对话，提问、对比、改写等
  - 后端会把相关文献内容作为上下文喂给模型

- **语义搜索（Search）**
  - 对当前集合建立本地向量索引
  - 按“语义”而非关键字搜索相关文献
  - 搜到的文献可以直接加入选中列表，继续做总结 / 研究 / 对话

- **全局搜索（Global Search）**
  - 按关键词搜索整个 Zotero 文库（标题、作者等）
  - 无需加载集合即可搜索，结果包含所有匹配条目
  - 自动去重，优先显示有 PDF 的版本
  - 点击可查看文献详情并加载进行 AI 分析

- **文献详情对话框**
  - 查看任意文献的详细元数据（标题、作者、日期、摘要等）
  - 显示文献被扫描和索引的时间
  - 快速访问 PDF 查看和 AI 工具

- **会话持久化**
  - 当前会话状态（已扫描集合、已加载文献、索引）自动保存
  - 重启应用后可无缝恢复工作状态

- **现代 Web 界面**
  - 三栏布局：
    - 左侧：集合列表（Zotero Collections）
    - 中间：文献列表 + 已选 PDF 面板
    - 右侧：AI 工具面板（Summarize / Chat / Research / Categorize / Search）

---

## 项目结构

```txt
zetero-chat/
├── api.py               # FastAPI 应用 (Zotero Chat API)
├── main.py              # 主入口 (CLI + API 启动器)
├── config.py            # 配置管理 (Zotero / AI / 索引)
├── requirements.txt     # Python 依赖
├── start.sh             # 早期的启动脚本（逻辑较旧，推荐按下文命令启动）
├── data/                # 运行时数据（会话、索引）
│   └── session.json     # 自动保存的会话状态
├── ai/                  # AI 相关模块
│   ├── __init__.py
│   ├── prompts.py       # Prompt 模板
│   └── summarizer.py    # 总结器 / 深度研究 / 分类 / 对话
├── indexer/             # 索引与扫描
│   ├── __init__.py
│   ├── scanner.py       # 扫描集合、读取 PDF
│   └── index.py         # 语义索引管理
├── zotero/              # Zotero Client 与模型
│   ├── __init__.py
│   ├── client.py        # Zotero API 客户端 + 全局搜索
│   ├── models.py        # 数据模型（DocumentInfo 等）
│   └── collection.py    # 集合管理
├── utils/               # 工具函数
│   ├── __init__.py
│   ├── logger.py        # 日志配置
│   └── pdf_reader.py    # PDF 提取工具
└── web-ui/              # Next.js Web 前端
    ├── app/             # Next.js App 入口
    ├── components/      # React 组件与 AI Panels
    ├── lib/             # 前端类型与 API 封装
    └── ...
```

---

## 环境要求

- **Python** ≥ 3.9
- **Node.js** ≥ 18（推荐 20+）
- 安装好的 **Zotero 客户端**
  - 拥有一个 Zotero **API Key**
  - 能访问本地 Zotero 数据目录（用于读取 PDF）
- 一个兼容 OpenAI Chat Completions 协议的 **大模型服务**
  - 如 OpenAI 官方、Azure OpenAI，或兼容接口的自建服务

---

## 安装步骤

### 1. 克隆仓库

```bash
git clone https://github.com/Jianxinnn/Zotero-review-generation
cd zetero-chat
```

### 2. 安装 uv（Python 包和环境管理工具）

如果你本机还没有安装 [uv](https://github.com/astral-sh/uv)，可以先执行：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# Windows（PowerShell）:
# irm https://astral.sh/uv/install.ps1 | iex
```

安装完成后，重新打开一个终端，确保 `uv` 在 `PATH` 中。

### 3. 创建虚拟环境并安装后端依赖

```bash
uv venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

uv pip install -r requirements.txt
```

### 4. 安装前端依赖

```bash
cd web-ui
npm install   # 或 pnpm install / yarn
cd ..
```

---

## 配置说明

项目通过 `.env` 读取配置（已集成 pydantic-settings）。  
仓库里提供了示例文件：

```bash
cp .env.example .env
```

编辑 `.env`，填入至少以下内容：

```env
# Zotero（必填）
ZOTERO_LIBRARY_ID=你的_Library_ID
ZOTERO_LIBRARY_TYPE=user          # 或 group
ZOTERO_API_KEY=你的_Zotero_API_Key
ZOTERO_DATA_DIR=/Users/你/Zotero   # 本地 Zotero 数据目录

# AI 服务（必填）
AI_PROVIDER=openai                 # openai | azure | ollama
AI_API_KEY=你的_API_Key
AI_MODEL=gpt-4o-mini               # 或其他模型
# 可选：自定义 API 地址（Azure / 反向代理 / 本地 LLM）
AI_API_BASE=

# 索引（可选）
INDEX_PERSIST_DIR=./data/index
INDEX_CHUNK_SIZE=1000
INDEX_CHUNK_OVERLAP=200
```

**Zotero 配置获取方式：**

- API Key & Library ID：  
  登录 https://www.zotero.org/settings/keys
- 本地数据目录：
  - macOS: `~/Zotero` 或 `~/Library/Application Support/Zotero`
  - Windows: `C:\Users\<用户名>\Zotero`
  - Linux: `~/Zotero`

---

## 启动服务

### 1. 启动后端 API

在项目根目录：

```bash
source .venv/bin/activate  # 如未激活虚拟环境
uv run main.py ui          # 默认启动到 http://localhost:8000
```

如需修改端口：

```bash
uv run main.py ui --port 9000
```

### 2. 启动 Web 前端

另开一个终端：

```bash
cd web-ui

# 如果修改过 API 端口/地址，请设置这个变量；未设置时默认 http://localhost:8000
export NEXT_PUBLIC_API_URL="http://localhost:8000"

npm run dev   # 默认启动到 http://localhost:3000
```

在浏览器访问：**http://localhost:3000**

---

## Web 界面使用流程

界面大致分为三块：

1. **左侧：Zotero 集合列表**
   - 从 Zotero 读取所有集合
   - 选择集合并扫描（调用 `/api/scan`），载入该集合中的文献

2. **中间：文献列表 + 已选 PDF 面板**
   - 上半部分：当前集合的文献列表
     - 勾选/取消勾选文献，组成“当前关注的一组文献”
   - 下半部分：Selected PDFs 面板
     - 展示已选文献，便于管理和快速查看

3. **右侧：AI 工具面板（AIToolsPanel）**
   - 标签页：**Summarize / Chat / Research / Categorize / Search**

### Summarize（总结）

1. 在中间列表选择一篇或多篇文献  
2. 在 Summarize 标签页中选择总结类型：
   - 完整总结（full）
   - 快速摘要（quick）
   - 关键点提取（key_points）
3. 点击 **生成总结**  
4. 生成时：
   - 上方进度条显示 PDF 加载 + AI 生成进度
   - 下方“思考模式”折叠卡片中流式显示正在生成的文本
   - 生成完成后，会进入报告视图，可复制结果或重新生成

### Research（深度研究）

1. 选择多篇相关文献  
2. 在 Research 标签页中输入研究问题（如：“这些文献的主要发现是什么？”）  
3. 点击 **生成报告**  
4. AI 会：
   - 读取 PDF 内容/摘要
   - 生成结构化研究报告（背景、方法、结果、局限、未来方向等）
   - 流式输出过程同样在折叠卡片中展示

### Categorize（快速分类）

1. 至少选择 2 篇文献  
2. 在 Categorize 标签页点击 **开始分类汇总**  
3. 模型只使用摘要信息执行：
   - 主题聚类：根据研究目标和场景把文献分为若干类别
   - 各类别代表文献与特点
   - 研究趋势与新兴方向
   - 简单“知识图谱”式的结构化输出  
4. 生成过程：
   - 折叠卡片中流式打印内容，并自动滚动到最新行
   - 折叠状态下可看到更多行，上方旧内容带有轻微“向上渐隐”的效果

### Chat（对话）

1. 选择若干文献  
2. 在 Chat 标签页中直接提问（解释、对比、改写等）  
3. 后端会将相关文献信息组合成上下文，让 AI 进行回答

### Search（搜索）

**语义搜索**（当前集合内）：
1. 针对当前已扫描的集合建立语义索引（首次搜索时）
2. 输入查询词，返回语义相关的文献列表
3. 可从搜索结果中添加文献到选中列表，再切换到 Summarize / Research / Chat 等标签继续分析

**全局搜索**（整个 Zotero 文库）：
- 按关键词在整个 Zotero 文库中搜索，无需先加载集合
- 结果显示文献元数据、PDF 可用性等信息
- 点击任意结果可查看详情或加载进行 AI 分析
- 结果自动去重，优先显示有 PDF 附件的条目

---

## 命令行（可选）

项目仍保留了原有的 CLI，用于快速操作：

```bash
# 列出所有 Zotero 集合
uv run main.py list

# 扫描指定集合（仅打印统计信息）
uv run main.py scan "My Collection"

# 在命令行中对集合做 AI 总结
uv run main.py summarize "My Collection" --limit 5

# 在命令行中生成深度研究报告
uv run main.py research "My Collection" -q "这些文献的主要发现是什么？"
```

---

## 注意事项

- **单用户、本地工具**  
  - API 进程中通过全局状态保存当前集合、索引等，仅适合本机单用户使用。

- **隐私与费用**  
  - 所有大模型调用都使用你自己的 API Key。  
  - 文献内容只会随请求发送给你配置的模型服务，不上传到其他地方。

- **性能与大文献**  
  - 大型 PDF 和特大集合会增加扫描、索引和总结的时间。  
  - 代码中对文本长度和 token 数做了限制，以避免请求超长。

---

## 许可证与贡献

- 默认使用 MIT License（如仓库中已有 `LICENSE` 文件，以该文件为准）。  
- 欢迎提 Issue / PR，或根据自己的需求 Fork 后定制。  
  英文版说明请参见根目录下的 `README.md`。
