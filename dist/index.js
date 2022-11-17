"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_child_process_1 = require("node:child_process");
const showdown_1 = __importDefault(require("showdown"));
const html_minifier_terser_1 = require("html-minifier-terser");
const handlebars_1 = __importDefault(require("handlebars"));
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
};
class BlogEngine {
    config = {};
    #converter = null;
    #articlePaths = [];
    #articleCount = 0;
    #allFilesCountInEntry = 0;
    assets = [];
    plugins = [];
    static CONFIG_PATH = (0, node_path_1.resolve)(__dirname, '../config.js');
    constructor() {
        this.#init();
    }
    use(plugin) {
        if (this.plugins.find(v => v.name === plugin.name)) {
            return;
        }
        this.plugins.push(plugin);
    }
    async start() {
        return new Promise(async (resolve) => {
            await this.#readArticlePaths(this.config.entry);
            await this.#convertAllArticles();
            await this.#beforeEmitAssets();
            await this.#emitAssets();
            resolve('done');
        });
    }
    async #beforeEmitAssets() {
        for (const plugin of this.plugins) {
            await plugin.apply(this);
        }
    }
    async #emitAssets() {
        for (const asset of this.assets) {
            const { html, path, category } = asset;
            await (0, promises_1.writeFile)(`${this.config.output}/${category}/${path.base.replace('.md', '.html')}`, html);
        }
    }
    async #init() {
        this.#loadConfig();
        this.#initConverter();
        this.#allFilesCountInEntry = Number((0, node_child_process_1.execSync)(`cd ${this.config.entry} && ls -lR|grep "^-"|wc -l`).toString());
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
        const arr = path.dir.split('/');
        const category = arr.pop();
        return { html, metadata, category, path };
    }
    #loadConfig() {
        this.config = require(BlogEngine.CONFIG_PATH);
    }
    #initConverter() {
        this.#converter = new showdown_1.default.Converter(this.config?.showdownConfig || defaultConverterOpts);
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
                    else if (_ap.ext === '.md') {
                        this.#articleCount++;
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
class JSDOMPlugin {
    name = 'JSDOMPlugin';
    apply(cxt) {
        console.log(cxt.assets);
        // const root = new JSDOM(html);
        // const header = root.window._document.querySelector("h1");
        // header.setAttribute(
        //     "data-time",
        //     "更新时间：<%= updateDate %> | 创建时间： <%= createDate %>"
        // );
        // return root.serialize();
        return cxt;
    }
}
class LayoutPlugin {
    name = "LayoutPlugin";
    async apply(cxt) {
        const { templates: { layout }, output } = cxt.config;
        const stylesheet = (0, node_path_1.resolve)(output, "/assets/styles", "default.css");
        for (const asset of cxt.assets) {
            const templateContent = (await (0, promises_1.readFile)(layout)).toString();
            const template = handlebars_1.default.compile(templateContent);
            const content = new handlebars_1.default.SafeString(asset.html);
            asset.html = template({
                ...asset.metadata,
                stylesheet,
                content
            });
        }
        return cxt;
    }
}
class MinifyHTMLPlugin {
    name = 'MinifyHTMLPlugin';
    async apply(cxt) {
        for (const asset of cxt.assets) {
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
                processScripts: ['text/html'],
            };
            asset.html = await (0, html_minifier_terser_1.minify)(asset.html, minifyConfig);
        }
        return cxt;
    }
}
engine.use(new LayoutPlugin());
engine.use(new MinifyHTMLPlugin());
engine.start().then((res) => {
    console.log(res);
});
exports.default = engine;
