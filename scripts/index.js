const showdown = require("showdown");
const fs = require("fs-extra");
const Path = require("path");
const Util = require("util");
const ejs = require("ejs");
const minify = require("html-minifier").minify;
const execSync = require("child_process").execSync;
const config = require("../config.json");
const convert = new showdown.Converter();
const readFileAsync = Util.promisify(fs.readFile);

const resolvePath = (path, mid = "../") => Path.resolve(__dirname, mid, path);
const isDir = (path) => fs.statSync(path).isDirectory();

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

async function doConvert() {
  const templatePath = resolvePath(Path.resolve(__dirname, "./template.html"));
  if (!fs.existsSync(output)) {
    fs.ensureDirSync(output);
  } else {
    execSync(`rm -rf ${output}/*`);
  }

  async function read2Cov(entry) {
    const _paths = await fs.readdir(entry);
    for (const _path of _paths) {
      const tempPath = Path.resolve(entry, _path);
      if (!isDir(tempPath)) {
        const res = await readFileAsync(tempPath);
        const htmlTxt = convert.makeHtml(res.toString());
        const articlePath = Path.parse(tempPath.replace("md", "html"));
        articlePath.dir = articlePath.dir.replace(config.entry, config.output);
        const ca = articlePath.dir.split(`${config.output}/`)[1];
        if (!categoryMap[ca]) {
          categoryMap[ca] = [];
        }
        categoryMap[ca] = [articlePath.base];
        if (!fs.existsSync(articlePath.dir)) {
          fs.ensureDirSync(articlePath.dir);
        }
        const content = await ejs.renderFile(templatePath, {
          title: articlePath.name,
        });
        const minified = minify(
          content.replace("{content}", htmlTxt),
          minifyConfig
        );
        await fs.writeFile(Path.format(articlePath), minified);
      } else {
        await read2Cov(tempPath);
      }
    }
  }

  await read2Cov(entry);
  const res = await ejs.renderFile(Path.resolve(__dirname, "./index.html"), {
    title: config.name,
    content: categoryMap,
    github: config.github,
  });
  await fs.writeFile(`${output}/index.html`, minify(res, minifyConfig));
}

doConvert();
