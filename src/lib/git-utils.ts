/**
 * git-utils.ts — Push DB to GitHub as part of the generation flow
 *
 * After a product is generated and saved to the DB, this utility
 * commits and pushes prisma/db/custom.db to GitHub.
 * This is what marks a product as "generado" (vs "en_elaboracion").
 */
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const DB_PATH = 'prisma/db/custom.db';

export async function pushDbToGithub(message: string): Promise<{ ok: boolean; commit?: string; error?: string }> {
  try {
    // 1. Stage the DB file
    await execAsync(`git add ${DB_PATH}`, { cwd: '/home/z/my-project' });

    // 2. Check if there are changes to commit
    const { stdout: status } = await execAsync('git diff --cached --stat', { cwd: '/home/z/my-project' });
    if (!status.trim()) {
      // No changes to commit (DB unchanged or already committed)
      return { ok: true, commit: 'no-changes' };
    }

    // 3. Commit
    const { stdout: commitOut } = await execAsync(
      `git commit -m "${message.replace(/"/g, '\\"')}"`,
      { cwd: '/home/z/my-project' },
    );
    const commitHash = commitOut.trim().slice(0, 7);

    // 4. Push
    await execAsync('git push origin main', { cwd: '/home/z/my-project', timeout: 30_000 });

    return { ok: true, commit: commitHash };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[git-utils] pushDbToGithub failed:', msg);
    return { ok: false, error: msg };
  }
}
