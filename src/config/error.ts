import type { RouterConfigIssue } from './types.js';

export class RouterConfigError extends Error {
  readonly issues: RouterConfigIssue[];

  constructor(issues: RouterConfigIssue[]) {
    super(formatRouterConfigIssues(issues));
    this.name = 'RouterConfigError';
    this.issues = issues;
  }
}

function formatRouterConfigIssues(issues: readonly RouterConfigIssue[]): string {
  return issues.map((issue) => issue.message).join('\n');
}
