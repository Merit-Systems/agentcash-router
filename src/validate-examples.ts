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
  if (bodySchema && !hasInputExample) {
    throw new Error(
      `route '${key}': .body() requires a matching .inputExample() — ` +
        `the bazaar discovery extension needs a conforming sample body to advertise.`,
    );
  }
  if (querySchema && !hasInputExample) {
    throw new Error(
      `route '${key}': .query() requires a matching .inputExample() — ` +
        `the bazaar discovery extension needs a conforming sample query to advertise.`,
    );
  }
  if (outputSchema && !hasOutputExample) {
    throw new Error(
      `route '${key}': .output() requires a matching .outputExample() — ` +
        `the bazaar discovery extension needs a conforming sample response to advertise.`,
    );
  }

  const inputSchema = bodySchema ?? querySchema;
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
