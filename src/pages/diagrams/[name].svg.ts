import type { APIRoute, GetStaticPaths } from 'astro';

// Serves each diagram's original SVG file at /diagrams/<name>.svg. The article pages inline the diagrams,
// but the Qiita sync hotlinks these standalone files (they follow the OS color scheme when used as an <img>).
const files = import.meta.glob<string>('../../content/blog/images/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const getStaticPaths = (() =>
  Object.entries(files).map(([path, source]) => ({
    params: { name: path.split('/').pop()!.replace(/\.svg$/, '') },
    props: { source },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(props.source, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
