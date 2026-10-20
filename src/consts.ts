// Site-wide settings. Edit these instead of hunting through components.

export const SITE = {
  /** Site name: header wordmark, <title>, RSS and Open Graph. */
  title: 'Quang-SGT',
  /** Heading of the homepage introduction. */
  blogName: "Quang's Blog",
  author: 'Quang Ho',
  /** Default social preview image, relative to /public. */
  ogImage: '/og-default.png',
};

export const SOCIAL_LINKS = [
  { label: 'GitHub', href: 'https://github.com/hdquangsgt' },
];

/** Root-relative paths; labels come from src/i18n.ts and are localized per page. */
export const NAV_LINKS = [
  { key: 'blog', href: '/blog/' },
  { key: 'about', href: '/about/' },
] as const;

/**
 * Allowed article categories. The content schema rejects anything else,
 * so a typo in frontmatter fails the build with a clear message.
 */
export const CATEGORIES = [
  'AI Agents',
  'Software Engineering',
  'Developer Tools',
  'Cloud Infrastructure',
  'System Design',
  'Notes',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Number of articles shown on the homepage; the rest are one link away. */
export const RECENT_POSTS_LIMIT = 8;
