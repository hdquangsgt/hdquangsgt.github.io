// Locales and UI strings. English is the default and lives at the site root;
// every other locale is served under a prefix (/vi/, /ja/).
import type { Category } from './consts';

export const LOCALES = ['en', 'vi', 'ja'] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LANG: Lang = 'en';

/** Locales that get a URL prefix, used by getStaticPaths in src/pages/[lang]/. */
export const PREFIXED_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LANG);

export const LOCALE_META: Record<Lang, { name: string; htmlLang: string; ogLocale: string; dateLocale: string }> = {
  en: { name: 'English', htmlLang: 'en', ogLocale: 'en_US', dateLocale: 'en-US' },
  vi: { name: 'Tiếng Việt', htmlLang: 'vi', ogLocale: 'vi_VN', dateLocale: 'vi-VN' },
  ja: { name: '日本語', htmlLang: 'ja', ogLocale: 'ja_JP', dateLocale: 'ja-JP' },
};

export function isLang(value: string | undefined): value is Lang {
  return (LOCALES as readonly string[]).includes(value ?? '');
}

/** The locale of a URL, from its first path segment. */
export function langFromUrl(url: URL): Lang {
  const first = url.pathname.split('/')[1];
  return isLang(first) ? first : DEFAULT_LANG;
}

/** Prefix a root-relative path ("/blog/") with the locale ("/vi/blog/"). */
export function localizePath(lang: Lang, path: string): string {
  return lang === DEFAULT_LANG ? path : `/${lang}${path}`;
}

/** Strip any locale prefix from a path: "/vi/blog/" -> "/blog/". */
export function unlocalizePath(path: string): string {
  const [, first, ...rest] = path.split('/');
  return isLang(first) ? `/${rest.join('/')}` : path;
}

type Plural = (n: number) => string;

interface Strings {
  siteDescription: string;
  nav: { blog: string; about: string; rss: string };
  languageSwitcher: string;
  /** Appended to a language name when this page has no version in that language: the link goes to its homepage. */
  languageHome: string;
  skipLink: string;
  home: { startHere: string; recent: string; topics: string; browseAll: Plural; noPosts: string };
  blog: {
    title: string;
    description: string;
    lead: string;
    searchLabel: string;
    searchPlaceholder: string;
    /** `{shown}` and `{total}` are replaced in the browser. */
    searchStatus: string;
    noMatch: string;
    clearSearch: string;
    tryDifferent: string;
  };
  topic: { browse: string; categories: string; tags: string; all: string; category: string; tag: string };
  post: {
    allArticles: string;
    updated: string;
    minRead: Plural;
    draft: string;
    scheduled: string;
    onThisPage: string;
    related: string;
    older: string;
    newer: string;
    backToAll: string;
    pagerLabel: string;
    alsoIn: string;
    copy: string;
    copied: string;
    copyFailed: string;
    copyLabel: string;
  };
  articles: Plural;
  categoryDescription: (name: string) => string;
  tagDescription: (name: string) => string;
  categories: Record<Category, string>;
  about: {
    title: string;
    description: string;
    intro: (author: string) => string;
    interestsTitle: string;
    interests: string[];
    topicsTitle: string;
    topics: string[];
    labelsNote: string;
    elsewhere: string;
    rssFeed: string;
  };
  footer: { sitemap: string };
}

