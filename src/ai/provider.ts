export interface ExplanationContext { file: string; startLine: number; endLine: number; code: string }
export interface ExplanationProvider { explain(context: ExplanationContext): Promise<string> }
export class MockExplanationProvider implements ExplanationProvider {
  async explain(context: ExplanationContext): Promise<string> {
    return `Mock explanation for ${context.file}, lines ${context.startLine}–${context.endLine}. This is a placeholder, not an AI analysis. Study the selected code and its imports to understand its role.`;
  }
}
