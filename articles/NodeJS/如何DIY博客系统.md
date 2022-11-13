# 如何DIY博客系统

> 自己使用NodeJS一步步的构建起一个相对简单但是又可以使用的博客系统

## 契机

说实话，作为一个前端开发，我个人写博客的经验并不多，但是平常偶尔也会写一些非技术类的文章，但是可能都没有以一个博客的形式发出来，大多散落在各个网络平台或者在线笔记上。所以写博客这件事对于我来说不是一个持之以恒的事情。

但是最近逛知乎的时候发现了一个有意思的问题[你见过的最棒的个人博客界面是什么样的？](https://www.zhihu.com/question/29755481)，说实话我还真没有见识过太多的博客，长期关注的博客很少，比如[阮一峰的网络日志](https://www.ruanyifeng.com/blog/)，其他都是不一定从搜索引擎查什么问题的时候链接过去的各种五花八门的个人博客。

我可能更多的还是关注博客的内容了，所以对于界面的美丑到没有太多的在意过，之前刚入行不就得时候也用过[Hexo](https://hexo.io/)、[WordPress](https://wordpress.com/zh-cn/?apppromo)，后来也尝试过[VuePress](https://vuepress.vuejs.org/)去构建文档站点，在[Docusaurus](https://docusaurus.io/)推出之后也试玩过，目前最新的[VitePress](https://vitepress.vuejs.org/)还没有试过。

## 开始

### 第一步

> 将markdown转化为HTML

这里我使用的是[showdown](https://showdownjs.com/)，这是一个非常棒的可以双向转换HTML <-> Markdown的工具库。

### 第二步

> 使用模板动态构建页面

这里我使用的模板引擎是[EJS](https://ejs.co/)，使用它可以往HTML模板内传参，将一些动态内容注入到HTML文件内

### 第三步

> 解决文章创建时间和更新展示问题

通过`fs.statSync` api 获取文件的创建时间和修改时间，通过[JSDOM](https://github.com/jsdom/jsdom)获取文章标题，为其添加动态属性，通过伪元素实现时间字符串的注入。

### 第四步

> 压缩转换后的HTML文件，并将其输出到指定目录

使用[html-minifier](https://github.com/kangax/html-minifier)压缩HTML文件，使用`fs.writeFile` api 将文件写入指定目录下

### 第五步

> 搭建本地HTTP服务实现预览功能

借助Node原生模块 `http` 创建 `server`，编写路由实现静态服务预览效果，使用 `fs.watch` api 实现监听目标文件夹下的文件变更，进行更新HTML操作

### 第六步

> 提取配置项，将部分动态信息传入

```javascript
module.exports = {
  entry: "articles", // 入口文件夹
  output: "blog", // 输出文件夹
  author: "Peter Yuan", // 作者信息
  css: "default.css", // 默认使用主题样式文件
  name: "How To", // 博客名称
  socialMedias: [], // 社交媒体账号链接展示
  datetime: { // 创建时间&更新时间戳展示配置和格式化
    use: true,
    format: "YYYY/MM/DD HH:mm:ss", 
  },
  dev: { // 本地服务配置
    port: 8080,
  },
  showdownConfig: { // showdown的配置项
    strikethrough: true,
    underline: true,
    ...
  },
};

```

### 总结

这个过程中还使用了不少其他的方案，比如：

- [dayjs](https://day.js.org/)格式化时间
- 原生Node模块`child_process`执行shell命令，获取目标文件夹下的文件总数
- 原生Node模块`events`的EventEmitter来实现事件监听
- 通过知乎问题[有哪些Markdown的CSS样式表推荐？](https://www.zhihu.com/question/60135717)找到的自己喜欢的Markdown样式，总之找一个自己喜欢的下载下来css文件就可以用了
- 我使用的颜色和背景图来自于[中国传统颜色网站](https://colors.ichuantong.cn/)，感兴趣的可以去逛逛
- 代码高亮使用的是[highlightjs](https://highlightjs.org/)，有很多的主题配色供你选择，我使用的是
    
    ```html
     <link
      rel="stylesheet"
      href="https://highlightjs.org/static/demo/styles/agate.css"
    />
    ```

## 最后

> 感兴趣的可以clone代码，自己改造着玩 https://github.com/GitHubJiKe/howto

最后就是，代码组织的不够好，也没有做什么抽象，就是最简单的最快的拿原生JS撸了一下，大概用了两天的业余时间还有部分周末时间，所以后期又时间的话可能会重构一下，看能不能做的更好一点。

对了我部署站点用的是免费的[Vercel](https://vercel.com/)