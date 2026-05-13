import type { RouterConfig } from '../types.js';
import { RouterConfigError } from './error.js';
import type { RouterConfigIssue, RouterConfigValidationOptions } from './types.js';
import { validateX402Config } from './validators/x402.js';
import { validateMppConfig } from './validators/mpp.js';

export function validateRouterConfig(
  config: RouterConfig,
  options: RouterConfigValidationOptions = {},
): void {
  const issues = getRouterConfigIssues(config, options);
  if (issues.length > 0) throw new RouterConfigError(issues);
}

export function getRouterConfigIssues(
  config: RouterConfig,
  options: RouterConfigValidationOptions = {},
): RouterConfigIssue[] {
  const env = options.env ?? process.env;
  const issues: RouterConfigIssue[] = [];
  const protocols = config.protocols ?? ['x402'];

  if (!config.baseUrl) {
    issues.push({
      code: 'missing_base_url',
      message:
        '[router] baseUrl is required in RouterConfig. Set it to your production domain (e.g., "https://api.example.com"). The realm is used for payment matching and must be correct.',
    });
  }

  if (config.protocols && config.protocols.length === 0) {
    issues.push({
      code: 'empty_protocols',
      message:
        "RouterConfig.protocols cannot be empty. Omit the field to use default ['x402'] or specify protocols explicitly.",
    });
  }

  if (protocols.includes('x402')) {
    issues.push(...validateX402Config(config, env, options));
  }

  if (protocols.includes('mpp')) {
    issues.push(...validateMppConfig(config, env));
  }

  return issues;
}
