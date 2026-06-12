import type { ZodError, ZodType } from 'zod';

export interface ValidateExamplesOptions {
  key: string;
  bodySchema: ZodType | undefined;
  querySchema: ZodType | undefined;
  outputSchema: ZodType | undefined;
  inputExample: unknown;
  hasInputExample: boolean;
  outputExample: unknown;
  hasOutputExample: boolean;
}

export function validateExamples(options: ValidateExamplesOptions): void {
  const {
    key,
    bodySchema,
    querySchema,
    outputSchema,
    inputExample,
    hasInputExample,
    outputExample,
    hasOutputExample,
  } = options;

  const inputSchema = bodySchema ?? querySchema;
  if (hasInputExample && !inputSchema) {
    throw new Error(`route '${key}': .inputExample() requires .body() or .query()`);
  }
  if (hasOutputExample && !outputSchema) {
    throw new Error(`route '${key}': .outputExample() requires .output()`);
  }

  if (inputSchema && hasInputExample) {
    const result = inputSchema.safeParse(inputExample);
    if (!result.success) {
      throw new Error(
        `route '${key}': .inputExample() does not satisfy ${bodySchema ? '.body()' : '.query()'} schema:\n${formatIssues(result.error)}`,
      );
    }
  }
  if (outputSchema && hasOutputExample) {
    const result = outputSchema.safeParse(outputExample);
    if (!result.success) {
      throw new Error(
        `route '${key}': .outputExample() does not satisfy .output() schema:\n${formatIssues(result.error)}`,
      );
    }
  }
}

function formatIssues(error: ZodError): string {
  return error.issues
    .map((i) => `  • ${i.path.length ? i.path.join('.') : '<root>'}: ${i.message}`)
    .join('\n');
}
