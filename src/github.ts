import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {git} from './git.js';

export interface FileChange {
  path: string;
  originalContent: string;
  newContent: string;
}

/**
 * Creates a pull request with the given file changes.
 */
export async function createPullRequest(
  octokit: ReturnType<typeof github.getOctokit>,
  workspacePath: string,
  owner: string,
  repo: string,
  baseBranch: string,
  branchPrefix: string,
  changes: FileChange[]
): Promise<string> {
  const timestamp = Date.now();
  const branchName = `${branchPrefix}/${timestamp}`;

  core.info(`Creating branch: ${branchName}`);

  await git(['config', 'user.name', 'github-actions[bot]'], workspacePath);
  await git(
    [
      'config',
      'user.email',
      '41898282+github-actions[bot]@users.noreply.github.com'
    ],
    workspacePath
  );
  await git(['checkout', '-b', branchName], workspacePath);

  for (const change of changes) {
    const filePath = join(workspacePath, change.path);
    await fs.writeFile(filePath, change.newContent, 'utf8');
    core.info(`Updated: ${change.path}`);
  }

  await git(['add', '-A'], workspacePath);
  await git(
    ['commit', '-m', 'chore: apply e18e modernization improvements'],
    workspacePath
  );

  await git(['push', 'origin', branchName], workspacePath);

  const {data: pr} = await octokit.rest.pulls.create({
    owner,
    repo,
    title: 'chore: e18e modernization improvements',
    head: branchName,
    base: baseBranch,
    body: `TODO

---

*This PR was automatically created by [e18e-action-migrations](https://github.com/e18e/action-migrations)*`
  });

  core.info(`Created PR #${pr.number}: ${pr.html_url}`);
  return pr.html_url;
}
