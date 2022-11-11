const showdown = require("showdown");
const fs = require("fs-extra");
const Path = require("path");
const Util = require("util");
const ejs = require("ejs");
const JSDOM = require("jsdom").JSDOM;
const minify = require("html-minifier").minify;
const execSync = require("child_process").execSync;
const EventEmitter = require("events").EventEmitter;
const dayjs = require("dayjs");
const config = require("../config.js");
const convert = new showdown.Converter();
const readFileAsync = Util.promisify(fs.readFile);

const resolvePath = (path, mid = "../") => Path.resolve(__dirname, mid, path);

const isDir = (path) => fs.statSync(path).isDirectory();

const getAllArticleCount = (path = "./") =>
  Number(execSync(`cd ${path} && ls -lR|grep "^-"|wc -l`).toString());

const categoryMap = {};

const minifyConfig = {
  removeAttributeQuotes: true,
  html5: true,
  minifyCSS: true,
  minifyJS: true,
  minifyURLs: true,
  collapseWhitespace: true,
};

const entry = resolvePath(config.entry);
const output = resolvePath(config.output);
const count = getAllArticleCount(entry);

async function doConvert() {
  console.log("转换开始啦");
  const templatePath = resolvePath(Path.resolve(__dirname, "./template.html"));

  if (!fs.existsSync(output)) {
    fs.ensureDirSync(output);
  } else {
    execSync(`rm -rf ${output}/*`);
  }

  let _count = 0;
  const event = new EventEmitter();

  async function genHomePage() {
    const res = await ejs.renderFile(Path.resolve(__dirname, "./index.html"), {
      title: config.name,
      content: categoryMap,
      github: config.github,
    });
    await fs.writeFile(`${output}/index.html`, minify(res, minifyConfig));
    console.log("转换搞定啦");
  }

  event.on("done", genHomePage);

  async function genHtmlTxt(path) {
    const res = await readFileAsync(path);
    return convert.makeHtml(res.toString());
  }
  // data-time="<%= updateDate %>|<%= createDate %>"
  function genArticlePath(path) {
    const articlePath = Path.parse(path.replace("md", "html"));
    articlePath.dir = articlePath.dir.replace(config.entry, config.output);
    return articlePath;
  }

  function setCategoryMap(path) {
    const category = path.dir.split(`${config.output}/`)[1];
    if (!categoryMap[category]) {
      categoryMap[category] = [];
    }
    if (!categoryMap[category].includes(path.base)) {
      categoryMap[category].push(path.base);
    }
    return [category, path.base];
  }

  async function genArticleContent(path, opts = {}) {
    return await ejs.renderFile(templatePath, {
      title: path.name,
      ...opts,
      name: config.name,
      github: config.github,
    });
  }

  function ensureArticlePath(path) {
    if (!fs.existsSync(path.dir)) {
      fs.ensureDirSync(path.dir);
    }
  }

  function formatTime(date) {
    return dayjs(date).format(config.datetime.format || "YYYY/MM/DD HH:mm:ss");
  }

  function getPrevOrNext(entry, path) {
    if (path) {
      const tempPath = Path.resolve(entry, path);
      const articlePath = genArticlePath(tempPath);
      const [c, p] = setCategoryMap(articlePath);
      return `/${c}/${p}`;
    }

    return "";
  }

  async function read2Cov(entry) {
    const _paths = await fs.readdir(entry);
    for (let index = 0; index < _paths.length; index++) {
      const _path = _paths[index];
      const tempPath = Path.resolve(entry, _path);
      if (!isDir(tempPath)) {
        const stats = fs.statSync(tempPath);
        const updateDate = formatTime(stats.mtime); // 更新修改时间
        const createDate = formatTime(stats.birthtime); // 创建时间

        let htmlTxt = await genHtmlTxt(tempPath);
        if (config.datetime && config.datetime.use) {
          const dom = new JSDOM(htmlTxt);
          const header = dom.window._document.querySelector("h1");
          header.setAttribute(
            "data-time",
            "更新时间：<%= updateDate %> | 创建时间： <%= createDate %>"
          );

          htmlTxt = dom.serialize();
        }
        const articlePath = genArticlePath(tempPath);

        setCategoryMap(articlePath);

        ensureArticlePath(articlePath);

        let prev, next;

        if (_paths[index + 1]) {
          next = getPrevOrNext(entry, _paths[index + 1]);
        }

        if (_paths[index - 1]) {
          prev = getPrevOrNext(entry, _paths[index - 1]);
        }

        const content = (
          await genArticleContent(articlePath, { prev, next })
        ).replace("{content}", htmlTxt);

        const txt = ejs.render(content, {
          updateDate,
          createDate,
        });
        const minified = minify(txt, minifyConfig);

        await fs.writeFile(Path.format(articlePath), minified);
        _count++;
        if (_count === count) {
          event.emit("done");
        }
      } else {
        read2Cov(tempPath);
      }
    }
  }

  const res = await read2Cov(entry);
}

doConvert();
