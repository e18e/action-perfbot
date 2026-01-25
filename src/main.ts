import * as process from 'process';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {glob} from 'tinyglobby';
import {createPullRequest, type FileChange} from './github.js';
import * as webFeatureCodemods from '@e18e/web-features-codemods';
import {codemods as moduleReplacementCodemods} from 'module-replacements-codemods';

const BRANCH_PREFIX = 'e18e-migrations';

interface ProcessResult {
  changes: FileChange[];
  summary: string;
}

async function processFile(
  filePath: string,
  content: string
): Promise<FileChange | null> {
  let currentContent = content;

  for (const codemod of Object.values(webFeatureCodemods)) {
    if (codemod.test({source: currentContent})) {
      currentContent = codemod.apply({source: currentContent});
    }
  }

  for (const createCodemod of Object.values(moduleReplacementCodemods)) {
    const codemod = createCodemod({});
    const result = await codemod.transform({
      file: {source: currentContent, filename: filePath}
    });
    currentContent = result;
  }

  if (currentContent !== content) {
    return {
      path: filePath,
      originalContent: content,
      newContent: currentContent
    };
  }

  return null;
}

/**
 * Scans source files and collects all improvements.
 */
async function scanAndProcess(
  workspacePath: string,
  includePatterns: string[]
): Promise<ProcessResult> {
  const changes: FileChange[] = [];

  core.info(`Scanning with patterns: ${includePatterns.join(', ')}`);

  const files = await glob(includePatterns, {
    cwd: workspacePath,
    absolute: false
  });

  core.info(`Found ${files.length} files to scan`);

  for (const file of files) {
    const absolutePath = join(workspacePath, file);
    const content = await fs.readFile(absolutePath, 'utf8');

    const change = await processFile(file, content);
    if (change) {
      changes.push(change);
      core.info(`Found improvements in: ${file}`);
    }
  }

  const summary =
    changes.length > 0
      ? `Found improvements in ${changes.length} file(s)`
      : 'No improvements found';

  return {changes, summary};
}

async function run(): Promise<void> {
  try {
    const baseWorkspace = process.env.GITHUB_WORKSPACE || process.cwd();
    const workDir = core.getInput('working-directory') || '.';
    const workspacePath = join(baseWorkspace, workDir);

    core.info(`Workspace path: ${workspacePath}`);

    const token = core.getInput('github-token', {required: true});
    const baseBranch = core.getInput('base-branch') || 'main';
    const branchPrefix = core.getInput('branch-prefix') || BRANCH_PREFIX;

    const includeInput =
      core.getInput('include') || 'src/**/*.{js,ts,mjs,mts,cjs,cts}';
    const includePatterns = includeInput.split(',').map((p) => p.trim());

    const {owner, repo} = github.context.repo;

    const result = await scanAndProcess(workspacePath, includePatterns);

    if (result.changes.length === 0) {
      core.info('No improvements found. Nothing to do.');
      core.setOutput('pr-url', '');
      core.setOutput('changes-found', 'false');
      return;
    }

    core.info(result.summary);

    const octokit = github.getOctokit(token);
    const prUrl = await createPullRequest(
      octokit,
      workspacePath,
      owner,
      repo,
      baseBranch,
      branchPrefix,
      result.changes
    );

    core.setOutput('pr-url', prUrl);
    core.setOutput('changes-found', 'true');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

export {processFile, scanAndProcess, run};

if (import.meta.main) {
  run();
}
