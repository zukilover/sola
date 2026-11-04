import { z } from 'zod';

export const mappedStringInput = <T>(
  map: (value: string) => T | null | undefined,
  message: string,
) =>
  z.string().trim().min(1).transform((value, ctx) => {
    const mapped = map(value);
    if (mapped == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
      });
      return z.NEVER;
    }
    return mapped;
  });
