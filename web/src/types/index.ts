export interface Collection {
    key: string;
    name: string;
    num_items: number;
    parent_key?: string | null;
}

export interface DocumentInfo {
    id: string;
    item_key: string;
    title: string;
    authors: string;
    abstract?: string | null;
    publication?: string | null;
    date?: string | null;
    doi?: string | null;
    tags: string[];
    pdf_path?: string | null;
    has_pdf: boolean;
    pdf_loaded: boolean;
    pdf_pages: number;
    scanned_at: string;
}

export interface ScanRequest {
    collection_name: string;
    load_pdf?: boolean;
}

export interface SummarizeRequest {
    doc_ids: string[];
    summary_type?: 'full' | 'quick' | 'key_points';
}

export interface SummaryResponse {
    title: string;
    summary: string;
}

export interface ResearchRequest {
    doc_ids: string[];
    question: string;
}

export interface ResearchResponse {
    report: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatRequest {
    message: string;
    doc_ids?: string[];
    history?: ChatMessage[];
}

export interface ChatResponse {
    response: string;
}
