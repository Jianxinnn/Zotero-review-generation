# 📚 Zotero 文献助手

一个 AI 驱动的 Zotero 文献管理和研究工具，帮助你高效地阅读、总结和分析学术文献。

## ✨ 功能特性

- **📂 集合扫描**: 读取 Zotero 中指定集合(文件夹)的所有文献
- **📑 PDF 解析**: 自动提取 PDF 文献的全文内容
- **🤖 AI 总结**: 使用 AI 对单篇或多篇文献进行智能总结
- **🔬 深度研究**: 基于文献进行深度研究分析，生成研究报告
- **💬 智能问答**: 基于文献内容进行对话式问答
- **🔍 语义搜索**: 建立向量索引，支持语义搜索
- **🖥️ Web UI**: 提供友好的 Streamlit Web 界面

## 📁 项目结构

```
zetero-chat/
├── main.py                 # 主入口 (CLI + UI)
├── config.py               # 配置管理
├── requirements.txt        # 依赖列表
├── .env.example           # 环境变量示例
├── README.md              # 项目说明
│
├── zotero/                # Zotero 模块
│   ├── __init__.py
│   ├── client.py          # Zotero API 客户端
│   ├── models.py          # 数据模型
│   └── collection.py      # 集合管理器
│
├── indexer/               # 索引模块
│   ├── __init__.py
│   ├── scanner.py         # 文档扫描器
│   └── index.py           # 向量索引管理
│
├── ai/                    # AI 模块
│   ├── __init__.py
│   ├── prompts.py         # Prompt 模板
│   └── summarizer.py      # AI 总结器
│
├── ui/                    # UI 模块
│   ├── __init__.py
│   ├── app.py             # Streamlit 应用
│   └── components.py      # UI 组件
│
└── utils/                 # 工具模块
    ├── __init__.py
    ├── pdf_reader.py      # PDF 读取器
    └── logger.py          # 日志工具
```

## 🚀 快速开始

### 1. 安装依赖

```bash
# 创建虚拟环境 (推荐)
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置:

```bash
cp .env.example .env
```

编辑 `.env` 文件:

```env
# Zotero 配置 (必需)
ZOTERO_LIBRARY_ID=your_library_id      # 你的 Zotero 用户 ID
ZOTERO_API_KEY=your_api_key            # Zotero API Key
ZOTERO_DATA_DIR=/Users/xxx/Zotero      # Zotero 本地数据目录

# AI 配置 (必需)
AI_API_KEY=your_openai_api_key         # OpenAI API Key
AI_MODEL=gpt-4o-mini                   # 使用的模型
AI_API_BASE=                           # 可选: 自定义 API 地址
```

#### 获取 Zotero API 配置

1. 登录 [Zotero 官网](https://www.zotero.org/)
2. 访问 [API Keys 页面](https://www.zotero.org/settings/keys)
3. 创建一个新的 API Key，勾选需要的权限
4. 记录你的 Library ID (在 Feeds/API 页面可以找到)

#### Zotero 数据目录

- macOS: `~/Zotero` 或 `~/Library/Application Support/Zotero`
- Windows: `C:\Users\<用户名>\Zotero`
- Linux: `~/Zotero`

你可以在 Zotero 客户端的 `编辑 > 首选项 > 高级 > 文件和文件夹` 中查看数据目录位置。

### 3. 启动应用

#### Web UI 方式 (推荐)

```bash
python main.py ui
```

然后在浏览器中访问 `http://localhost:8501`

#### 命令行方式

```bash
# 列出所有集合
python main.py list

# 扫描指定集合
python main.py scan "My Collection"

# AI 总结文献
python main.py summarize "My Collection" --limit 5

# 深度研究
python main.py research "My Collection" -q "这些文献的主要研究发现是什么?"
```

## 📖 使用指南

### 扫描集合

1. 在 Web UI 中选择 "📂 扫描集合"
2. 输入你在 Zotero 客户端中创建的集合名称
3. 选择是否包含子集合、是否加载 PDF 内容
4. 点击 "扫描集合"

### AI 总结

1. 先扫描一个集合
2. 选择 "🤖 AI 总结"
3. 选择要总结的文献
4. 选择总结类型 (完整总结/快速摘要/关键点提取)
5. 点击 "生成总结"

### 深度研究

1. 先扫描一个集合
2. 选择 "🔬 深度研究"
3. 输入你的研究问题
4. 选择相关文献
5. 点击 "开始研究"

### 智能问答

1. 选择 "💬 智能问答"
2. 可选: 选择上下文文献
3. 输入问题进行对话

## ⚙️ 高级配置

### 使用其他 AI 提供商

如果你使用兼容 OpenAI API 的其他服务，可以设置 `AI_API_BASE`:

```env
# 使用 Azure OpenAI
AI_API_BASE=https://your-resource.openai.azure.com/

# 使用本地 Ollama
AI_API_BASE=http://localhost:11434/v1
AI_MODEL=llama2
```

### 索引配置

```env
INDEX_PERSIST_DIR=./data/index    # 索引存储目录
INDEX_CHUNK_SIZE=1000             # 文本分块大小
INDEX_CHUNK_OVERLAP=200           # 分块重叠大小
```

## 🛠️ 开发

### 项目模块说明

| 模块 | 说明 |
|------|------|
| `zotero/` | Zotero API 交互，获取集合、条目、附件 |
| `indexer/` | 文档扫描、PDF 内容提取、向量索引 |
| `ai/` | AI 总结、深度研究、对话 |
| `ui/` | Streamlit Web 界面 |
| `utils/` | PDF 读取、日志等工具 |

### 扩展接口

项目设计了可扩展的接口，你可以:

- 在 `zotero/models.py` 中的 `SearchQuery` 添加更多搜索条件
- 在 `ai/prompts.py` 中添加自定义 Prompt 模板
- 在 `indexer/index.py` 中扩展索引功能

## 📝 注意事项

1. **PDF 文件访问**: 需要确保 `ZOTERO_DATA_DIR` 配置正确，且有权限读取
2. **API 调用**: AI 总结功能需要消耗 API 调用配额
3. **大文件处理**: 大型 PDF 文件可能需要较长的处理时间
4. **缓存**: 扫描结果会缓存在内存中，重启应用后需要重新扫描

## 📄 License

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!
