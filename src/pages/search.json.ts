import type { APIRoute } from 'astro';
import { searchIndex } from '../utils/feeds';

export const GET: APIRoute = () => searchIndex('en');
