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
 * Uses local git commands for branch/commit, only API for PR creation.
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

  // Configure git user (GitHub Actions bot)
  await git(['config', 'user.name', 'github-actions[bot]'], workspacePath);
  await git(
    [
      'config',
      'user.email',
      '41898282+github-actions[bot]@users.noreply.github.com'
    ],
    workspacePath
  );

  // Create and checkout new branch
  await git(['checkout', '-b', branchName], workspacePath);

  // Write changed files to disk
  for (const change of changes) {
    const filePath = join(workspacePath, change.path);
    await fs.writeFile(filePath, change.newContent, 'utf8');
    core.info(`Updated: ${change.path}`);
  }

  // Stage and commit
  await git(['add', '-A'], workspacePath);
  await git(
    ['commit', '-m', 'chore: apply e18e modernization improvements'],
    workspacePath
  );

  // Push to remote
  await git(['push', 'origin', branchName], workspacePath);

  // Create the pull request (only API call needed)
  const changedFiles = changes.map((c) => `- \`${c.path}\``).join('\n');
  const {data: pr} = await octokit.rest.pulls.create({
    owner,
    repo,
    title: 'chore: e18e modernization improvements',
    head: branchName,
    base: baseBranch,
    body: `## Summary

This PR contains automatic modernization and performance improvements identified by the e18e migrations action.

## Changed files

${changedFiles}

---
*This PR was automatically created by [e18e-action-migrations](https://github.com/e18e/action-migrations)*`
  });

  core.info(`Created PR #${pr.number}: ${pr.html_url}`);
  return pr.html_url;
}
