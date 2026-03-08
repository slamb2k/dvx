import { z } from 'zod'

export const AuthProfileSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['service-principal', 'delegated']),
  environmentUrl: z.string().url(),
  tenantId: z.string().uuid(),
  clientId: z.string().uuid(),
  clientSecret: z.string().optional(),
  homeAccountId: z.string().optional(),
})

export type AuthProfile = z.infer<typeof AuthProfileSchema>

export const AuthConfigSchema = z.object({
  activeProfile: z.string().optional(),
  profiles: z.record(z.string(), AuthProfileSchema),
})

export type AuthConfig = z.infer<typeof AuthConfigSchema>
