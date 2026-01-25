import * as process from 'process';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {glob} from 'tinyglobby';
import {createPullRequest} from './github.js';
import type {FileChange, ProcessResult} from './types.js';
import * as webFeatureCodemods from '@e18e/web-features-codemods';
import {codemods as moduleReplacementCodemods} from 'module-replacements-codemods';

const BRANCH_PREFIX = 'e18e-perfbot';

interface FileProcessResult {
  change: FileChange | null;
  appliedCodemods: string[];
}

async function processFile(
  filePath: string,
  content: string
): Promise<FileProcessResult> {
  let currentContent = content;
  const appliedCodemods: string[] = [];

  for (const [name, codemod] of Object.entries(webFeatureCodemods)) {
    if (codemod.test({source: currentContent})) {
      currentContent = codemod.apply({source: currentContent});
      appliedCodemods.push(name);
    }
  }

  for (const [name, createCodemod] of Object.entries(
    moduleReplacementCodemods
  )) {
    const codemod = createCodemod({});
    const before = currentContent;
    const result = await codemod.transform({
      file: {source: currentContent, filename: filePath}
    });
    currentContent = result;
    if (result !== before) {
      appliedCodemods.push(name);
    }
  }

  if (currentContent !== content) {
    return {
      change: {
        path: filePath,
        originalContent: content,
        newContent: currentContent
      },
      appliedCodemods
    };
  }

  return {change: null, appliedCodemods: []};
}

/**
 * Scans source files and collects all improvements.
 */
async function scanAndProcess(
  workspacePath: string,
  includePatterns: string[]
): Promise<ProcessResult> {
  const changes: FileChange[] = [];
  const appliedCodemodsSet = new Set<string>();

  core.info(`Scanning with patterns: ${includePatterns.join(', ')}`);

  const files = await glob(includePatterns, {
    cwd: workspacePath,
    absolute: false
  });

  core.info(`Found ${files.length} files to scan`);

  for (const file of files) {
    const absolutePath = join(workspacePath, file);
    const content = await fs.readFile(absolutePath, 'utf8');

    const result = await processFile(file, content);
    if (result.change) {
      changes.push(result.change);
      for (const codemod of result.appliedCodemods) {
        appliedCodemodsSet.add(codemod);
      }
      core.info(`Found improvements in: ${file}`);
    }
  }

  const summary =
    changes.length > 0
      ? `Found improvements in ${changes.length} file(s)`
      : 'No improvements found';

  return {changes, appliedCodemods: [...appliedCodemodsSet].sort(), summary};
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
      result
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
