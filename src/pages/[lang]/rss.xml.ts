import type { APIContext } from 'astro';
import type { Lang } from '../../i18n';
import { rssFeed } from '../../utils/feeds';
import { localeParams } from '../../utils/paths';

export const getStaticPaths = localeParams;
export const GET = (context: APIContext) => rssFeed(context, context.params.lang as Lang);
