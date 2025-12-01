import axios from 'axios';
import type { 
    Collection, 
    DocumentInfo, 
    ScanRequest, 
    SummarizeRequest, 
    SummaryResponse, 
    ResearchRequest, 
    ResearchResponse, 
    ChatRequest, 
    ChatResponse 
} from '../types';

const api = axios.create({
    baseURL: '/api', // Proxy will handle this
    headers: {
        'Content-Type': 'application/json',
    },
});

export const getCollections = async (): Promise<Collection[]> => {
    const response = await api.get<Collection[]>('/collections');
    return response.data;
};

export const scanCollection = async (req: ScanRequest): Promise<DocumentInfo[]> => {
    const response = await api.post<DocumentInfo[]>('/scan', req);
    return response.data;
};

export const getDocuments = async (): Promise<DocumentInfo[]> => {
    const response = await api.get<DocumentInfo[]>('/documents');
    return response.data;
};

export const summarizeDocuments = async (req: SummarizeRequest): Promise<SummaryResponse> => {
    const response = await api.post<SummaryResponse>('/summarize', req);
    return response.data;
};

export const deepResearch = async (req: ResearchRequest): Promise<ResearchResponse> => {
    const response = await api.post<ResearchResponse>('/research', req);
    return response.data;
};

export const chat = async (req: ChatRequest): Promise<ChatResponse> => {
    const response = await api.post<ChatResponse>('/chat', req);
    return response.data;
};
