import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Documents } from './components/Documents';
import { Analysis } from './components/Analysis';
import { Chat } from './components/Chat';
import * as api from './api/client';
import type { Collection, DocumentInfo } from './types';

function App() {
  const [view, setView] = useState('documents');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Fetch collections and existing documents on mount
  useEffect(() => {
    const init = async () => {
      try {
        const cols = await api.getCollections();
        setCollections(cols);
        const docs = await api.getDocuments();
        setDocuments(docs);
      } catch (error) {
        console.error("Failed to initialize:", error);
      }
    };
    init();
  }, []);

  const handleLoadDocuments = async (collectionName: string, loadPdf: boolean) => {
    setLoading(true);
    try {
      const docs = await api.scanCollection({ collection_name: collectionName, load_pdf: loadPdf });
      setDocuments(docs);
      setSelectedDocIds(new Set()); // Clear selection on new load
    } catch (e) {
      console.error(e);
      alert("Failed to load documents. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const toggleDoc = (id: string) => {
    const newSet = new Set(selectedDocIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedDocIds(newSet);
  };

  return (
    <div className="flex h-full bg-black text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      <Sidebar currentView={view} onViewChange={setView} />
      
      <main className="flex-1 relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950" />
        
        <div className="relative h-full z-10">
          {view === 'documents' && (
              <Documents 
                  collections={collections}
                  documents={documents}
                  selectedDocIds={selectedDocIds}
                  onToggleDoc={toggleDoc}
                  onLoadDocuments={handleLoadDocuments}
                  loading={loading}
              />
          )}
          {view === 'analysis' && (
              <Analysis documents={documents} selectedDocIds={selectedDocIds} />
          )}
          {view === 'chat' && (
              <Chat documents={documents} selectedDocIds={selectedDocIds} />
          )}
        </div>
      </main>
    </div>
  )
}

export default App;
