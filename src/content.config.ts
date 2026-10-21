import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORIES } from './consts';

const blog = defineCollection({
  // Each Markdown file in src/content/blog/ is one article; its filename is the URL slug.
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1, 'title is required'),
      description: z
        .string()
        .min(1, 'description is required')
        .max(300, 'description should be a short summary (300 characters max)'),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      category: z.enum(CATEGORIES),
      tags: z.array(z.string().min(1)).default([]),
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
      author: z.string().optional(),
      // Optional Qiita opt-in; read only by scripts/qiita/, ignored when rendering.
      qiita: z
        .object({
          publish: z.boolean().default(false),
          visibility: z.enum(['limited', 'public']).default('limited'),
          tags: z.array(z.string().min(1)).max(5).optional(),
        })
        .optional(),
      coverImage: z
        .object({
          src: image(),
          alt: z.string().min(1, 'coverImage.alt is required for accessibility'),
        })
        .optional(),
    }),
});

export const collections = { blog };
