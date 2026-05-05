import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Memory usage from Node.js process
    const mem = process.memoryUsage();
    const memoryUsage = {
      rss: Math.round(mem.rss / (1024 * 1024) * 100) / 100,
      heapUsed: Math.round(mem.heapUsed / (1024 * 1024) * 100) / 100,
      heapTotal: Math.round(mem.heapTotal / (1024 * 1024) * 100) / 100,
      external: Math.round(mem.external / (1024 * 1024) * 100) / 100,
    };

    const memoryPercent = mem.heapTotal > 0
      ? Math.round((mem.heapUsed / mem.heapTotal) * 10000) / 100
      : 0;

    // Uptime
    const uptimeSeconds = process.uptime();
    const uptimeFormatted = formatUptime(uptimeSeconds);

    // Database file size
    let dbSize = 0;
    const dbPaths = [
      path.join(process.cwd(), 'db', 'custom.db'),
      path.join(process.cwd(), 'prisma', 'dev.db'),
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
