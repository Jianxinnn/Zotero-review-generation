import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Eraser, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { DocumentInfo, ChatMessage } from '../types';
import * as api from '../api/client';

interface ChatProps {
  documents: DocumentInfo[];
  selectedDocIds: Set<string>;
}

export function Chat({ documents, selectedDocIds }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedDocs = documents.filter(d => selectedDocIds.has(d.id));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.chat({
        message: userMsg.content,
        doc_ids: selectedDocs.map(d => d.id),
        history: messages
      });
      
      setMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please check the API connection." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0B1120] relative">
      {/* Header */}
      <div className="h-16 border-b border-white/5 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Bot size={18} />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">Assistant</h2>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${selectedDocs.length > 0 ? 'bg-emerald-500' : 'bg-slate-600'}`} />
              <span className="text-xs text-slate-400">
                {selectedDocs.length > 0 
                  ? `${selectedDocs.length} documents in context` 
                  : 'General knowledge mode'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setMessages([])}
          className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          title="Clear History"
        >
          <Eraser size={16} />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 pb-20">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 flex items-center justify-center mb-6 animate-pulse">
              <Sparkles size={40} className="text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">How can I help?</h3>
            <p className="text-sm max-w-md text-center mb-8">
              I can answer questions about your {selectedDocs.length} selected documents, summarize content, or help connect ideas.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full px-4">
              {['What are the main findings?', 'Compare the methodologies', 'Extract key statistics', 'Draft an abstract'].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="p-4 rounded-xl bg-slate-800/40 border border-white/5 hover:bg-slate-800/80 hover:border-indigo-500/30 text-left text-sm text-slate-300 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-4 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.role === 'user' ? 'justify-end' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-1">
                  <Bot size={16} className="text-indigo-400" />
                </div>
              )}
              
              <div className={`max-w-[80%] rounded-2xl px-6 py-4 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-sm' 
                  : 'bg-slate-800/50 border border-white/5 text-slate-200 rounded-tl-sm'
              }`}>
                <div className={`prose prose-sm max-w-none ${
                  msg.role === 'user' ? 'prose-invert' : 'prose-invert prose-a:text-indigo-400 prose-code:bg-slate-950/50 prose-code:px-1 prose-code:rounded'
                }`}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-1">
                  <User size={16} className="text-slate-300" />
                </div>
              )}
            </div>
          ))
        )}
        
        {loading && (
           <div className="flex gap-4 max-w-3xl mx-auto">
             <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Loader2 className="animate-spin text-indigo-400" size={16} />
             </div>
             <div className="flex items-center gap-2 text-slate-500 text-sm">
                <span className="animate-pulse">Thinking...</span>
             </div>
           </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-6 pt-0">
        <div className="max-w-3xl mx-auto relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity" />
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl flex items-center shadow-xl">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask something about the research..."
              className="flex-1 bg-transparent border-none text-slate-200 placeholder:text-slate-500 px-6 py-4 focus:ring-0"
              disabled={loading}
            />
            <div className="pr-3">
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-all transform hover:scale-105 active:scale-95"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
          <div className="text-center mt-3">
             <p className="text-[10px] text-slate-600 flex items-center justify-center gap-1">
               <Zap size={10} />
               AI-generated content may contain inaccuracies
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
