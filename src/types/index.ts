export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface QueryRow {
  id: string;
  type: string;
  status: 'resolved' | 'escalated' | 'in_progress' | 'pending';
  agent: string;
  time: string;
  user: string;
}

export interface Document {
  id: string;
  title: string;
  author: string;
  dateAdded: string;
  status: 'indexed' | 'processing' | 'failed';
  lastUsed: string;
  category: string;
  tags: string[];
}

export interface KPIData {
  label: string;
  value: string;
  trend: string;
  trendDirection: 'up' | 'down';
  icon: string;
}

export interface ChartPoint {
  time: string;
  queries: number;
  resolved: number;
}

export interface SentimentData {
  name: string;
  value: number;
  color: string;
}

export type ViewName = 'frontDesk' | 'controlCenter' | 'archive';

export interface NavItem {
  id: ViewName;
  label: string;
  icon: string;
}
