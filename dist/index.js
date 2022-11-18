"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_util_1 = require("node:util");
const node_child_process_1 = require("node:child_process");
const tapable_1 = require("tapable");
const showdown_1 = __importDefault(require("showdown"));
// import { JSDOM } from 'jsdom';
const html_minifier_terser_1 = require("html-minifier-terser");
const handlebars_1 = __importDefault(require("handlebars"));
const fs_extra_1 = require("fs-extra");
const execPromise = (0, node_util_1.promisify)(node_child_process_1.exec);
const minifyConfig = {
    removeAttributeQuotes: true,
    removeComments: true,
    removeEmptyAttributes: true,
    removeOptionalTags: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    removeTagWhitespace: true,
    removeRedundantAttributes: true,
    sortAttributes: true,
    sortClassName: true,
    trimCustomFragments: true,
    useShortDoctype: true,
    html5: true,
    minifyCSS: true,
    minifyJS: true,
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    decodeEntities: true,
    processScripts: ["text/html"],
};
class BlogEngine {
    config = {};
    #converter = null;
    #articlePaths = [];
    assets = [];
    plugins = [];
    hooks = {
        beforeEmit: new tapable_1.AsyncSeriesHook(["cxt"]),
        afterEmit: new tapable_1.AsyncSeriesHook(["cxt"]),
    };
    static CONFIG_PATH = (0, node_path_1.resolve)(__dirname, "../config.js");
    static MD_EXT = ".md";
    static HTML_EXT = ".html";
    constructor() {
        this.#init();
    }
    use(plugin) {
        if (this.plugins.find((v) => v.name === plugin.name)) {
            return;
        }
        this.plugins.push(plugin);
    }
    #callPluginHookBeforeEmit() {
        return this.hooks.beforeEmit.promise(this);
    }
    #callPluginHookAfterEmit() {
        return this.hooks.afterEmit.promise(this);
    }
    async #watch(type, filePath) {
        const _filePath = (0, node_path_1.resolve)(this.config.entry, filePath);
        if (type === "change") {
            // 更新文章 filename
            for (let index = 0; index < this.assets.length; index++) {
                const { path } = this.assets[index];
                if (_filePath === (0, node_path_1.format)(path)) {
                    this.assets[index] = await this.#convert2HTMLInfo((0, node_path_1.parse)((0, node_path_1.format)(path)));
                    await this.#emitWatch(this.assets[index]);
                }
            }
        }
        if (type === "rename") {
            if (!(0, node_fs_1.existsSync)(_filePath)) {
                // 删除
                const index = this.assets.findIndex((v) => (0, node_path_1.format)(v.path) === _filePath);
                if (index > -1) {
                    this.assets.splice(index, 1);
                    await this.#emit();
                }
            }
            else {
                // 新建
                const asset = await this.#convert2HTMLInfo((0, node_path_1.parse)(_filePath));
                this.assets.push(asset);
                await this.#emitWatch(asset);
            }
        }
    }
    async start() {
        if (process.env.NODE_ENV === "preview") {
            (0, node_fs_1.watch)(this.config.entry, { recursive: true }, this.#watch.bind(this));
        }
        return new Promise(async (resolve) => {
            console.log("start");
            await this.#readArticlePaths(this.config.entry);
            await this.#convertAllArticles();
            await this.#applyPlugins();
            await this.#emit();
            resolve(this);
        });
    }
    async #emit() {
        await this.#callPluginHookBeforeEmit();
        await this.#emitAssets();
        await this.#callPluginHookAfterEmit();
    }
    async #emitWatch(asset) {
        await this.#callPluginHookBeforeEmit();
        await this.#emitFile(asset);
        await this.#callPluginHookAfterEmit();
    }
    async #applyPlugins() {
        for (const plugin of this.plugins) {
            await plugin.apply(this);
        }
    }
    async #emitAssets() {
        for (const asset of this.assets) {
            await this.#emitFile(asset);
        }
    }
    async #emitFile(asset) {
        const { html, path, category } = asset;
        const blogDir = `${this.config.output}/${category}/`;
        if (!(0, node_fs_1.existsSync)(blogDir)) {
            (0, fs_extra_1.ensureDirSync)(blogDir);
        }
        await (0, promises_1.writeFile)(`${blogDir}${path.base.replace(BlogEngine.MD_EXT, BlogEngine.HTML_EXT)}`, html);
    }
    async #init() {
        this.#loadConfig();
        this.#initConverter();
    }
    async #convertAllArticles() {
        for (const articltPath of this.#articlePaths) {
            const asset = await this.#convert2HTMLInfo(articltPath);
            this.assets.push(asset);
        }
    }
    async #convert2HTMLInfo(path) {
        const content = await (0, promises_1.readFile)(`${path.dir}/${path.base}`);
        const html = this.#converter.makeHtml(content.toString());
        const metadata = this.#converter.getMetadata();
        const arr = path.dir.split("/");
        const category = arr.pop();
        if (metadata.topics && typeof metadata.topics === "string") {
            metadata.topics = metadata.topics.split(" ");
        }
        return { html, metadata, category, path };
    }
    #loadConfig() {
        this.config = require(BlogEngine.CONFIG_PATH);
    }
    #initConverter() {
        const defaultConverterOpts = {
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
        };
        this.#converter = new showdown_1.default.Converter(defaultConverterOpts);
    }
    async #readArticlePaths(entry) {
        if (entry) {
            if ((0, node_fs_1.existsSync)(entry)) {
                const paths = await (0, promises_1.readdir)(entry);
                for (const articlePath of paths) {
                    const ap = (0, node_path_1.resolve)(entry, articlePath);
                    const _ap = (0, node_path_1.parse)(ap);
                    if ((0, node_fs_1.statSync)(ap).isDirectory()) {
                        await this.#readArticlePaths(ap);
                    }
                    else if (_ap.ext === BlogEngine.MD_EXT) {
                        this.#articlePaths.push(_ap);
                    }
                }
            }
        }
    }
}
const engine = new BlogEngine();
class Plugin {
    name;
    apply;
}
class LayoutPlugin {
    opts = {};
    constructor(opts) {
        this.opts = opts;
    }
    name = "LayoutPlugin";
    async apply(cxt) {
        cxt.hooks.beforeEmit.tapPromise(this.name, (cxt) => {
            return new Promise(async (resolveP) => {
                const { output } = cxt.config;
                const stylesheet = this.opts.stylesheet(output);
                let count = 0;
                for (const asset of cxt.assets) {
                    const templateContent = (await (0, promises_1.readFile)(this.opts.path)).toString();
                    const template = handlebars_1.default.compile(templateContent);
                    const content = new handlebars_1.default.SafeString(asset.html);
                    asset.html = template({
                        ...asset.metadata,
                        stylesheet,
                        content,
                    });
                    count += 1;
                    if (count === cxt.assets.length) {
                        console.log("layout done");
                        resolveP();
                    }
                }
            });
        });
    }
}
class MinifyHTMLPlugin {
    name = "MinifyHTMLPlugin";
    async apply(cxt) {
        cxt.hooks.beforeEmit.tapPromise(this.name, (cxt) => {
            return new Promise(async (resolve) => {
                let count = 0;
                for (const asset of cxt.assets) {
                    asset.html = await (0, html_minifier_terser_1.minify)(asset.html, minifyConfig);
                    count += 1;
                    if (count === cxt.assets.length) {
                        console.log("minified done");
                        resolve();
                    }
                }
            });
        });
    }
}
class ClearPlugin {
    name = "ClearPlugin";
    apply(cxt) {
        cxt.hooks.beforeEmit.tapPromise(this.name, (cxt) => {
            return new Promise(async (resolve) => {
                if (process.env.NODE_ENV !== "preview") {
                    const execPromise = (0, node_util_1.promisify)(node_child_process_1.exec);
                    await execPromise(`rm -rf ${cxt.config.output}/*`);
                    console.log("clear done");
                }
                resolve();
            });
        });
    }
}
class HomePagePlugin {
    opts = {};
    constructor(opts) {
        this.opts = opts;
    }
    name = "HomePagePlugin";
    apply(cxt) {
        cxt.hooks.beforeEmit.tapPromise(this.name, (cxt) => {
            return new Promise(async (resolveP) => {
                const { config, assets } = cxt;
                const { name: title, socialMedias, author, output } = config;
                const templateContent = (await (0, promises_1.readFile)(this.opts.path)).toString();
                const template = handlebars_1.default.compile(templateContent);
                const stylesheet = this.opts.stylesheet(output);
                const categoryMap = {};
                assets.forEach((asset) => {
                    if (!categoryMap[asset.category]) {
                        categoryMap[asset.category] = [];
                    }
                    categoryMap[asset.category].push(asset.path.name);
                });
                const htmlContent = template({
                    title,
                    socialMedias,
                    author,
                    stylesheet,
                    categoryMap,
                    copyright: `@Copyright ${new Date().getFullYear()} | ${author}`,
                });
                cxt.assets.push({
                    html: htmlContent,
                    path: (0, node_path_1.parse)((0, node_path_1.resolve)(output, "index.html")),
                    category: "/",
                });
                console.log("home done");
                resolveP();
            });
        });
    }
}
engine.use(new LayoutPlugin({
    path: (0, node_path_1.resolve)(__dirname, "../templates/layout.handlebars"),
    stylesheet: (path) => {
        return (0, node_path_1.resolve)(path, "/assets/styles/default.css");
    },
}));
engine.use(new HomePagePlugin({
    path: (0, node_path_1.resolve)(__dirname, "../templates/homepage.handlebars"),
    stylesheet: (path) => {
        return (0, node_path_1.resolve)(path, "/assets/styles/default.css");
    },
}));
engine.use(new MinifyHTMLPlugin());
engine.use(new ClearPlugin());
engine.start().then(async (cxt) => {
    await execPromise(`cp -R ${(0, node_path_1.resolve)(__dirname, "../assets")} ${cxt.config.output}`);
    console.log("done");
});
