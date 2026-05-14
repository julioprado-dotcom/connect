/**
 * git-utils.ts — Push generated products (PDFs) to GitHub
 *
 * After a product is generated, this utility commits and pushes
 * the PDF files from download/productos/ to GitHub.
 * This is what marks a product as "generado" (vs "en_elaboracion").
 *
 * Products are stored in: download/productos/<semana>/<tipo>.pdf
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PRODUCTOS_DIR = 'download/productos/';

export async function pushProductosToGithub(message: string): Promise<{ ok: boolean; commit?: string; error?: string }> {
  try {
    // 1. Stage all files in the productos directory
    await execAsync(`git add ${PRODUCTOS_DIR}`, { cwd: '/home/z/my-project' });

    // 2. Check if there are changes to commit
    const { stdout: status } = await execAsync('git diff --cached --stat', { cwd: '/home/z/my-project' });
    if (!status.trim()) {
      // No changes (PDFs unchanged or already committed)
      return { ok: true, commit: 'no-changes' };
    }

    // 3. Commit
    const { stdout: commitOut } = await execAsync(
      `git commit -m "${message.replace(/"/g, '\\"')}"`,
      { cwd: '/home/z/my-project' },
    );
    const commitHash = commitOut.trim().slice(0, 7);

    // 4. Push
    await execAsync('git push origin main', { cwd: '/home/z/my-project', timeout: 60_000 });

    return { ok: true, commit: commitHash };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[git-utils] pushProductosToGithub failed:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Get the current week number for organizing productos.
 */
export function getCurrentWeekDir(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 604800000;
  const weekNumber = Math.ceil((diff / oneWeek) + start.getDay() / 7);
  return `semana-${weekNumber}`;
}
