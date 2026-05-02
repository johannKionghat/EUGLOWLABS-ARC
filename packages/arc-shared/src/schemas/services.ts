import { z } from "zod";

/**
 * Service-level fine-tuning. Only Ollama is configurable today: the list
 * of models to pre-pull at deploy time.
 *
 * See spec-infra §5.5 and §8 (Modèles LLM).
 *
 * Boundary type: keys mirror the YAML config 1:1 (snake_case).
 */
export const servicesSchema = z.object({
  ollama: z
    .object({
      models: z.array(z.string().min(1)).default([]),
    })
    .default({ models: [] }),
});

export type ServicesConfig = z.infer<typeof servicesSchema>;
