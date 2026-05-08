import { Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import logo from '@/assets/image.png';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="fixed top-0 left-0 right-0 h-[64px] glass-strong z-50 flex items-center justify-between px-4 lg:px-6">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 hover:bg-accent rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          <Menu size={20} className="text-foreground" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg glow-sm overflow-hidden">
            <img src={logo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-black text-foreground tracking-tight leading-none">
              NEOVERSE
            </span>
            <span className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase leading-none mt-0.5">
              AI Desk
            </span>
          </div>
        </div>
      </div>

      {/* Center - Search bar (hidden on small screens) */}
      

      {/* Right section */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Version badge */}
        <span className="hidden sm:inline-flex items-center px-2 py-1 text-[10px] font-mono text-muted-foreground bg-surface-2 border border-border rounded-md">
          v2.4.1
        </span>

        
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="relative p-2 hover:bg-accent rounded-lg transition-all group"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <Moon size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : (
            <Sun size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </button>

        {/* Status indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
            Online
          </span>
        </div>

        
      
      </div>
    </header>
  );
}
