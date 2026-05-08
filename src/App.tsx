import { useState, useCallback } from 'react';
import type { ViewName } from '@/types';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import FrontDesk from '@/views/FrontDesk';
import ControlCenter from '@/views/ControlCenter';
import Archive from '@/views/Archive';

function ViewContainer({ view }: { view: ViewName }) {
  switch (view) {
    case 'frontDesk':
      return <FrontDesk />;
    case 'controlCenter':
      return <ControlCenter />;
    case 'archive':
      return <Archive />;
    default:
      return <FrontDesk />;
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewName>('frontDesk');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const viewDescriptions: Record<ViewName, { title: string; subtitle: string }> = {
    frontDesk: { title: 'Front Desk', subtitle: 'AI-powered query resolution interface' },
    controlCenter: { title: 'Control Center', subtitle: 'Real-time system performance monitoring' },
    archive: { title: 'Archive', subtitle: 'Knowledge base management and retrieval' },
  };

  const currentView = viewDescriptions[activeView];

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Header onMenuClick={toggleSidebar} />
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main Content */}
      <main
        className={`
          pt-[64px] min-h-screen transition-all duration-300
          ${isSidebarOpen ? 'lg:ml-[264px]' : 'lg:ml-0'}
        `}
      >
        <div className="p-4 sm:p-6 lg:p-8 h-[calc(100vh-64px)] overflow-y-auto">
          {activeView !== 'frontDesk' && (
            <div className="mb-6 view-transition">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                {currentView.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {currentView.subtitle}
              </p>
            </div>
          )}

          {/* View Content */}
          <div
            key={activeView}
            className="view-transition"
          >
            <ViewContainer view={activeView} />
          </div>
        </div>
      </main>
    </div>
  );
}
