export type StructuredResult = Record<string, unknown>;

const reportedToolError = (error: unknown): { code: string; message: string; status: number } | null => {
  if (!(error instanceof Error)) return null;
  const candidate = error as Error & { code?: unknown; status?: unknown };
  if (typeof candidate.code !== 'string' || typeof candidate.status !== 'number') return null;
  return { code: candidate.code, message: error.message, status: candidate.status };
};

export const INVOKE_RESULT_MAX_CHARS = 24_000;

export const success = (result: StructuredResult) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(result) }],
  structuredContent: result,
});

export const failure = (error: unknown) => {
  const toolError = reportedToolError(error);
  const result = {
    error: {
      code: toolError?.code || (error instanceof Error && error.name === 'ZodError'
        ? 'INVALID_TOOL_ARGUMENTS'
        : 'GATEWAY_ERROR'),
      message: toolError?.message || (error instanceof Error ? error.message : 'Unexpected gateway error'),
      ...(toolError ? { status: toolError.status } : {}),
    },
  };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    structuredContent: result,
    isError: true,
  };
};

export const clipResult = (
  result: ReturnType<typeof success>,
  maxChars = INVOKE_RESULT_MAX_CHARS,
) => {
  const text = result.content[0]?.text || '';
  if (text.length <= maxChars) {
    return result;
  }
  return success({
    truncated: true,
    error: {
      code: 'RESULT_TRUNCATED',
      message: 'The tool result was larger than the gateway limit.',
    },
    preview: text.slice(0, maxChars),
  });
};
