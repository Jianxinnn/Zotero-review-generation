import { useState } from 'react';
import { FileText, Microscope, Sparkles, Loader2, Download, ChevronRight, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { DocumentInfo, SummarizeRequest } from '../types';
import * as api from '../api/client';

interface AnalysisProps {
  documents: DocumentInfo[];
  selectedDocIds: Set<string>;
}

export function Analysis({ documents, selectedDocIds }: AnalysisProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'research'>('summary');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title?: string; content: string } | null>(null);
  const [summaryType, setSummaryType] = useState<SummarizeRequest['summary_type']>('full');
  const [question, setQuestion] = useState('');

  const selectedDocs = documents.filter(d => selectedDocIds.has(d.id));

  const handleSummarize = async () => {
    if (selectedDocs.length === 0) return;
    setLoading(true);
    try {
      const response = await api.summarizeDocuments({
        doc_ids: selectedDocs.map(d => d.id),
        summary_type: summaryType
      });
      setResult({ title: response.title, content: response.summary });
    } catch (error) {
      console.error(error);
      setResult({ title: "Error", content: "Failed to generate summary." });
    } finally {
      setLoading(false);
    }
  };

  const handleResearch = async () => {
    if (selectedDocs.length === 0 || !question) return;
    setLoading(true);
    try {
      const response = await api.deepResearch({
        doc_ids: selectedDocs.map(d => d.id),
        question
      });
      setResult({ title: "Research Report", content: response.report });
    } catch (error) {
      console.error(error);
      setResult({ title: "Error", content: "Failed to conduct research." });
    } finally {
      setLoading(false);
    }
  };

  if (selectedDocs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0B1120] text-slate-500">
        <div className="w-20 h-20 rounded-3xl bg-slate-800/50 flex items-center justify-center mb-6 animate-pulse">
          <FileText size={40} className="opacity-40" />
        </div>
        <h3 className="text-xl font-semibold text-slate-300 mb-2">No Selection</h3>
        <p className="text-slate-500 max-w-sm text-center">Select documents from your library to unlock AI analysis tools.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#0B1120] overflow-hidden">
      {/* Left Controls Panel */}
      <div className="w-[400px] flex-shrink-0 flex flex-col border-r border-white/5 bg-slate-900/30 backdrop-blur-sm">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white mb-1">Analysis</h2>
          <p className="text-sm text-slate-400">Analyzing <span className="text-indigo-400 font-medium">{selectedDocs.length}</span> documents</p>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
          {/* Mode Switch */}
          <div className="flex p-1 bg-slate-900 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'summary' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab('research')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'research' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Deep Research
            </button>
          </div>

          {activeTab === 'summary' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Summary Type</label>
                <div className="grid gap-3">
                  {[
                    { id: 'full', label: 'Comprehensive', desc: 'Detailed overview of all content' },
                    { id: 'quick', label: 'Abstract', desc: 'Short executive summary' },
                    { id: 'key_points', label: 'Key Points', desc: 'Bulleted list of main findings' }
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => setSummaryType(type.id as SummarizeRequest['summary_type'])}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        summaryType === type.id 
                          ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/20' 
                          : 'bg-slate-800/30 border-white/5 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className={`font-medium mb-0.5 ${summaryType === type.id ? 'text-indigo-300' : 'text-slate-300'}`}>
                        {type.label}
                      </div>
                      <div className="text-xs text-slate-500">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSummarize}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                <span>Generate Analysis</span>
                {!loading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Research Goal</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g., Compare the methodologies used in these papers..."
                  className="w-full h-40 p-4 bg-slate-800/30 border border-white/10 rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                />
              </div>

              <button
                onClick={handleResearch}
                disabled={loading || !question}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Microscope size={18} />}
                <span>Start Research</span>
                {!loading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Result Panel */}
      <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-slate-900/20 backdrop-blur-md z-10">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <span>Result</span>
            <ChevronRight size={14} />
            <span className="text-slate-200 font-medium truncate max-w-xs">{result?.title || 'Ready'}</span>
          </div>
          {result && (
            <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <Download size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-12 py-10 custom-scrollbar">
          {result ? (
            <div className="max-w-3xl mx-auto animate-in fade-in duration-500 slide-in-from-bottom-4">
              <h1 className="text-3xl font-bold text-white mb-8 leading-tight">{result.title}</h1>
              <div className="prose prose-invert prose-lg max-w-none prose-headings:text-indigo-100 prose-a:text-indigo-400 prose-strong:text-white prose-blockquote:border-l-indigo-500 prose-blockquote:bg-indigo-500/10 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg">
                <ReactMarkdown>{result.content}</ReactMarkdown>
              </div>
              <div className="h-20" /> {/* Bottom padding */}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600">
              <div className="w-32 h-32 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center mb-6 shadow-2xl shadow-black/50">
                <Sparkles size={48} className="text-slate-700" />
              </div>
              <p className="text-lg font-medium text-slate-400">Ready to Analyze</p>
              <p className="max-w-xs text-center mt-2 text-sm">Configure your analysis parameters on the left to generate insights.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
