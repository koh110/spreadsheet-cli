import { z } from 'zod'

type AuthType = 'oauthCredentials' | 'apiKey' | 'serviceAccount'

export const zodAuthTypeLiterals = {
  oauthCredentials: z.literal('oauthCredentials'),
  apiKey: z.literal('apiKey'),
  serviceAccount: z.literal('serviceAccount')
} as const satisfies Record<AuthType, z.ZodLiteral<AuthType>>
