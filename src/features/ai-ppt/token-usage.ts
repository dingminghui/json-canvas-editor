import type { PptTokenUsageV1 } from "@/features/ai-ppt/schema";

function sumOptionalCounts(...values: Array<number | null | undefined>): number | undefined {
  const counts = values.filter((value): value is number => typeof value === "number");
  return counts.length > 0 ? counts.reduce((sum, value) => sum + value, 0) : undefined;
}

export function mergePptTokenUsage(
  current: PptTokenUsageV1,
  incoming: PptTokenUsageV1,
): PptTokenUsageV1 {
  const reasoningTokens = sumOptionalCounts(
    current.completion_tokens_details?.reasoning_tokens,
    incoming.completion_tokens_details?.reasoning_tokens,
  );
  const completionTextTokens = sumOptionalCounts(
    current.completion_tokens_details?.text_tokens,
    incoming.completion_tokens_details?.text_tokens,
  );
  const cachedTokens = sumOptionalCounts(
    current.prompt_tokens_details?.cached_tokens,
    incoming.prompt_tokens_details?.cached_tokens,
  );
  const promptTextTokens = sumOptionalCounts(
    current.prompt_tokens_details?.text_tokens,
    incoming.prompt_tokens_details?.text_tokens,
  );

  return {
    total_tokens: current.total_tokens + incoming.total_tokens,
    completion_tokens: current.completion_tokens + incoming.completion_tokens,
    prompt_tokens: current.prompt_tokens + incoming.prompt_tokens,
    ...(reasoningTokens !== undefined || completionTextTokens !== undefined
      ? {
          completion_tokens_details: {
            ...(reasoningTokens !== undefined ? { reasoning_tokens: reasoningTokens } : {}),
            ...(completionTextTokens !== undefined ? { text_tokens: completionTextTokens } : {}),
          },
        }
      : {}),
    ...(cachedTokens !== undefined || promptTextTokens !== undefined
      ? {
          prompt_tokens_details: {
            ...(cachedTokens !== undefined ? { cached_tokens: cachedTokens } : {}),
            ...(promptTextTokens !== undefined ? { text_tokens: promptTextTokens } : {}),
          },
        }
      : {}),
  };
}
