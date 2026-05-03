'use client';

import { Card, CardContent } from '@/components/ui/card';

export function KPICard({
  icon,
  value,
  label,
  subtext,
  colorClass,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  subtext?: string;
  colorClass?: string;
}) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${colorClass || 'text-muted-foreground'}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
            <p className="text-xs text-muted-foreground truncate">{label}</p>
          </div>
        </div>
        {subtext && (
          <p className="mt-2 text-[10px] text-muted-foreground/70 truncate">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function EmptyState({ icon, text, subtext }: { icon: React.ReactNode; text: string; subtext?: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-muted-foreground">
      <div className="opacity-40">{icon}</div>
      <p className="text-sm mt-2">{text}</p>
      {subtext && <p className="text-xs mt-1 text-muted-foreground/60">{subtext}</p>}
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

export function LevelTab({
  active,
  onClick,
  label,
  nivel,
  colorClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  nivel?: string;
  colorClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-full text-xs font-medium transition-colors
        ${active
          ? colorClass || 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
        }
      `}
    >
      {label}
    </button>
  );
}

export function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded bg-background">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
