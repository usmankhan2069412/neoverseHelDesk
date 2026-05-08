import { CheckCircle, AlertTriangle, Clock, HelpCircle } from 'lucide-react';
import type { QueryRow } from '@/types';

interface StatusBadgeProps {
  status: QueryRow['status'];
}

const config = {
 
  resolved: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-500/20',
    icon: <CheckCircle size={10} />,
    label: 'Resolved',
  },
  in_progress: {
    bg: 'bg-sky-50 dark:bg-sky-500/10',
    text: 'text-sky-700 dark:text-sky-400',
    border: 'border-sky-200 dark:border-sky-500/20',
    icon: <Clock size={10} />,
    label: 'In Progress',
  },
  escalated: {
    bg: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-500/20',
    icon: <AlertTriangle size={10} />,
    label: 'Escalated',
  },
  pending: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-500/20',
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
