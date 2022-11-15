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
const http = require("http");
const config = require("../config.js");
const convert = new showdown.Converter(config.showdownConfig);

const readFileAsync = Util.promisify(fs.readFile);
const isDir = (path) => fs.statSync(path).isDirectory();
const getAllArticleCount = (path = "./") =>
  Number(execSync(`cd ${path} && ls -lR|grep "^-"|wc -l`).toString());
const isPreview = () =>
  process.env.NODE_ENV && process.env.NODE_ENV === "preview";

const categoryMap = {};
const minifyConfig = {
  removeAttributeQuotes: true,
  html5: true,
  minifyCSS: true,
  minifyJS: true,
  minifyURLs: true,
  collapseWhitespace: true,
};

const entry = Path.resolve(__dirname, `../${config.entry}`);
const output = Path.resolve(__dirname, `../${config.output}`);
const count = getAllArticleCount(entry);
const templatePath = Path.resolve(__dirname, "./template.html");
const event = new EventEmitter();
const stylesheet = Path.resolve(
  output,
  "/assets/styles",
  config.css || "default.css"
);

async function genHomePage() {
  const { name: title, socialMedias, author } = config;
  const res = await ejs.renderFile(Path.resolve(__dirname, "./index.html"), {
    title,
    content: categoryMap,
    socialMedias,
    stylesheet,
    copyright: `Copyright©${dayjs().year()} | ${author}`,
    author,
  });
  await fs.writeFile(`${output}/index.html`, minify(res, minifyConfig));
  await fs.copy(Path.resolve(__dirname, "../assets"), `${output}/assets`);
  console.log("转换搞定啦");
  if (isPreview()) {
    createServer({ port: config.dev.port });
  }
}

async function genHtmlTxt(path) {
  const res = await readFileAsync(path);
  return convert.makeHtml(res.toString());
}

function genArticlePath(path) {
  const articlePath = Path.parse(path.replace("md", "html"));
  articlePath.dir = articlePath.dir.replace(config.entry, config.output);
  return articlePath;
}

function getCategory(path) {
  return path.dir.split(`${config.output}/`)[1];
}

function setCategoryMap(path) {
  const category = getCategory(path);
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
    name: config.name,
    stylesheet,
    ...opts,
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
    return `/${getCategory(articlePath)}/${articlePath.base}`;
  }

  return "";
}

async function convertMDFile(tempPath, opts) {
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
  if (opts) {
    const { _paths, index, entry } = opts;
    if (_paths[index + 1]) {
      next = getPrevOrNext(entry, _paths[index + 1]);
    }

    if (_paths[index - 1]) {
      prev = getPrevOrNext(entry, _paths[index - 1]);
    }
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
}

async function startConvert() {
  console.log("开始转换啦");

  if (!fs.existsSync(output)) {
    fs.ensureDirSync(output);
  } else {
    execSync(`rm -rf ${output}/*`);
  }

  let _count = 0;

  async function read2Cov(entry) {
    const _paths = await fs.readdir(entry);
    for (let index = 0; index < _paths.length; index++) {
      const _path = _paths[index];
      const tempPath = Path.resolve(entry, _path);
      if (!isDir(tempPath)) {
        await convertMDFile(tempPath, { _paths, index, entry });
        _count++;
        if (_count === count) {
          event.emit("done");
        }
      } else {
        await read2Cov(tempPath);
      }
    }
  }

  await read2Cov(entry);
}

function createServer({ port = 8080 }) {
  const routes = async (request, response) => {
    let url = request.url;
    let contentType = "text/html";
    let extra;
    if (url === "/") {
      contentType = "text/html";
      url = "/index.html";
    } else if (url.endsWith(".html")) {
      contentType = "text/html";
    } else if (url.endsWith(".css")) {
      contentType = "text/css";
    } else if (url.endsWith(".png") || url.endsWith(".ico")) {
      contentType = "image/png";
      extra = "binary";
    }
    response.writeHead(200, { "Content-Type": contentType });

    const res = await readFileAsync(`${output}${decodeURIComponent(url)}`);
    response.end(extra ? res : res.toString(), extra);
  };
  http.createServer(routes).listen(port);
  console.log(`Server running at http://localhost:${port}/`);
}

function watch() {
  fs.watch(entry, { recursive: true }, async (_, tempPath) => {
    await convertMDFile(Path.resolve(entry, tempPath));
  });
}

event.on("done", genHomePage);
event.on(
  "start",
  isPreview()
    ? () => {
        startConvert();
        watch();
      }
    : startConvert
);

event.emit("start");
