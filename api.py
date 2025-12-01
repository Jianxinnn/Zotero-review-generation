import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure project root is in path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from indexer import DocumentScanner, DocumentInfo
from ai import AISummarizer
from config import get_settings
from zotero import CollectionManager

app = FastAPI(title="Zotero Chat API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state (simplified for single-user local usage)
class GlobalState:
    def __init__(self):
        self.scanner = DocumentScanner()
        self.summarizer = AISummarizer()
        self.current_documents: List[DocumentInfo] = []

state = GlobalState()

class CollectionResponse(BaseModel):
    key: str
    name: str
    num_items: int
    parent_key: Optional[str] = None

class ScanRequest(BaseModel):
    collection_name: str
    load_pdf: bool = True

class SummarizeRequest(BaseModel):
    doc_ids: List[str]
    summary_type: str = "full"  # full, quick, key_points

class ResearchRequest(BaseModel):
    doc_ids: List[str]
    question: str

class ChatRequest(BaseModel):
    message: str
    doc_ids: Optional[List[str]] = None
    history: List[Dict[str, str]] = []

@app.get("/api/collections")
async def list_collections():
    try:
        # Access CollectionManager directly from scanner
        manager = state.scanner._collection_manager
        collections = manager.get_all_collections()
        return [
            {
                "key": c.key, 
                "name": c.name, 
                "num_items": c.num_items, 
                "parent_key": c.parent_key
            } 
            for c in collections
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scan")
async def scan_collection(request: ScanRequest):
    try:
        documents = state.scanner.scan_collection(
            request.collection_name,
            include_subcollections=False,
            load_pdf_content=request.load_pdf
        )
        state.current_documents = documents
        # Pydantic should handle DocumentInfo serialization
        return documents
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents")
async def get_documents():
    return state.current_documents

@app.post("/api/summarize")
async def summarize_documents(request: SummarizeRequest):
    try:
        # Filter selected documents
        selected_docs = [d for d in state.current_documents if d.id in request.doc_ids]
        
        if not selected_docs:
            raise HTTPException(status_code=400, detail="No documents found with provided IDs")

        if len(selected_docs) == 1:
            type_map = {"full": "full", "quick": "quick", "key_points": "key_points"}
            result = state.summarizer.summarize_document(
                selected_docs[0], 
                summary_type=type_map.get(request.summary_type, "full")
            )
            return {"title": result.title, "summary": result.summary}
        else:
            result = state.summarizer.summarize_multiple(selected_docs)
            return {"title": "Comprehensive Analysis", "summary": result.summary}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/research")
async def deep_research(request: ResearchRequest):
    try:
        selected_docs = [d for d in state.current_documents if d.id in request.doc_ids]
        if not selected_docs:
            raise HTTPException(status_code=400, detail="No documents found with provided IDs")
            
        result = state.summarizer.deep_research(request.question, selected_docs)
        return {"report": result.report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        context_docs = None
        if request.doc_ids:
             context_docs = [d for d in state.current_documents if d.id in request.doc_ids]
        
        response = state.summarizer.chat(
            request.message,
            context=context_docs,
            history=request.history
        )
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
