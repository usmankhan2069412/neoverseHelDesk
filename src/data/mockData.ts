import type { Message, QueryRow, Document, ChartPoint, SentimentData } from '@/types';

export const mockAIResponses = [
  "Acknowledged. Processing your query regarding network latency. I\'ll analyze the system logs and provide a resolution path.",
  "Resolution found: Please refer to Protocol 9-B. Re-routing traffic through the secondary gateway should resolve the packet loss issue.",
  "Ticket #4021 updated. Status set to \'Monitoring\'. I\'ll continue to observe the system metrics for the next 30 minutes.",
  "I\'ve identified the root cause — a misconfigured DNS entry on the primary resolver. The fix has been applied automatically.",
  "Your request has been prioritized. I\'ve escalated this to the infrastructure team with all relevant diagnostic data attached.",
  "Based on similar historical cases, I recommend clearing the application cache and restarting the worker nodes. Shall I proceed?",
  "Query resolved: The API rate limit was exceeded. I\'ve temporarily increased your quota and logged the adjustment.",
  "I\'m here to help! Let me scan the knowledge base for the most relevant documentation on this topic.",
];

export const initialMessages: Message[] = [
  {
    id: '1',
    sender: 'ai',
    text: "Welcome to Neoverse AI Desk. I\'m here to help you resolve any system issues. Describe your problem and I\'ll find the best solution.",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
];

export const queryData: QueryRow[] = [
  { id: '#Q-4821', type: 'Network', status: 'resolved', agent: 'Neo-AI', time: '2m ago', user: 'user_284' },
  { id: '#Q-4822', type: 'Authentication', status: 'in_progress', agent: 'Neo-AI', time: '5m ago', user: 'user_921' },
  { id: '#Q-4823', type: 'Database', status: 'escalated', agent: 'Sarah K.', time: '8m ago', user: 'user_105' },
  { id: '#Q-4824', type: 'API', status: 'resolved', agent: 'Neo-AI', time: '12m ago', user: 'user_773' },
  { id: '#Q-4825', type: 'Infrastructure', status: 'pending', agent: 'Unassigned', time: '15m ago', user: 'user_332' },
  { id: '#Q-4826', type: 'Security', status: 'in_progress', agent: 'Mike R.', time: '18m ago', user: 'user_556' },
  { id: '#Q-4827', type: 'Frontend', status: 'resolved', agent: 'Neo-AI', time: '22m ago', user: 'user_881' },
  { id: '#Q-4828', type: 'Deployment', status: 'resolved', agent: 'Neo-AI', time: '28m ago', user: 'user_199' },
  { id: '#Q-4829', type: 'Monitoring', status: 'escalated', agent: 'Jen T.', time: '34m ago', user: 'user_447' },
  { id: '#Q-4830', type: 'Network', status: 'resolved', agent: 'Neo-AI', time: '41m ago', user: 'user_662' },
  { id: '#Q-4831', type: 'Storage', status: 'in_progress', agent: 'Neo-AI', time: '45m ago', user: 'user_338' },
  { id: '#Q-4832', type: 'Authentication', status: 'resolved', agent: 'Neo-AI', time: '52m ago', user: 'user_771' },
];

export const documents: Document[] = [
  { id: '1', title: 'Neo-GPT Training Corpus v2.1', author: 'Dr. Aris', dateAdded: '2026-04-20', status: 'indexed', lastUsed: '2h ago', category: 'AI Models', tags: ['training', 'nlp', 'core'] },
  { id: '2', title: 'Network Troubleshooting Guide', author: 'SysAdmin', dateAdded: '2026-04-24', status: 'processing', lastUsed: 'Never', category: 'Infrastructure', tags: ['network', 'debugging'] },
  { id: '3', title: 'Password Reset Policy', author: 'Security', dateAdded: '2026-04-10', status: 'indexed', lastUsed: '15m ago', category: 'Security', tags: ['auth', 'policy'] },
  { id: '4', title: 'API Rate Limiting Spec', author: 'DevOps', dateAdded: '2026-04-18', status: 'indexed', lastUsed: '1h ago', category: 'API', tags: ['rate-limits', 'docs'] },
  { id: '5', title: 'Database Migration Runbook', author: 'Data Team', dateAdded: '2026-04-15', status: 'indexed', lastUsed: '3d ago', category: 'Database', tags: ['migration', 'runbook'] },
  { id: '6', title: 'Incident Response Playbook', author: 'SRE Team', dateAdded: '2026-04-22', status: 'indexed', lastUsed: '5h ago', category: 'Operations', tags: ['incident', 'response'] },
  { id: '7', title: 'Kubernetes Cluster Config', author: 'Platform', dateAdded: '2026-04-23', status: 'failed', lastUsed: 'Never', category: 'Infrastructure', tags: ['k8s', 'config'] },
  { id: '8', title: 'User Onboarding Flow', author: 'Product', dateAdded: '2026-04-12', status: 'indexed', lastUsed: '1d ago', category: 'Product', tags: ['onboarding', 'ux'] },
];

export const chartData: ChartPoint[] = [
  { time: '00:00', queries: 45, resolved: 42 },
  { time: '02:00', queries: 32, resolved: 30 },
  { time: '04:00', queries: 28, resolved: 26 },
  { time: '06:00', queries: 55, resolved: 50 },
  { time: '08:00', queries: 128, resolved: 118 },
  { time: '10:00', queries: 198, resolved: 182 },
  { time: '12:00', queries: 245, resolved: 228 },
  { time: '14:00', queries: 210, resolved: 195 },
  { time: '16:00', queries: 178, resolved: 165 },
  { time: '18:00', queries: 142, resolved: 135 },
  { time: '20:00', queries: 98, resolved: 92 },
  { time: '22:00', queries: 68, resolved: 64 },
];

export const sentimentData: SentimentData[] = [
  { name: 'Positive', value: 68, color: '#4f46e5' },
  { name: 'Neutral', value: 22, color: '#94a3b8' },
  { name: 'Negative', value: 10, color: '#facc15' },
];

export const insights = [
  'High volume on \'Login Issues\' detected in the last hour.',
  'Vector store optimization complete. 14ms faster retrieval.',
  'New escalation pattern identified: Check hardware diagnostics.',
  'Password reset requests increased by 45% since 9 AM.',
  'AI resolution rate peaked at 96.2% during afternoon shift.',
];

export const categories = ['All', 'AI Models', 'Infrastructure', 'Security', 'API', 'Database', 'Operations', 'Product'];
