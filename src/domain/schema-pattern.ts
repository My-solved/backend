const compiledPatterns = new Map<string, RegExp>();

export function matchesSchemaPattern(value: string, pattern: string): boolean {
  let expression = compiledPatterns.get(pattern);
  if (expression === undefined) {
    expression = new RegExp(pattern, 'u');
    compiledPatterns.set(pattern, expression);
  }
  return expression.test(value);
}
