import { z } from 'zod';

export const OpenApiSchema = z
  .object({
    openapi: z.string(),
    info: z
      .object({
        title: z.string().optional(),
        version: z.string().optional(),
        description: z.string().optional()
      })
      .passthrough()
      .optional(),
    servers: z.array(z.object({ url: z.string() }).passthrough()).optional(),
    paths: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
    components: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough();

export const AgentContextSchema = z
  .object({
    version: z.string(),
    generatedAt: z.string(),
    baseUrl: z.string(),
    scope: z.string(),
    endpoints: z
      .array(
        z
          .object({
            id: z.string(),
            method: z.string(),
            path: z.string(),
            scope: z.string().optional(),
            summary: z.string().optional(),
            auth: z.string().optional(),
            source: z.string().optional(),
            tags: z.array(z.string()).optional()
          })
          .passthrough()
      )
      .default([]),
    errorCodes: z
      .array(
        z
          .object({
            code: z.string(),
            status: z.number(),
            message: z.string().optional(),
            action: z.string().optional()
          })
          .passthrough()
      )
      .default([]),
    sourceGuidance: z
      .array(
        z
          .object({
            source: z.string(),
            guidance: z.string()
          })
          .passthrough()
      )
      .default([])
  })
  .passthrough();
