# Zotero Chat – AI‑Powered Literature Assistant

Zotero Chat is a local, AI‑powered assistant built around your Zotero library.  
It helps you scan collections, read PDFs, summarize papers, run deep research, categorize topics, and ask questions – all from a modern web UI.

Backend is a FastAPI service over your Zotero database; frontend is a Next.js app with streaming AI UX.

---

## Features

- **Connect to Zotero**
  - Scan any Zotero collection (folder) and list all items
  - Detect and read attached PDFs from your local Zotero data directory

- **AI Summaries**
  - Summarize one or many papers at once
  - Modes: full summary, quick abstract‑style summary, key points
  - Streaming output with a “thinking” panel you can expand while it generates

- **Deep Research**
  - Ask a research question over a set of papers
  - Generates a structured report (background, methods, findings, limitations, trends, etc.)

- **Quick Categorization**
  - Uses only abstracts to group papers into themes
  - Produces topic overviews, trend analysis, and a small “knowledge graph” section
  - Optimized for fast, streaming analysis without loading full PDFs

- **Chat With Your Papers**
  - Conversational Q&A grounded in selected documents
  - Maintains short history for multi‑turn questions

- **Semantic Search**
  - Builds a local vector index over the current collection
  - Search by meaning (not just keywords) and jump into AI tools from the results

- **Global Search**
  - Search across your entire Zotero library by keywords (title, author, etc.)
  - No need to load a collection first – search results include all matching items
  - Deduplicated results with PDF versions prioritized
  - View document details and load them for AI analysis

- **Document Detail Dialog**
  - View detailed metadata for any document (title, authors, date, abstract, etc.)
  - See when the document was scanned and indexed
  - Quick access to PDF viewing and AI tools

- **Session Persistence**
  - Your current session (scanned collection, loaded documents, index) is saved automatically
  - Resume your work seamlessly after restarting the application

- **Modern Web UI**
  - Next.js + React + Tailwind, with a three‑panel layout:
    - Left: Zotero collections
    - Center: document list & selected PDFs
    - Right: AI tools (Summarize / Chat / Research / Categorize / Search)

All processing happens locally except calls to your configured AI provider.

---

## Project Structure

```txt
zetero-chat/
├── api.py               # FastAPI application (Zotero Chat API)
├── main.py              # Entry point (CLI + API server launcher)
├── config.py            # App / Zotero / AI / index settings
├── requirements.txt     # Python dependencies
├── start.sh             # Legacy helper script (see usage below)
├── data/                # Runtime data (session, index)
│   └── session.json     # Auto-saved session state
├── ai/                  # AI integration
│   ├── __init__.py
│   ├── prompts.py       # Prompt templates
│   └── summarizer.py    # Summarizer / research / categorize / chat
├── indexer/             # Scanning + semantic index
│   ├── __init__.py
│   ├── scanner.py       # Reads Zotero collections & PDFs
│   └── index.py         # Vector index manager
├── zotero/              # Zotero client + models
│   ├── __init__.py
│   ├── client.py        # Zotero API client + global search
│   ├── models.py        # Data models (DocumentInfo, etc.)
│   └── collection.py    # Collection management
├── utils/               # Utilities
│   ├── __init__.py
│   ├── logger.py        # Logging configuration
│   └── pdf_reader.py    # PDF extraction utilities
└── web-ui/              # Next.js web interface
    ├── app/             # Next.js app entry
    ├── components/      # React components + AI panels
    ├── lib/             # Frontend types & API helpers
    └── ...              # Tailwind, config, etc.
```

---

## Prerequisites

- **Python** ≥ 3.9
- **Node.js** ≥ 18 (recommended 20+)
- **Zotero Desktop**
  - With a valid **API key**
  - And access to your local Zotero data directory (for PDFs)
- An AI provider compatible with the OpenAI Chat Completions API  
  (OpenAI, Azure OpenAI, or a self‑hosted compatible service)

---

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/Jianxinnn/Zotero-review-generation
cd zetero-chat
```

### 2. Install uv (Python package & env manager)

If you don’t have [uv](https://github.com/astral-sh/uv) yet:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# Windows (PowerShell):
# irm https://astral.sh/uv/install.ps1 | iex
```

Make sure `uv` is on your `PATH` (usually restarting the shell is enough).

### 3. Create a virtualenv and install backend deps

```bash
uv venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

uv pip install -r requirements.txt
```

### 4. Install frontend dependencies

```bash
cd web-ui
npm install   # or: pnpm install / yarn
cd ..
```

---

## Configuration

The app reads configuration from environment variables via `.env`.  
An example file is provided:

```bash
cp .env.example .env
```

Open `.env` and fill at least:

