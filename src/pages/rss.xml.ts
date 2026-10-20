import type { APIContext } from 'astro';
import { rssFeed } from '../utils/feeds';

export const GET = (context: APIContext) => rssFeed(context, 'en');
