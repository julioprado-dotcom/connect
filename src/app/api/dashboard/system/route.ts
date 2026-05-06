import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readCgroupMemory(): { limit: number; usage: number } {
  try {
    const limitPath = '/sys/fs/cgroup/memory/memory.limit_in_bytes';
    const usagePath = '/sys/fs/cgroup/memory/memory.usage_in_bytes';
    const limit = parseInt(fs.readFileSync(limitPath, 'utf-8').trim(), 10);
    const usage = parseInt(fs.readFileSync(usagePath, 'utf-8').trim(), 10);
    if (limit > 0 && usage >= 0) {
      return { limit, usage };
    }
  } catch {
    // fallback
  }
  return { limit: os.totalmem(), usage: os.totalmem() - os.freemem() };
}

function getHeapLimit(): number {
  // NODE_OPTIONS=--max-old-space-size=4041 inyectado por la plataforma
  const nodeOptions = process.env.NODE_OPTIONS || '';
  const match = nodeOptions.match(/--max-old-space-size=(\d+)/);
  if (match) return parseInt(match[1], 10) * 1024 * 1024;
  // V8 default heap limit
  const v8 = require('v8');
  return v8.getHeapStatistics().heap_size_limit;
}

export async function GET() {
  try {
    const mem = process.memoryUsage();
    const cgroup = readCgroupMemory();
    const heapLimit = getHeapLimit();

    const memoryUsage = {
      rss: Math.round(mem.rss / (1024 * 1024) * 100) / 100,
      heapUsed: Math.round(mem.heapUsed / (1024 * 1024) * 100) / 100,
      heapTotal: Math.round(mem.heapTotal / (1024 * 1024) * 100) / 100,
      heapLimit: Math.round(heapLimit / (1024 * 1024) * 100) / 100,
      external: Math.round(mem.external / (1024 * 1024) * 100) / 100,
      cgroupLimit: Math.round(cgroup.limit / (1024 * 1024) * 100) / 100,
      cgroupUsage: Math.round(cgroup.usage / (1024 * 1024) * 100) / 100,
    };

    // Porcentaje contra el límite V8 heap (lo que causa OOM al proceso)
    const memoryPercent = heapLimit > 0
      ? Math.round((mem.heapUsed / heapLimit) * 10000) / 100
      : 0;

    const cgroupPercent = cgroup.limit > 0
      ? Math.round((cgroup.usage / cgroup.limit) * 10000) / 100
      : 0;

    // Uptime
    const uptimeSeconds = process.uptime();
    const uptimeFormatted = formatUptime(uptimeSeconds);

    // Database file size
    let dbSize = 0;
    const dbPaths = [
      path.join(process.cwd(), 'db', 'custom.db'),
      path.join(process.cwd(), 'prisma', 'dev.db'),
      process.env.DATABASE_URL?.replace('file:', '') || '',
    ];
    for (const dbPath of dbPaths) {
      try {
        const stat = fs.statSync(dbPath);
        if (stat.isFile()) {
          dbSize = Math.round(stat.size / (1024 * 1024) * 100) / 100;
          break;
        }
      } catch {
        // File not found, try next path
      }
    }

    return NextResponse.json({
      memoryUsage,
      memoryPercent,
      cgroupPercent,
      uptime: uptimeSeconds,
      uptimeFormatted,
      dbSize,
      nodeVersion: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to collect system metrics' },
      { status: 500 }
    );
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(' ');
}
