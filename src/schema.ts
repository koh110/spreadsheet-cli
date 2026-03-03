import { z } from 'zod';

type AuthType = 'apiKey' | 'serviceAccount' | 'adc';

export const zodAuthTypeLiterals = {
  apiKey: z.literal('apiKey'),
  serviceAccount: z.literal('serviceAccount'),
  adc: z.literal('adc')
} as const satisfies Record<AuthType, z.ZodLiteral<AuthType>>;
