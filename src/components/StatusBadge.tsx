import { CheckCircle, AlertTriangle, Clock, HelpCircle } from 'lucide-react';
import type { QueryRow } from '@/types';

interface StatusBadgeProps {
  status: QueryRow['status'];
}

const config = {
 
  resolved: {
    bg: 'bg-foreground/10',
    text: 'text-foreground',
    border: 'border-foreground/20',
    icon: <CheckCircle size={10} />,
    label: 'Resolved',
  },
  in_progress: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
    icon: <Clock size={10} />,
    label: 'In Progress',
  },
  escalated: {
    bg: 'bg-foreground/5',
    text: 'text-foreground',
    border: 'border-foreground/20',
    icon: <AlertTriangle size={10} />,
    label: 'Escalated',
  },
  pending: {
    bg: 'bg-muted/50',
    text: 'text-muted-foreground',
    border: 'border-border/50',
    icon: <HelpCircle size={10} />,
    label: 'Pending',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const c = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${c.bg} ${c.text} ${c.border}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}
