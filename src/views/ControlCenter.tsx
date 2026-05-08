import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid,
} from 'recharts';
import {
  MessageSquare, CheckCircle, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Search, ChevronRight,
  TrendingUp, Activity, Zap, Shield, X,
} from 'lucide-react';
import { queryData as initialQueries, chartData, sentimentData, insights } from '@/data/mockData';
import type { QueryRow } from '@/types';
import StatusBadge from '@/components/StatusBadge';

function KPICard({
  label, value, trend, trendDirection, icon: Icon, gradientFrom, gradientTo,
}: {
  label: string; value: string; trend: string; trendDirection: 'up' | 'down';
  icon: React.ElementType; gradientFrom: string; gradientTo: string;
}) {
  return (
    <div className="card-elevated bg-card border border-border rounded-2xl p-5 relative overflow-hidden">
      {/* Background gradient accent */}
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-10 rounded-bl-full`} />
      
      <div className="flex items-start justify-between mb-4 relative">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <div className={`p-2 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white shadow-lg`}>
          <Icon size={15} />
        </div>
      </div>
      <div className="text-3xl font-black text-foreground tracking-tight relative">
        {value}
      </div>
      <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${
        trendDirection === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
      }`}>
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

export default function ControlCenter() {
  const [queries, setQueries] = useState<QueryRow[]>(initialQueries);
  const [totalQueries, setTotalQueries] = useState(1248);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedQuery, setSelectedQuery] = useState<QueryRow | null>(null);

  // Simulate live data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTotalQueries((prev) => prev + Math.floor(Math.random() * 3) + 1);

      setQueries((prev) => {
        const idx = Math.floor(Math.random() * prev.length);
        const statuses: QueryRow['status'][] = ['resolved', 'in_progress', 'escalated', 'pending'];
        const next = [...prev];
        next[idx] = { ...next[idx], status: statuses[Math.floor(Math.random() * statuses.length)] };
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const filteredQueries = queries.filter((q) => {
    const matchesSearch = q.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      q.type.toLowerCase().includes(searchFilter.toLowerCase()) ||
      q.user.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const resolvedCount = queries.filter((q) => q.status === 'resolved').length;
  const escalatedCount = queries.filter((q) => q.status === 'escalated').length;
  const resolutionRate = ((resolvedCount / queries.length) * 100).toFixed(1);

  const handleRowClick = useCallback((query: QueryRow) => {
    setSelectedQuery(query);
  }, []);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Queries Today"
          value={totalQueries.toLocaleString()}
          trend="+12% vs yesterday"
          trendDirection="up"
          icon={MessageSquare}
          gradientFrom="from-indigo-500"
          gradientTo="to-purple-600"
        />
        <KPICard
          label="Resolved Rate"
          value={`${resolutionRate}%`}
          trend="+3.5% this week"
          trendDirection="up"
          icon={CheckCircle}
          gradientFrom="from-emerald-500"
          gradientTo="to-teal-600"
        />
        <KPICard
          label="Avg Response Time"
          value="340ms"
          trend="-20ms improvement"
          trendDirection="up"
          icon={Zap}
          gradientFrom="from-sky-500"
          gradientTo="to-blue-600"
        />
        <KPICard
          label="Active Escalations"
          value={escalatedCount.toString()}
          trend="-2 vs last hour"
          trendDirection="up"
          icon={AlertTriangle}
          gradientFrom="from-orange-500"
          gradientTo="to-red-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Query Trends */}
        <div className="card-elevated bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Query Volume Trends</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">24-hour overview</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <Activity size={10} className="text-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Live</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="queryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#queryGrad)"
                  dot={false}
                  activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2, className: 'drop-shadow-lg' }}
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#resolvedGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-indigo-500 rounded-full" />
              <span className="text-[10px] text-muted-foreground font-medium">Total Queries</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-emerald-500 rounded-full" />
              <span className="text-[10px] text-muted-foreground font-medium">Resolved</span>
            </div>
          </div>
        </div>

        {/* Sentiment */}
        <div className="card-elevated bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">User Satisfaction</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Based on feedback analysis</p>
            </div>
            <div className="flex items-center gap-1 text-emerald-500">
              <TrendingUp size={14} />
              <span className="text-[10px] font-bold">+5.2%</span>
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
              <span className="text-2xl font-black text-foreground">68%</span>
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

      {/* Query Type Distribution */}
      <div className="card-elevated bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Query Type Distribution</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Breakdown by category</p>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
              { type: 'Network', count: 248, fill: '#6366f1' },
              { type: 'Auth', count: 186, fill: '#8b5cf6' },
              { type: 'Database', count: 142, fill: '#a78bfa' },
              { type: 'API', count: 198, fill: '#06b6d4' },
              { type: 'Infra', count: 124, fill: '#10b981' },
              { type: 'Security', count: 86, fill: '#f59e0b' },
              { type: 'Frontend', count: 64, fill: '#ec4899' },
              { type: 'Deploy', count: 52, fill: '#f43f5e' },
            ]} margin={{ top: 0, right: 0, bottom: 0, left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
              <XAxis dataKey="type" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="count"
                name="Queries"
                radius={[6, 6, 0, 0]}
                fill="#6366f1"
              >
                  {[
                    { type: 'Network', count: 248, fill: '#6366f1' },
                    { type: 'Auth', count: 186, fill: '#8b5cf6' },
                    { type: 'Database', count: 142, fill: '#a78bfa' },
                    { type: 'API', count: 198, fill: '#06b6d4' },
                    { type: 'Infra', count: 124, fill: '#10b981' },
                  { type: 'Security', count: 86, fill: '#f59e0b' },
                  { type: 'Frontend', count: 64, fill: '#ec4899' },
                  { type: 'Deploy', count: 52, fill: '#f43f5e' },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Query Table */}
      <div className="card-elevated bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Active Queries</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{filteredQueries.length} results found</p>
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
            >
              <option value="all">All Status</option>
              <option value="resolved">Resolved</option>
              <option value="in_progress">In Progress</option>
              <option value="escalated">Escalated</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Query ID</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Agent</th>
                <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Time</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredQueries.map((query) => (
                <tr
                  key={query.id}
                  onClick={() => handleRowClick(query)}
                  className="border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-medium text-foreground">{query.id}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-surface-2 text-foreground rounded-md text-[10px] font-bold uppercase">
                      {query.type}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={query.status} /></td>
                  <td className="px-4 py-3 text-foreground/80">{query.user}</td>
                  <td className="px-4 py-3 text-foreground/80">{query.agent}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">{query.time}</td>
                  <td className="px-4 py-3">
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights Stream */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield size={14} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">System Insights</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.map((insight, i) => (
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
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedQuery.id}</p>
              </div>
              <button
                onClick={() => setSelectedQuery(null)}
                className="p-1.5 hover:bg-accent rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border/50 pb-3">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium text-foreground">{selectedQuery.type}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-3">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={selectedQuery.status} />
              </div>
              <div className="flex justify-between border-b border-border/50 pb-3">
                <span className="text-muted-foreground">User</span>
                <span className="font-medium text-foreground">{selectedQuery.user}</span>
              </div>
              <div className="flex justify-between border-b border-border/50 pb-3">
                <span className="text-muted-foreground">Assigned Agent</span>
                <span className="font-medium text-foreground">{selectedQuery.agent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span className="font-mono text-foreground">{selectedQuery.time}</span>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-border flex gap-2">
              <button className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all">
                Mark Resolved
              </button>
              <button className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all">
                Assign Agent
              </button>
              <button className="px-4 py-2 bg-surface-2 text-foreground text-xs font-bold rounded-xl hover:bg-accent transition-colors">
                View Thread
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
