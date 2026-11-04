import { z } from 'zod';

export const confirmationToken = z.string().min(20).optional();
export const idempotencyKey = z.string().min(8).max(200);

export const writeMetaInput = {
  confirmation_token: confirmationToken,
  idempotency_key: idempotencyKey,
};

export const writeMetaSchema = {
  confirmation_token: { type: 'string', minLength: 20 },
  idempotency_key: { type: 'string', minLength: 8, maxLength: 200 },
};

export const WRITE_META = new Set(Object.keys(writeMetaInput));
