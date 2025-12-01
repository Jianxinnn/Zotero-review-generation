import { BookOpen, Sparkles, MessageSquare, Settings } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const menuItems = [
    { id: 'documents', label: 'Library', icon: BookOpen, description: 'Manage papers' },
    { id: 'analysis', label: 'Analysis', icon: Sparkles, description: 'AI Insights' },
    { id: 'chat', label: 'Assistant', icon: MessageSquare, description: 'Chat with docs' },
  ];

  return (
    <aside className="w-[260px] flex-shrink-0 flex flex-col bg-slate-900/50 border-r border-white/5 backdrop-blur-xl h-full">
      {/* Brand */}
      <div className="p-6 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <Sparkles size={20} fill="currentColor" className="text-white/90" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white">Zotero Chat</h1>
            <div className="text-xs text-slate-400 font-medium">Research Pro</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                isActive 
                  ? 'bg-white/10 text-white shadow-inner border border-white/5' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-xl" />
              )}
              <item.icon 
                size={20} 
                className={`transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'}`} 
              />
              <div className="text-left">
                <div className="font-medium text-sm leading-none mb-1">
                  {item.label}
                </div>
                <div className="text-[10px] text-slate-500 group-hover:text-slate-400 font-medium">
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 mt-auto border-t border-white/5">
        <button className="w-full flex items-center gap-3 p-2.5 rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors">
          <Settings size={18} />
          <span className="text-xs font-medium uppercase tracking-wider">Settings</span>
        </button>
      </div>
    </aside>
  );
}
