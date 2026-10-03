import simpleGit, { SimpleGit } from 'simple-git';

export class GitDiffParser {
  private git: SimpleGit;

  constructor(baseDir: string) {
    this.git = simpleGit(baseDir);
  }

  async getChangedFiles(base: string, head: string): Promise<string[]> {
    try {
      const diff = await this.git.diff(['--name-only', `${base}...${head}`]);
      return diff.split('\n').filter(Boolean);
    } catch (error) {
      console.error('Failed to get git diff:', error);
      return [];
    }
  }

  async getWorkingTreeChanges(): Promise<string[]> {
    try {
      const status = await this.git.status();
      const changed = [
        ...status.modified,
        ...status.created,
        ...status.renamed.map(r => r.to),
        ...status.staged,
      ];
      return [...new Set(changed)];
    } catch (error) {
      console.error('Failed to get working tree changes:', error);
      return [];
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return branch.trim();
    } catch (error) {
      console.error('Failed to get current branch:', error);
      return 'HEAD';
    }
  }

  async getCommitHash(ref: string): Promise<string> {
    try {
      const hash = await this.git.revparse([ref]);
      return hash.trim();
    } catch (error) {
      console.error(`Failed to get commit hash for ${ref}:`, error);
      return ref;
    }
  }
}
