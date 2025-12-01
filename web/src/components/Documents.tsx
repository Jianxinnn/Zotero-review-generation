import { useState } from 'react';
import { Search, Loader2, RefreshCw, Book, Calendar, Users, CheckCircle2 } from 'lucide-react';
import type { Collection, DocumentInfo } from '../types';

interface DocumentsProps {
  collections: Collection[];
  documents: DocumentInfo[];
  selectedDocIds: Set<string>;
  onToggleDoc: (id: string) => void;
  onLoadDocuments: (collectionName: string, loadPdf: boolean) => void;
  loading: boolean;
}

export function Documents({ 
  collections, 
  documents, 
  selectedDocIds, 
  onToggleDoc, 
  onLoadDocuments, 
  loading 
}: DocumentsProps) {
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadPdf, setLoadPdf] = useState(true);

  const filteredDocs = documents.filter(doc => {
    const term = searchTerm.toLowerCase();
    return (
      doc.title.toLowerCase().includes(term) ||
      doc.authors.toLowerCase().includes(term)
    );
  });

  const handleLoad = () => {
    if (selectedCollection) {
      onLoadDocuments(selectedCollection, loadPdf);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0B1120] relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />

      {/* Header Area */}
      <div className="p-8 pb-4 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Library</h2>
            <p className="text-slate-400">Manage and select your research papers</p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-white/5 backdrop-blur-sm">
            <div className="px-4">
              <select
                className="bg-transparent text-slate-200 text-sm font-medium focus:outline-none cursor-pointer min-w-[180px]"
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
              >
                <option value="" className="text-slate-500">Select Collection...</option>
                {collections.map(c => (
                  <option key={c.key} value={c.name} className="bg-slate-900">
                    {c.name} ({c.num_items})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="h-6 w-[1px] bg-white/10" />

            <div className="flex items-center gap-2 px-2">
               <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-200 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={loadPdf}
                    onChange={(e) => setLoadPdf(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-offset-0 focus:ring-1 focus:ring-indigo-500/50"
                  />
                  Load PDFs
               </label>
            </div>

            <button
              onClick={handleLoad}
              disabled={!selectedCollection || loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              <span className="hidden sm:inline">Load</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input
            type="text"
            placeholder="Search by title, author, or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-white/5 rounded-2xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-slate-900/80 transition-all"
          />
        </div>
      </div>

      {/* Document Grid */}
      <div className="flex-1 overflow-y-auto px-8 pb-8 relative z-10">
        {documents.length === 0 ? (
           <div className="h-64 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
             <Book size={48} className="mb-4 opacity-20" />
             <p className="text-lg font-medium">No documents loaded</p>
             <p className="text-sm opacity-60">Select a collection above to start</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredDocs.map(doc => {
              const isSelected = selectedDocIds.has(doc.id);
              return (
                <div 
                  key={doc.id}
                  onClick={() => onToggleDoc(doc.id)}
                  className={`group relative p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                    isSelected 
                      ? 'bg-indigo-900/20 border-indigo-500/50 shadow-[0_0_30px_-10px_rgba(99,102,241,0.3)]' 
                      : 'bg-slate-900/40 border-white/5 hover:bg-slate-800/50 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {doc.has_pdf ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                            PDF Ready
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border border-slate-600/20">
                            Metadata
                          </span>
                        )}
                        <span className="text-xs text-slate-500 truncate max-w-[200px]">{doc.publication}</span>
                      </div>
                      
                      <h3 className={`font-semibold text-lg leading-snug mb-2 transition-colors ${
                        isSelected ? 'text-indigo-100' : 'text-slate-200 group-hover:text-white'
                      }`}>
                        {doc.title}
                      </h3>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Users size={14} />
                          <span className="truncate max-w-[150px]">{doc.authors}</span>
                        </div>
                        {doc.date && (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} />
                            <span>{doc.date}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                      isSelected 
                        ? 'bg-indigo-500 border-indigo-500 text-white scale-110' 
                        : 'border-slate-600 bg-transparent text-transparent group-hover:border-slate-400'
                    }`}>
                      <CheckCircle2 size={14} fill="currentColor" className="text-white" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-12 bg-slate-950 border-t border-white/5 px-8 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing {filteredDocs.length} / {documents.length} documents
        </div>
        <div className="flex items-center gap-2">
          <span className={selectedDocIds.size > 0 ? 'text-indigo-400 font-medium' : ''}>
            {selectedDocIds.size} selected
          </span>
        </div>
      </div>
    </div>
  );
}
