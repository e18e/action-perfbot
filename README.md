# e18e/action-perfbot

> [!WARNING]
> This repository is very early stages and is unpublished. Keep an eye out on the [e18e.dev](https://e18e.dev) website for updates.

> A GitHub action for automatically opening modernization and performance PRs

## What it does

This action analyzes the repository for potential modernization and performance improvements on a schedule, then creates pull requests if there are any recommended changes.

Think of this as dependabot but for modernization and performance improvements.

## Usage

```yaml
name: perfbot

on:
  schedule:
    # Run weekly on Monday at 9am UTC
    - cron: '0 9 * * 1'

permissions:
  contents: write
  pull-requests: write

jobs:
  perfbot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: e18e/action-perfbot@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Name                   | Description                                                                    | Required | Default                                   |
|------------------------|--------------------------------------------------------------------------------|----------|-------------------------------------------|
| `github-token`         | The GitHub token for authentication                                            | Yes      | `${{ github.token }}`                     |
| `working-directory`    | Working directory relative to repository root                                  | No       | `.`                                       |
| `include`              | Glob patterns for source files to scan (comma-separated)                       | No       | `src/**/*.{js,ts,mjs,mts,cjs,cts}`        |
| `base-branch`          | The base branch to create PRs against                                          | No       | `main`                                    |
| `branch-prefix`        | Prefix for the PR branch name                                                  | No       | `e18e-perfbot`                            |

## Example Workflows

See the [`recipes/`](./recipes/) directory for complete workflow examples:

- [`basic.yml`](./recipes/basic.yml) - Basic scheduled perfbot

## Permissions

The action requires the following permissions:

```yaml
permissions:
  contents: write      # To create branches and push changes
  pull-requests: write # To create pull requests
```

## Sponsors

<p align="center">
  <a href="https://e18e.dev/sponsors.svg">
    <img src="https://e18e.dev/sponsors.svg" alt="e18e community sponsors" />
  </a>
</p>

## License

MIT
