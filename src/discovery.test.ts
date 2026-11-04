import { describe, expect, it } from 'vitest';
import {
  isDiscoveryToolName,
  matchesQuery,
} from './discovery';
import { INVOKE_RESULT_MAX_CHARS, clipResult, success } from './mcpResult';

describe('discovery matching', () => {
  it('matches a plain-English request against server text', () => {
    expect(matchesQuery('Social Scavenger games', 'social scavenger games')).toBe(true);
    expect(matchesQuery('Social Scavenger games', 'player sql')).toBe(false);
    expect(matchesQuery('Social Scavenger games', '')).toBe(false);
  });

  it('treats discovery tools as reserved', () => {
    expect(isDiscoveryToolName('invoke_tool')).toBe(true);
    expect(isDiscoveryToolName('searchGames')).toBe(false);
  });
});

describe('result limits', () => {
  it('clips oversized invoke results', () => {
    const clipped = clipResult(success({ blob: 'x'.repeat(INVOKE_RESULT_MAX_CHARS) }));
    expect(clipped.structuredContent).toMatchObject({
      truncated: true,
      error: { code: 'RESULT_TRUNCATED' },
    });
  });
});