export const UI: Record<Lang, Strings> = {
  en: {
    siteDescription:
      'Notes, experiments, and perspectives on AI agents, software engineering, and building real systems.',
    nav: { blog: 'Blog', about: 'About', rss: 'RSS' },
    languageSwitcher: 'Language',
    languageHome: 'homepage',
    skipLink: 'Skip to content',
    home: {
      startHere: 'New here? Start with',
      recent: 'Recent articles',
      topics: 'Topics',
      browseAll: (n) => `All ${n} ${n === 1 ? 'article' : 'articles'} →`,
      noPosts: 'No articles published yet.',
    },
    blog: {
      title: 'Blog',
      description: 'All articles on AI agents, software engineering, developer tools, and system design.',
      lead: 'All articles, newest first. Browse by topic or search titles, tags, and full text.',
      searchLabel: 'Search articles',
      searchPlaceholder: 'e.g. permissions, sandbox, MCP',
      searchStatus: '{shown} of {total} articles match.',
      noMatch: 'No articles match your search.',
      tryDifferent: 'Try a different term, or',
      clearSearch: 'clear the search',
    },
    topic: { browse: 'Browse by topic', categories: 'Categories', tags: 'Tags', all: 'All', category: 'Category', tag: 'Tag' },
    post: {
      allArticles: '← All articles',
      updated: 'Updated',
      minRead: (n) => `${n} min read`,
      draft: 'Draft',
      scheduled: 'Scheduled',
      onThisPage: 'On this page',
      related: 'Related articles',
      older: 'Older',
      newer: 'Newer',
      backToAll: '← Back to all articles',
      pagerLabel: 'Previous and next articles',
      alsoIn: 'Also available in',
      copy: 'Copy',
      copied: 'Copied',
      copyFailed: 'Copy failed',
      copyLabel: 'Copy code to clipboard',
    },
    articles: (n) => `${n} ${n === 1 ? 'article' : 'articles'}`,
    categoryDescription: (name) => `Articles in the ${name} category.`,
    tagDescription: (name) => `Articles tagged “${name}”.`,
    categories: {
      'AI Agents': 'AI Agents',
      'Software Engineering': 'Software Engineering',
      'Developer Tools': 'Developer Tools',
      'Cloud Infrastructure': 'Cloud Infrastructure',
      'System Design': 'System Design',
      Notes: 'Notes',
    },
    about: {
      title: 'About',
      description: 'About the author and this blog.',
      intro: (author) =>
        `Hi, I'm ${author}. This blog is where I write longer-form notes on AI agents, software engineering, and building real systems.`,
      interestsTitle: 'Technical interests',
      interests: [
        'AI coding agents and how they are built',
        'Developer tooling',
        'Software architecture and system design',
        'Cloud infrastructure',
      ],
      topicsTitle: "What you'll find here",
      topics: [
        'In-depth analysis of AI agents and their design trade-offs',
        'Practical notes from building and operating software',
        'Experiments, with the setup and results written down',
      ],
      labelsNote:
        'Articles separate documented facts, things I verified myself, and my own opinions, and link to their sources. If you spot an error, please let me know.',
      elsewhere: 'Elsewhere',
      rssFeed: 'RSS feed',
    },
    footer: { sitemap: 'Sitemap' },
  },

  vi: {
    siteDescription:
      'Ghi chép, thử nghiệm và góc nhìn về AI agent, kỹ thuật phần mềm và việc xây dựng các hệ thống thực tế.',
    nav: { blog: 'Blog', about: 'Giới thiệu', rss: 'RSS' },
    languageSwitcher: 'Ngôn ngữ',
    languageHome: 'trang chủ',
    skipLink: 'Chuyển đến nội dung',
    home: {
      startHere: 'Mới ghé qua? Hãy bắt đầu với',
      recent: 'Bài viết gần đây',
      topics: 'Chủ đề',
      browseAll: (n) => `Xem tất cả ${n} bài viết →`,
      noPosts: 'Chưa có bài viết nào.',
    },
    blog: {
      title: 'Blog',
      description: 'Tất cả bài viết về AI agent, kỹ thuật phần mềm, công cụ cho lập trình viên và thiết kế hệ thống.',
      lead: 'Tất cả bài viết, mới nhất trước. Duyệt theo chủ đề hoặc tìm theo tiêu đề, thẻ và toàn văn.',
      searchLabel: 'Tìm bài viết',
      searchPlaceholder: 'vd. permissions, sandbox, MCP',
      searchStatus: '{shown} trên {total} bài viết khớp.',
      noMatch: 'Không có bài viết nào khớp với tìm kiếm.',
      tryDifferent: 'Hãy thử từ khóa khác, hoặc',
      clearSearch: 'xóa tìm kiếm',
    },
    topic: {
      browse: 'Duyệt theo chủ đề',
      categories: 'Danh mục',
      tags: 'Thẻ',
      all: 'Tất cả',
      category: 'Danh mục',
      tag: 'Thẻ',
    },
    post: {
      allArticles: '← Tất cả bài viết',
      updated: 'Cập nhật',
      minRead: (n) => `${n} phút đọc`,
      draft: 'Bản nháp',
      scheduled: 'Đã lên lịch',
      onThisPage: 'Trong bài này',
      related: 'Bài viết liên quan',
      older: 'Cũ hơn',
      newer: 'Mới hơn',
      backToAll: '← Quay lại tất cả bài viết',
      pagerLabel: 'Bài trước và bài sau',
      alsoIn: 'Đọc bằng ngôn ngữ khác',
      copy: 'Sao chép',
      copied: 'Đã sao chép',
      copyFailed: 'Sao chép thất bại',
      copyLabel: 'Sao chép mã vào bộ nhớ tạm',
    },
    articles: (n) => `${n} bài viết`,
    categoryDescription: (name) => `Các bài viết trong danh mục ${name}.`,
    tagDescription: (name) => `Các bài viết gắn thẻ “${name}”.`,
    categories: {
      'AI Agents': 'AI Agent',
      'Software Engineering': 'Kỹ thuật phần mềm',
      'Developer Tools': 'Công cụ lập trình',
      'Cloud Infrastructure': 'Hạ tầng đám mây',
      'System Design': 'Thiết kế hệ thống',
      Notes: 'Ghi chép',
    },
    about: {
      title: 'Giới thiệu',
      description: 'Về tác giả và blog này.',
      intro: (author) =>
        `Xin chào, tôi là ${author}. Đây là nơi tôi viết những ghi chép dài hơi về AI agent, kỹ thuật phần mềm và việc xây dựng các hệ thống thực tế.`,
      interestsTitle: 'Mối quan tâm kỹ thuật',
      interests: [
        'AI coding agent và cách chúng được xây dựng',
        'Công cụ cho lập trình viên',
        'Kiến trúc phần mềm và thiết kế hệ thống',
        'Hạ tầng đám mây',
      ],
      topicsTitle: 'Bạn sẽ tìm thấy gì ở đây',
      topics: [
        'Phân tích chuyên sâu về AI agent và các đánh đổi trong thiết kế',
        'Ghi chép thực tế từ việc xây dựng và vận hành phần mềm',
        'Các thử nghiệm, kèm cách thiết lập và kết quả',
      ],
      labelsNote:
        'Các bài viết tách bạch dữ kiện có trong tài liệu, những gì tôi tự kiểm chứng và quan điểm cá nhân, kèm liên kết đến nguồn. Nếu bạn thấy sai sót, hãy cho tôi biết.',
      elsewhere: 'Ở nơi khác',
      rssFeed: 'RSS feed',
    },
    footer: { sitemap: 'Sơ đồ trang' },
  },

  ja: {
    siteDescription: 'AIエージェント、ソフトウェアエンジニアリング、実システムの構築についてのノート、実験、考察。',
    nav: { blog: 'ブログ', about: 'このブログについて', rss: 'RSS' },
    languageSwitcher: '言語',
    languageHome: 'ホーム',
    skipLink: '本文へスキップ',
    home: {
      startHere: 'はじめての方は',
      recent: '最近の記事',
      topics: 'トピック',
      browseAll: (n) => `全${n}件の記事を見る →`,
      noPosts: 'まだ記事はありません。',
    },
    blog: {
      title: 'ブログ',
      description: 'AIエージェント、ソフトウェアエンジニアリング、開発者ツール、システム設計に関するすべての記事。',
      lead: 'すべての記事を新しい順に表示します。トピックで絞り込むか、タイトル・タグ・本文を検索できます。',
      searchLabel: '記事を検索',
      searchPlaceholder: '例: permissions, sandbox, MCP',
      searchStatus: '{total}件中{shown}件が一致しました。',
      noMatch: '検索に一致する記事はありません。',
      tryDifferent: '別のキーワードを試すか、',
      clearSearch: '検索をクリア',
    },
    topic: {
      browse: 'トピックで探す',
      categories: 'カテゴリー',
      tags: 'タグ',
      all: 'すべて',
      category: 'カテゴリー',
      tag: 'タグ',
    },
    post: {
      allArticles: '← すべての記事',
      updated: '更新',
      minRead: (n) => `${n}分で読めます`,
      draft: '下書き',
      scheduled: '予約済み',
      onThisPage: '目次',
      related: '関連記事',
      older: '前の記事',
      newer: '次の記事',
      backToAll: '← すべての記事に戻る',
      pagerLabel: '前後の記事',
      alsoIn: '他の言語で読む',
      copy: 'コピー',
      copied: 'コピーしました',
      copyFailed: 'コピーに失敗しました',
      copyLabel: 'コードをクリップボードにコピー',
    },
    articles: (n) => `${n}件の記事`,
    categoryDescription: (name) => `カテゴリー「${name}」の記事。`,
    tagDescription: (name) => `タグ「${name}」の記事。`,
    categories: {
      'AI Agents': 'AIエージェント',
      'Software Engineering': 'ソフトウェアエンジニアリング',
      'Developer Tools': '開発者ツール',
      'Cloud Infrastructure': 'クラウドインフラ',
      'System Design': 'システム設計',
      Notes: 'ノート',
    },
    about: {
      title: 'このブログについて',
      description: '著者とこのブログについて。',
      intro: (author) =>
        `こんにちは、${author}です。このブログでは、AIエージェント、ソフトウェアエンジニアリング、実システムの構築について長めのノートを書いています。`,
      interestsTitle: '技術的な関心',
      interests: ['AIコーディングエージェントとその構築方法', '開発者ツール', 'ソフトウェアアーキテクチャとシステム設計', 'クラウドインフラ'],
      topicsTitle: 'このブログで扱うこと',
      topics: [
        'AIエージェントとその設計上のトレードオフの詳細な分析',
        'ソフトウェアの構築と運用から得た実践的なノート',
        '手順と結果を記録した実験',
      ],
      labelsNote:
        '記事では、ドキュメントに記載された事実、私自身が検証したこと、私の意見を区別し、出典へのリンクを示しています。誤りを見つけたらお知らせください。',
      elsewhere: 'その他のリンク',
      rssFeed: 'RSSフィード',
    },
    footer: { sitemap: 'サイトマップ' },
  },
};

export function useTranslations(lang: Lang): Strings {
  return UI[lang];
}
