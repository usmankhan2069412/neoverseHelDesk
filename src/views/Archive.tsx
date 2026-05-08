import { useState, useCallback } from 'react';
import {
  Search, Plus, FileText, Tag,
  CheckCircle, Clock, XCircle, Upload, FolderOpen,
  Filter, ExternalLink, Trash2, Edit3, LayoutGrid, List, X,
  Calendar,
} from 'lucide-react';
import type { Document } from '@/types';
import { documents as initialDocs, categories } from '@/data/mockData';

function DocStatusBadge({ status }: { status: Document['status'] }) {
  const config = {
    indexed: {
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      text: 'text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-500/20',
      icon: <CheckCircle size={10} />,
      label: 'Indexed',
    },
    processing: {
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      text: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-500/20',
      icon: <Clock size={10} />,
      label: 'Processing',
    },
    failed: {
      bg: 'bg-red-50 dark:bg-red-500/10',
      text: 'text-red-700 dark:text-red-400',
      border: 'border-red-200 dark:border-red-500/20',
      icon: <XCircle size={10} />,
      label: 'Failed',
    },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${c.bg} ${c.text} ${c.border}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

type ViewMode = 'list' | 'grid';

export default function Archive() {
  const [docs, setDocs] = useState<Document[]>(initialDocs);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('Infrastructure');
  const [newDocTags, setNewDocTags] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const filteredDocs = docs.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const newDoc: Document = {
      id: Date.now().toString(),
      title: `Uploaded_${Date.now()}.pdf`,
      author: 'Current User',
      dateAdded: new Date().toISOString().split('T')[0],
      status: 'processing',
      lastUsed: 'Never',
      category: 'Uncategorized',
      tags: ['uploaded'],
    };
    setDocs((prev) => [newDoc, ...prev]);
    setTimeout(() => {
      setDocs((prev) =>
        prev.map((d) => (d.id === newDoc.id ? { ...d, status: 'indexed' as const } : d))
      );
    }, 2000);
  }, []);

  const handleAddDoc = () => {
    if (!newDocTitle.trim()) return;
    const doc: Document = {
      id: Date.now().toString(),
      title: newDocTitle,
      author: 'Current User',
      dateAdded: new Date().toISOString().split('T')[0],
      status: 'processing',
      lastUsed: 'Never',
      category: newDocCategory,
      tags: newDocTags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    setDocs((prev) => [doc, ...prev]);
    setNewDocTitle('');
    setNewDocTags('');
    setShowAddPanel(false);
    setTimeout(() => {
      setDocs((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, status: 'indexed' as const } : d))
      );
    }, 2000);
  };

  const handleDelete = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header with Search & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documents, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-surface-2 border border-border rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          <button
            onClick={() => setShowAddPanel(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
          >
            <Plus size={16} />
            Add Entry
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer group
          ${isDragOver
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border bg-surface-1 hover:border-primary/40 hover:bg-surface-2'
          }
        `}
      >
        <div className={`
          w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-all duration-300
          ${isDragOver
            ? 'bg-primary/20 text-primary scale-110'
            : 'bg-surface-2 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10'
          }
        `}>
          <Upload size={28} />
        </div>
        <p className="text-sm text-foreground font-semibold">
          {isDragOver ? 'Drop files here to upload' : 'Drop documentation here to embed'}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          Supports PDF, DOCX, TXT, and URL input
        </p>
      </div>

      {/* Category Filter + Document List */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Category Sidebar */}
        <div className="lg:w-52 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={12} className="text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Categories
            </span>
          </div>
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {categories.map((cat) => {
              const count = cat === 'All'
                ? docs.length
                : docs.filter((d) => d.category === cat).length;
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`
                    flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-xl whitespace-nowrap transition-all
                    ${isActive
                      ? 'bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }
                  `}
                >
                  <span>{cat}</span>
                  <span className={`ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Document Content */}
        <div className="flex-1">
          {viewMode === 'list' ? (
            /* Table View */
            <div className="card-elevated bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border">
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Document</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Category</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Tags</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Added</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Last Used</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((doc) => (
                      <tr
                        key={doc.id}
                        className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FileText size={14} className="text-primary" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-foreground truncate block max-w-[180px]">{doc.title}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{doc.author}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-surface-2 text-foreground rounded-md text-[10px] font-bold uppercase">
                            {doc.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {doc.tags.map((tag) => (
                              <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded-md text-[10px] font-medium">
                                <Tag size={8} />
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3"><DocStatusBadge status={doc.status} /></td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">{doc.dateAdded}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">{doc.lastUsed}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-0.5">
                            <button className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                              <Edit3 size={12} />
                            </button>
                            <button className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                              <ExternalLink size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredDocs.length === 0 && (
                <div className="p-12 text-center">
                  <FolderOpen size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">No documents found</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredDocs.map((doc, i) => (
                <div
                  key={doc.id}
                  className="card-elevated bg-card border border-border rounded-2xl p-4 group"
                  style={{
                    animation: `fadeInUp 0.3s ease-out forwards`,
                    animationDelay: `${i * 50}ms`,
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                      <FileText size={18} className="text-primary" />
                    </div>
                    <DocStatusBadge status={doc.status} />
                  </div>
                  <h4 className="text-sm font-bold text-foreground mb-1 truncate">{doc.title}</h4>
                  <p className="text-[10px] text-muted-foreground font-mono mb-3">{doc.author}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {doc.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded-md text-[10px] font-medium">
                        <Tag size={8} />
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar size={10} />
                      <span className="font-mono">{doc.dateAdded}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                        <Edit3 size={12} />
                      </button>
                      <button className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                        <ExternalLink size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredDocs.length === 0 && (
                <div className="col-span-full py-12 text-center">
                  <FolderOpen size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">No documents found</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Entry Panel (Modal) */}
      {showAddPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowAddPanel(false)}
          style={{ animation: 'fadeIn 0.15s ease-out forwards' }}
        >
          <div
            className="bg-card border border-border shadow-2xl w-full max-w-md mx-4 p-6 rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'modalIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-foreground">Add Knowledge Entry</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Create a new document entry</p>
              </div>
              <button
                onClick={() => setShowAddPanel(false)}
                className="p-1.5 hover:bg-accent rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Document title..."
                  className="w-full px-3 py-2.5 text-sm bg-surface-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <select
                  value={newDocCategory}
                  onChange={(e) => setNewDocCategory(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-surface-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                >
                  {categories.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={newDocTags}
                  onChange={(e) => setNewDocTags(e.target.value)}
                  placeholder="tag1, tag2, tag3..."
                  className="w-full px-3 py-2.5 text-sm bg-surface-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowAddPanel(false)}
                className="px-4 py-2.5 text-xs font-bold text-muted-foreground bg-surface-2 rounded-xl hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDoc}
                className="px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
              >
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
