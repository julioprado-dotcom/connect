'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import { MiniKPI } from './MiniKPI';

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const },
  }),
};

export interface CategoryCardProps {
  index: number;
  icon: React.ReactNode;
  title: string;
  viewId: string;
  kpis: { value: number | string; label: string; color?: string }[];
  featured: React.ReactNode;
  variation: React.ReactNode;
  borderColor?: string;
  onClick: () => void;
}

export function CategoryCard({
  index,
  icon,
  title,
  kpis,
  featured,
  variation,
  borderColor,
  onClick,
}: CategoryCardProps) {
  return (
    <motion.div
      custom={index}
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
    >
      <Card
        className={`cursor-pointer hover:shadow-md hover:ring-1 hover:ring-primary/30 transition-all ${borderColor || ''}`}
        onClick={onClick}
      >
        {/* Header */}
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-muted-foreground">{icon}</div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-3 space-y-3">
          {/* KPIs row */}
          <div className="flex items-center justify-around py-2 rounded-lg bg-muted/40 border border-border/50">
            {kpis.map((kpi, i) => (
              <MiniKPI key={i} value={kpi.value} label={kpi.label} color={kpi.color} />
            ))}
          </div>

          {/* Featured */}
          <div className="text-xs">{featured}</div>

          {/* Variation */}
          <div className="border-t border-border/50 pt-2">{variation}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
