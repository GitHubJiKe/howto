module.exports = {
  entry: "articles",
  output: "docs",
  author: "Peter Yuan",
  css: "default.css",
  name: "How To",
  socialMedias: [
    {
      key: "知乎",
      value: "https://www.zhihu.com/people/ji-ke-yuan",
    },
    {
      key: "github",
      value: "https://github.com/GitHubJiKe/howto",
    },
  ],
  datetime: {
    use: true,
    format: "YYYY/MM/DD HH:mm:ss",
  },
  dev: {
    port: 8080,
  },
  showdownConfig: {
    strikethrough: true,
    underline: true,
    tasklists: true,
    tables: true,
    tablesHeaderId: true,
    splitAdjacentBlockquotes: true,
    smartIndentationFix: true,
    simplifiedAutoLink: true,
    simpleLineBreaks: true,
    requireSpaceBeforeHeadingText: true,
    parseImgDimensions: true,
    openLinksInNewWindow: true,
    omitExtraWLInCodeBlocks: true,
    ghMentions: true,
    excludeTrailingPunctuationFromURLs: true,
    encodeEmails: true,
    emoji: true,
    backslashEscapesHTMLTags: true,
  },
};
