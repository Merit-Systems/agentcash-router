import type { ZodType } from 'zod';

export function validateExamples(
  key: string,
  bodySchema: ZodType | undefined,
  querySchema: ZodType | undefined,
  outputSchema: ZodType | undefined,
  inputExample: unknown,
  hasInputExample: boolean,
  outputExample: unknown,
  hasOutputExample: boolean,
): void {
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
      const issues = result.error.issues
        .map((i) => `  • ${i.path.length ? i.path.join('.') : '<root>'}: ${i.message}`)
        .join('\n');
      throw new Error(
        `route '${key}': .inputExample() does not satisfy ${bodySchema ? '.body()' : '.query()'} schema:\n${issues}`,
      );
    }
  }
  if (outputSchema && hasOutputExample) {
    const result = outputSchema.safeParse(outputExample);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  • ${i.path.length ? i.path.join('.') : '<root>'}: ${i.message}`)
        .join('\n');
      throw new Error(
        `route '${key}': .outputExample() does not satisfy .output() schema:\n${issues}`,
      );
    }
  }
}
