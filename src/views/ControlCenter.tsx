import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid,
} from 'recharts';
import {
  MessageSquare, CheckCircle, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Search,
  TrendingUp, Activity, Zap, Shield, X,
  RefreshCw, ChevronLeft, ChevronRight, ArrowUpDown, WifiOff, ChevronDown, ChevronUp, Check, XCircle,
} from 'lucide-react';
import { getStats, getKnowledgeGaps, updateKnowledgeGap, type DashboardStats, type KnowledgeGap } from '@/services/api';


function KPICard({
  label, value, trend, trendDirection, icon: Icon,
}: {
  label: string; value: string; trend: string; trendDirection: 'up' | 'down';
  icon: React.ElementType;
}) {
  return (
    <div className="card-elevated bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-foreground/5 rounded-bl-full" />
      
      <div className="flex items-start justify-between mb-4 relative">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <div className="p-2 rounded-xl bg-foreground text-background shadow-md">
          <Icon size={15} />
        </div>
      </div>
      <div className="text-3xl font-black text-foreground tracking-tight relative">
        {value}
      </div>
      <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-foreground">
        {trendDirection === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {trend}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/95 backdrop-blur-md text-popover-foreground px-4 py-3 rounded-xl shadow-xl border border-border text-xs">
        <p className="font-mono font-semibold mb-1.5">{label}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-mono font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Generate hourly chart data from recent queries
function buildChartData(recentQueries: DashboardStats['recent_queries']) {
  const hours: Record<string, { queries: number; resolved: number }> = {};
  for (let h = 0; h < 24; h += 2) {
    const label = `${h.toString().padStart(2, '0')}:00`;
    hours[label] = { queries: 0, resolved: 0 };
  }
  for (const q of recentQueries) {
    const d = new Date(q.created_at);
    const h = Math.floor(d.getHours() / 2) * 2;
    const label = `${h.toString().padStart(2, '0')}:00`;
    if (hours[label]) {
      hours[label].queries += 1;
      hours[label].resolved += 1; // assume resolved since we got an answer
    }
  }
  return Object.entries(hours).map(([time, data]) => ({ time, ...data }));
}

export default function ControlCenter() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedQuery, setSelectedQuery] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sort
  const [sortAsc, setSortAsc] = useState(false);

  // Expanded rows
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Tab toggle: 'queries' | 'gaps'
  const [activeTab, setActiveTab] = useState<'queries' | 'gaps'>('queries');
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'answered' | 'unanswered'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');

  const fetchStats = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await getStats();
      setStats(data);
      setError(false);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch stats on mount and refresh every 30s
  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => fetchStats(), 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Fetch knowledge gaps when tab switches
  const fetchGaps = useCallback(async () => {
    setGapsLoading(true);
    try {
      const data = await getKnowledgeGaps();
      setGaps(data);
    } catch {
      // Silently fail — gaps are non-critical
    } finally {
      setGapsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'gaps') fetchGaps();
  }, [activeTab, fetchGaps]);

  const totalQueries = stats?.total_queries ?? 0;
  const resolutionRate = stats?.resolution_rate ?? 0;
  const thumbsUp = stats?.thumbs_up_count ?? 0;
  const thumbsDown = stats?.thumbs_down_count ?? 0;

  // Build chart data from real queries
  const chartData = stats ? buildChartData(stats.recent_queries) : [];

  // Build sentiment data from feedback
  const totalFeedback = thumbsUp + thumbsDown;
  const sentimentData = totalFeedback > 0
    ? [
        { name: 'Positive', value: Math.round((thumbsUp / totalFeedback) * 100), color: 'hsl(var(--foreground))' },
        { name: 'Negative', value: Math.round((thumbsDown / totalFeedback) * 100), color: 'hsl(var(--muted-foreground))' },
      ]
    : [];

  // Build intent distribution
  const intentData = stats?.intents
    ? Object.entries(stats.intents).map(([type, count], i) => {
        const opacities = [1, 0.8, 0.6, 0.4, 0.2, 0.1];
        return { type, count, fill: `hsl(var(--foreground) / ${opacities[i % opacities.length]})` };
      })
    : [];

  // Recent queries for the table
  const recentQueries = stats?.recent_queries ?? [];
  const filteredQueries = useMemo(() => {
    let filtered = recentQueries;
    
    // Status Filter
    if (statusFilter === 'answered') {
      filtered = filtered.filter(q => !q.is_unanswered);
    } else if (statusFilter === 'unanswered') {
      filtered = filtered.filter(q => q.is_unanswered);
    }
    
    // Search Filter
    if (searchFilter) {
      filtered = filtered.filter((q) =>
        q.text?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        q.intent?.toLowerCase().includes(searchFilter.toLowerCase())
      );
    }
    
    return filtered;
  }, [recentQueries, searchFilter, statusFilter]);

  const sortedQueries = [...filteredQueries]
    .sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortAsc ? diff : -diff;
    });

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(sortedQueries.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQueries = sortedQueries.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Filter Gaps
  const filteredGaps = useMemo(() => {
    let filtered = gaps;
    
    // Date filter
    const now = Date.now();
    if (dateFilter === '24h') {
      filtered = filtered.filter(g => now - new Date(g.last_seen).getTime() <= 24 * 60 * 60 * 1000);
    } else if (dateFilter === '7d') {
      filtered = filtered.filter(g => now - new Date(g.last_seen).getTime() <= 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === '30d') {
      filtered = filtered.filter(g => now - new Date(g.last_seen).getTime() <= 30 * 24 * 60 * 60 * 1000);
    }

    // Search filter
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      filtered = filtered.filter(g => 
        g.query_normalized.toLowerCase().includes(q) || 
        g.sample_queries.some(s => s.toLowerCase().includes(q))
      );
    }
    
    return filtered;
  }, [gaps, dateFilter, searchFilter]);

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [searchFilter, pageSize]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
              <div className="h-3 w-20 bg-surface-2 rounded mb-4" />
              <div className="h-8 w-16 bg-surface-2 rounded mb-2" />
              <div className="h-3 w-24 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
        {/* Skeleton charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
              <div className="h-4 w-32 bg-surface-2 rounded mb-4" />
              <div className="h-64 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
        {/* Skeleton table */}
        <div className="bg-card border border-border rounded-2xl animate-pulse">
          <div className="p-4 border-b border-border"><div className="h-4 w-28 bg-surface-2 rounded" /></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-border/50 flex gap-8">
              <div className="h-3 w-48 bg-surface-2 rounded" />
              <div className="h-3 w-16 bg-surface-2 rounded" />
              <div className="h-3 w-24 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-foreground animate-[fadeInUp_0.3s_ease-out]">
          <WifiOff size={16} className="text-destructive flex-shrink-0" />
          <span className="flex-1">Unable to connect to backend. Showing cached data.</span>
          <button
            onClick={() => fetchStats(true)}
            className="px-3 py-1 bg-foreground text-background rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
          >
            Retry
          </button>
        </div>
      )}

      {/* Refresh toolbar */}
      <div className="flex items-center justify-end gap-3">
        {lastUpdated && (
          <span className="text-[10px] text-muted-foreground font-mono">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
        <button
          onClick={() => fetchStats(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Queries"
          value={totalQueries.toLocaleString()}
          trend={`${stats?.total_sessions ?? 0} sessions`}
          trendDirection="up"
          icon={MessageSquare}
        />
        <KPICard
          label="Satisfaction Rate"
          value={`${resolutionRate}%`}
          trend={`${thumbsUp} positive votes`}
          trendDirection="up"
          icon={CheckCircle}
        />
        <KPICard
          label="Thumbs Up"
          value={thumbsUp.toString()}
          trend="from user feedback"
          trendDirection="up"
          icon={Zap}
        />
        <KPICard
          label="Thumbs Down"
          value={thumbsDown.toString()}
          trend="flagged for review"
          trendDirection={thumbsDown > 0 ? 'down' : 'up'}
          icon={AlertTriangle}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Query Trends */}
        <div className="card-elevated bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Query Volume</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Based on recent queries</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-foreground/5 border border-foreground/10 rounded-lg">
              <Activity size={10} className="text-foreground animate-pulse" />
              <span className="text-[10px] text-foreground font-bold uppercase tracking-wider">Live</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="queryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="queries"
                  name="Queries"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2.5}
                  fill="url(#queryGrad)"
                  dot={false}
                  activeDot={{ r: 6, fill: 'hsl(var(--foreground))', stroke: 'hsl(var(--background))', strokeWidth: 2, className: 'drop-shadow-lg' }}
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  fill="url(#resolvedGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--muted-foreground))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-foreground rounded-full" />
              <span className="text-[10px] text-muted-foreground font-medium">Total Queries</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-muted-foreground rounded-full" />
              <span className="text-[10px] text-muted-foreground font-medium">Resolved</span>
            </div>
          </div>
        </div>

        {/* Sentiment */}
        <div className="card-elevated bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">User Satisfaction</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Based on {totalFeedback} feedback votes</p>
            </div>
            <div className="flex items-center gap-1 text-foreground">
              <TrendingUp size={14} />
              <span className="text-[10px] font-bold">{resolutionRate}%</span>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center relative">
            {sentimentData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={4}
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} className="drop-shadow-sm" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-foreground">{sentimentData[0]?.value ?? 0}%</span>
                  <span className="text-[10px] text-muted-foreground">Positive</span>
                </div>
              </>
            ) : (
              <div className="text-center">
                <CheckCircle size={32} className="mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">No feedback yet</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Feedback will appear here as users vote</p>
              </div>
            )}
          </div>
          {sentimentData.length > 0 && (
            <div className="flex items-center justify-center gap-5 mt-2">
              {sentimentData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full ring-2 ring-background" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-foreground font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{item.value}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Intent Distribution */}
      {intentData.length > 0 && (
        <div className="card-elevated bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Intent Distribution</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Classification breakdown</p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={intentData} margin={{ top: 0, right: 0, bottom: 0, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="count"
                  name="Queries"
                  radius={[6, 6, 0, 0]}
                >
                  {intentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Queries / Knowledge Gaps — Tab Toggle */}
      <div className="card-elevated bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          {/* Tab buttons */}
          <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('queries')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'queries'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Recent Queries ({filteredQueries.length})
            </button>
            <button
              onClick={() => setActiveTab('gaps')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all relative ${
                activeTab === 'gaps'
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Knowledge Gaps ({stats?.open_gaps ?? 0})
              {(stats?.escalated_gaps ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-card animate-pulse" />
              )}
            </button>
          </div>
          {/* Filters & Search */}
          <div className="flex items-center gap-2">
            {activeTab === 'queries' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="all">All Queries</option>
                <option value="answered">Answered</option>
                <option value="unanswered">Unanswered</option>
              </select>
            )}
            
            {activeTab === 'gaps' && (
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="all">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            )}

            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search queries..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-8 py-1.5 text-xs bg-surface-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 w-48 transition-all"
                />
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          {/* Refresh for gaps tab */}
          {activeTab === 'gaps' && (
            <button
              onClick={fetchGaps}
              disabled={gapsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw size={12} className={gapsLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
        </div>

        {activeTab === 'queries' && (<>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-[50%]">Query</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Intent</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Sources</th>
                <th
                  className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => setSortAsc((v) => !v)}
                >
                  <span className="inline-flex items-center gap-1">
                    Time
                    <ArrowUpDown size={10} className={sortAsc ? 'rotate-180' : ''} />
                  </span>
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {paginatedQueries.map((query) => {
                const isExpanded = expandedRow === query.id;
                return (
                  <tr key={query.id} className="border-b border-border/50 group">
                    {/* Row */}
                    <td className="px-4 py-3 text-foreground">
                      <div
                        className={`${isExpanded ? '' : 'line-clamp-1'} break-words max-w-[400px]`}
                        title={query.text}
                      >
                        {query.text}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {query.intent && (
                        <span className="px-2 py-0.5 bg-surface-2 text-foreground rounded-md text-[10px] font-bold uppercase whitespace-nowrap">
                          {query.intent}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="text-[10px]">{query.sources?.length ?? 0} docs</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(query.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : query.id)}
                        className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        title={isExpanded ? 'Collapse' : 'Expand details'}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {sortedQueries.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {Math.min((safePage - 1) * pageSize + 1, sortedQueries.length)}–{Math.min(safePage * pageSize, sortedQueries.length)} of {sortedQueries.length}
              </span>
              <span className="mx-0.5">·</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-surface-2 border border-border rounded-md px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {[5, 10, 20, 50].map((s) => (
                  <option key={s} value={s}>{s} / page</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-foreground"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) page = i + 1;
                else if (safePage <= 3) page = i + 1;
                else if (safePage >= totalPages - 2) page = totalPages - 4 + i;
                else page = safePage - 2 + i;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                      page === safePage
                        ? 'bg-foreground text-background'
                        : 'hover:bg-accent text-muted-foreground'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-foreground"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
        </>)}

        {/* Empty state — queries */}
        {activeTab === 'queries' && sortedQueries.length === 0 && (
          <div className="p-12 text-center">
            <MessageSquare size={40} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">
              {searchFilter ? 'No matching queries' : 'No queries yet'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {searchFilter ? 'Try a different search term' : 'Start chatting in Front Desk to see data here'}
            </p>
          </div>
        )}

        {/* ─── Knowledge Gaps Tab Content ─── */}
        {activeTab === 'gaps' && (
          <>
            {gapsLoading ? (
              <div className="p-8 text-center">
                <RefreshCw size={20} className="mx-auto text-muted-foreground animate-spin mb-2" />
                <p className="text-xs text-muted-foreground">Loading knowledge gaps...</p>
              </div>
            ) : filteredGaps.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No knowledge gaps</p>
                <p className="text-xs text-muted-foreground/70 mt-1">All queries are being answered successfully</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/50">
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-[40%]">Query</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Times Asked</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Sessions</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Last Seen</th>
                      <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGaps.map((gap: KnowledgeGap) => (
                      <tr
                        key={gap.id}
                        className={`border-b border-border/50 hover:bg-accent/50 transition-colors ${
                          gap.hit_count >= 3 ? 'border-l-2 border-l-orange-500' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="text-foreground font-medium truncate max-w-[300px]" title={gap.query_normalized}>
                            {gap.query_normalized}
                          </p>
                          {gap.sample_queries.length > 1 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[300px]" title={gap.sample_queries.join(' | ')}>
                              Also: {gap.sample_queries.slice(1, 3).join(', ')}
                              {gap.sample_queries.length > 3 && ` +${gap.sample_queries.length - 3} more`}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                            gap.hit_count >= 3 ? 'text-orange-500' : 'text-foreground'
                          }`}>
                            {gap.hit_count}
                            {gap.hit_count >= 3 && <AlertTriangle size={10} />}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {gap.session_ids.length}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                            gap.status === 'open'
                              ? 'bg-foreground/5 text-foreground border border-foreground/10'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}>
                            {gap.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(gap.last_seen).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            {gap.status === 'open' && (
                              <button
                                onClick={async () => {
                                  try {
                                    await updateKnowledgeGap(gap.id, 'acknowledged');
                                    setGaps((prev) => prev.map((g) => g.id === gap.id ? { ...g, status: 'acknowledged' } : g));
                                  } catch { /* ignore */ }
                                }}
                                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                title="Acknowledge"
                              >
                                <Check size={14} />
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                try {
                                  await updateKnowledgeGap(gap.id, 'dismissed');
                                  setGaps((prev) => prev.filter((g) => g.id !== gap.id));
                                } catch { /* ignore */ }
                              }}
                              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-red-500 transition-colors"
                              title="Dismiss"
                            >
                              <XCircle size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Insights */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield size={14} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">System Insights</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            `${totalQueries} total queries processed by the RAG pipeline.`,
            `${stats?.total_sessions ?? 0} unique conversation sessions created.`,
            `${thumbsUp + thumbsDown} total feedback votes received.`,
            `${Object.keys(stats?.intents ?? {}).length} unique intent categories detected.`,
            resolutionRate > 80 ? 'High satisfaction rate — knowledge base is effective.' : 'Consider expanding knowledge base for better coverage.',
          ].map((insight, i) => (
            <div
              key={i}
              className="card-elevated bg-card border border-border p-4 flex items-start gap-3 hover:border-primary/30 transition-colors cursor-default rounded-xl"
              style={{
                animation: `fadeInUp 0.3s ease-out forwards`,
                animationDelay: `${i * 100}ms`,
              }}
            >
              <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">
                <Shield size={12} className="text-primary" />
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Query Detail Modal */}
      {selectedQuery && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedQuery(null)}
          style={{ animation: 'fadeIn 0.15s ease-out forwards' }}
        >
          <div
            className="bg-card border border-border shadow-2xl w-full max-w-lg mx-4 p-6 rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: 'modalIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-foreground">Query Details</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedQuery.id?.slice(0, 8)}</p>
              </div>
              <button
                onClick={() => setSelectedQuery(null)}
                className="p-1.5 hover:bg-accent rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="border-b border-border/50 pb-3">
                <span className="text-muted-foreground text-xs">Query</span>
                <p className="font-medium text-foreground mt-1">{selectedQuery.text}</p>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-3">
                <span className="text-muted-foreground">Intent</span>
                <span className="font-medium text-foreground">{selectedQuery.intent || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-3">
                <span className="text-muted-foreground">Sources</span>
                <span className="font-medium text-foreground">{selectedQuery.sources?.join(', ') || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span className="font-mono text-foreground">{new Date(selectedQuery.created_at).toLocaleString()}</span>
              </div>
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
