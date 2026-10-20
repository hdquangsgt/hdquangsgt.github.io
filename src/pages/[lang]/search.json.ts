import type { APIRoute } from 'astro';
import type { Lang } from '../../i18n';
import { searchIndex } from '../../utils/feeds';
import { localeParams } from '../../utils/paths';

export const getStaticPaths = localeParams;
export const GET: APIRoute = ({ params }) => searchIndex(params.lang as Lang);
