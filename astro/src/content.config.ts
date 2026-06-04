import { z, defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    tag: z.string(),
    description: z.string(),
    category: z.enum(['investments', 'architecture', 'construction', 'tourism', 'design', 'supply']),
    images: z.array(z.string()),
    image: z.string(),
    year: z.number().optional(),
    location: z.string(),
  })
});

export const collections = { projects };
