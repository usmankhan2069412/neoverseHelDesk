import { MessageSquare, LayoutDashboard, BookOpen, Sparkles, ChevronLeft } from 'lucide-react';
import type { ViewName } from '@/types';

const navItems: { id: ViewName; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'frontDesk', label: 'Front Desk', icon: <MessageSquare size={18} />, description: 'AI Chat Interface' },
  { id: 'controlCenter', label: 'Control Center', icon: <LayoutDashboard size={18} />, description: 'Dashboard & Analytics' },
  { id: 'archive', label: 'Archive', icon: <BookOpen size={18} />, description: 'Knowledge Base' },
];



interface SidebarProps {
  activeView: ViewName;
  setActiveView: (view: ViewName) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function Sidebar({ activeView, setActiveView, isOpen, setIsOpen }: SidebarProps) {
  const handleClick = (view: ViewName) => {
    setActiveView(view);
    // Only close on mobile after selection
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
          style={{ animation: 'fadeIn 0.2s ease-out forwards' }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-[64px] h-[calc(100vh-64px)] w-[264px] bg-card border-r border-border z-50
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full py-4">
          {/* Header with Close Button */}
          <div className="px-4 mb-6 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Main Menu
            </p>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleClick(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl
                    transition-all duration-200 group relative
                    ${
                      isActive
                        ? 'bg-primary/10 text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }
                  `}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                  )}
                  <span className={`transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                    {item.icon}
                  </span>
                  <div className="text-left flex-1">
                    <span>{item.label}</span>
                    {isActive && (
                      <p className="text-[9px] text-primary/70 font-normal mt-0.5">{item.description}</p>
                    )}
                  </div>
                  {isActive && (
                    <Sparkles size={12} className="text-primary animate-pulse" />
                  )}
                </button>
              );
            })}
            
          </nav>

        </div>
      </aside>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
