import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid,
} from 'recharts';
import {
  MessageSquare, CheckCircle, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Search,
  TrendingUp, Activity, Zap, Shield, X, Loader2,
} from 'lucide-react';
import { getStats, type DashboardStats } from '@/services/api';


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
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedQuery, setSelectedQuery] = useState<any | null>(null);

  // Fetch stats on mount and refresh every 30s
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      const data = await getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  }

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
    : [
        { name: 'Positive', value: 70, color: 'hsl(var(--foreground))' },
        { name: 'Neutral', value: 20, color: 'hsl(var(--muted-foreground))' },
        { name: 'Negative', value: 10, color: 'hsl(var(--border))' },
      ];

  // Build intent distribution
  const intentData = stats?.intents
    ? Object.entries(stats.intents).map(([type, count], i) => {
        const opacities = [1, 0.8, 0.6, 0.4, 0.2, 0.1];
        return { type, count, fill: `hsl(var(--foreground) / ${opacities[i % opacities.length]})` };
      })
    : [];

  // Recent queries for the table
  const recentQueries = stats?.recent_queries ?? [];
  const filteredQueries = recentQueries.filter((q) =>
    q.text?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    q.intent?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <div className="h-64 flex items-center justify-center">
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
            {/* Center label */}
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-foreground">{sentimentData[0]?.value ?? 0}%</span>
              <span className="text-[10px] text-muted-foreground">Positive</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-5 mt-2">
            {sentimentData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full ring-2 ring-background" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-foreground font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{item.value}%</span>
              </div>
            ))}
          </div>
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

      {/* Recent Queries Table */}
      <div className="card-elevated bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Recent Queries</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{filteredQueries.length} results</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search queries..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 w-48 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Query</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Intent</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueries.map((query) => (
                <tr
                  key={query.id}
                  className="border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedQuery(query)}
                >
                  <td className="px-4 py-3 text-foreground max-w-[300px] truncate">{query.text}</td>
                  <td className="px-4 py-3">
                    {query.intent && (
                      <span className="px-2 py-0.5 bg-surface-2 text-foreground rounded-md text-[10px] font-bold uppercase">
                        {query.intent}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">
                    {new Date(query.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredQueries.length === 0 && (
          <div className="p-12 text-center">
            <MessageSquare size={40} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No queries yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Start chatting in Front Desk to see data here</p>
          </div>
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
