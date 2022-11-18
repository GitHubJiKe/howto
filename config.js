const Path = require("path");
module.exports = {
  entry: Path.resolve(__dirname, "articles"),
  output: Path.resolve(__dirname, "docs"),
  author: "皮特硬",
  name: "如何",
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
};