```env
# Zotero (required)
ZOTERO_LIBRARY_ID=your_library_id
ZOTERO_LIBRARY_TYPE=user          # or group
ZOTERO_API_KEY=your_zotero_api_key
ZOTERO_DATA_DIR=/Users/you/Zotero # local Zotero data directory

# AI provider (required)
AI_PROVIDER=openai                # openai | azure | ollama
AI_API_KEY=your_openai_key
AI_MODEL=gpt-4o-mini              # or any model your provider supports
# Optional: custom base URL (Azure / proxy / local LLM)
AI_API_BASE=

# Index (optional – reasonable defaults are provided)
INDEX_PERSIST_DIR=./data/index
INDEX_CHUNK_SIZE=1000
INDEX_CHUNK_OVERLAP=200

# Chat (optional)
# Max docs included for full-context chat
CHAT_MAX_FULL_DOCS=20
# Max docs for abstract-only chat, leave empty for no limit
CHAT_MAX_ABSTRACT_DOCS=
```

**Where to find Zotero settings**

- API key & Library ID: https://www.zotero.org/settings/keys
- Local data dir:
  - macOS: `~/Zotero` or `~/Library/Application Support/Zotero`
  - Windows: `C:\Users\<user>\Zotero`
  - Linux: `~/Zotero`

---

## Running the App

### 1. Start the API server

From the project root:

```bash
source .venv/bin/activate  # if not already
uv run main.py ui          # starts FastAPI (default: http://localhost:8000)
```

You can change the port if needed:

```bash
uv run main.py ui --port 9000
```

### 2. Start the web UI

In another terminal:

```bash
cd web-ui

# If you changed the API port/host, set this; otherwise it defaults to http://localhost:8000
export NEXT_PUBLIC_API_URL="http://localhost:8000"

npm run dev   # Next.js dev server (default: http://localhost:3000)
```

Open the browser at: **http://localhost:3000**

---

## Using Zotero Chat (Web UI)

The main screen has three areas:

1. **Left – Collections**
   - Browse your Zotero collections
   - Scan a collection to load its items into the app (via `/api/scan`)

2. **Center – Documents & Selected PDFs**
   - Top: list of documents in the current collection
     - Select / deselect items to build a working set
   - Bottom: “Selected PDFs” panel showing what is currently selected

3. **Right – AI Tools Panel**
   - Tabs: **Summarize · Chat · Research · Categorize · Search**

### Summarize tab

- Choose one or more papers from the center list.
- Pick a summary type:
  - Full summary
  - Quick summary
  - Key points
- Click **Generate summary**.
- While it runs:
  - A progress bar shows PDF loading + generation
  - A “thinking” card shows streaming model output; you can expand/collapse it
  - Once complete, the full summary appears in a report view and can be copied

### Research tab (deep research)

- Select several related papers.
- Enter a research question (e.g. *“What are the main findings about X?”*).
- Click **Generate report**.
- The model:
  - Reads PDF content / abstracts
  - Writes a multi‑section research report (methods, findings, gaps, trends…)
  - Streams the intermediate reasoning in the side card

### Categorize tab (quick categorization)

- Select at least 2 papers.
- Click **Start categorization**.
- The model uses **only abstracts** to:
  - Group papers into thematic categories
  - Describe each group (representative papers, characteristics)
  - Highlight trends and provide a small knowledge‑graph‑style outline
- The “thinking” card shows the report as it is generated, auto‑scrolling to the latest lines.

### Chat tab

- Chat with the assistant about your selected papers:
  - Ask for clarification, comparisons, “explain like I’m 5”, etc.
  - The backend injects relevant PDF content / abstracts as context.

### Search tab

**Semantic Search** (within current collection):
- Runs semantic search over the **currently scanned collection**
- Builds a vector index on demand
- Returns results with titles and content snippets
- You can then select interesting papers and switch to Summarize / Research / Chat

**Global Search** (across entire Zotero library):
- Search by keywords across your entire Zotero library – no collection needed
- Results show document metadata, PDF availability, and more
- Click any result to view details or load it for AI analysis
- Deduplicated results prioritize entries with PDF attachments

---

## CLI Usage (Optional)

The original CLI is still available for quick tasks:

```bash
# List Zotero collections
uv run main.py list

# Scan a collection (CLI only, prints stats)
uv run main.py scan "My Collection"

# Summarize a collection in the terminal
uv run main.py summarize "My Collection" --limit 5

# Generate a deep research report in the terminal
uv run main.py research "My Collection" -q "What are the main findings about X?"
```

---

## Notes & Limitations

- **Single‑user, local tool**  
  Global in‑memory state is kept in the API process (current collection, index, etc.).

- **AI costs & privacy**  
  - All calls to the AI provider use your own API key.
  - PDFs and metadata never leave your machine except as model prompts.

- **Large collections / PDFs**  
  - Very large collections or long PDFs will take longer to scan and summarize.
  - Indexing and summaries are truncated to configurable token / text limits.

---

## License

MIT License – see `LICENSE` if present, or adapt as needed for your own use.

---

## Contributing

Issues, feature requests, and pull requests are all welcome.  
You can also use `README_CN.md` for a Chinese overview of the project.
