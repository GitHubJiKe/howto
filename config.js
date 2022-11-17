const Path = require("path");
module.exports = {
  entry: Path.resolve(__dirname, "articles"),
  output: Path.resolve(__dirname, "docs"),
  author: "Peter Yuan",
  css: "default.css",
  name: "How To",
  templates: {
    homepage: Path.resolve(__dirname, "./templates/index.html"),
    layout: Path.resolve(__dirname, "./templates/layout.handlebars"),
  },
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
    port: 3000,
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
    metadata: true,
  },
};
