import { readFile, readdir, writeFile } from "node:fs/promises"
import { existsSync, statSync, watch } from "node:fs"
import { resolve, parse, ParsedPath, format } from "node:path"
import { promisify } from "node:util"
import { exec } from "node:child_process"
import { AsyncSeriesHook } from 'tapable';
import showdown from 'showdown';
// import { JSDOM } from 'jsdom';
import { minify, Options } from 'html-minifier-terser'
import handlebars from 'handlebars'
import { ensureDirSync } from "fs-extra"
import dayjs from 'dayjs'


const execPromise = promisify(exec)


const minifyConfig: Options = {
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
}

interface BlogConfig {
    entry: string;
    output: string;
    name: string;
    author: string;
    socialMedias: Array<{ key: string; value: string }>;
    templates: {
        homepage: string;
        layout: string;
    }
}

interface MyMetaData {
    title: string;
    createDate: string;
    updateDate?: string;
    topics?: string | string[];
    prev?: string;
    next?: string;
}

interface AssetInfo {
    html: string;
    metadata: MyMetaData;
    category: string;
    path: ParsedPath;
}


interface MyHooks {
    beforeEmit: AsyncSeriesHook<BlogEngine>;
    afterEmit: AsyncSeriesHook<BlogEngine>;
}

class BlogEngine {
    config: BlogConfig = {} as BlogConfig;
    #converter: showdown.Converter = null as unknown as showdown.Converter;
    #articlePaths: ParsedPath[] = [];
    #articleCount: number = 0;
    #count: number = 0;
    assets: AssetInfo[] = [];
    plugins: Plugin[] = []
    hooks: MyHooks = {
        beforeEmit: new AsyncSeriesHook(['cxt']),
        afterEmit: new AsyncSeriesHook(['cxt']),
    };
    static CONFIG_PATH = resolve(__dirname, '../config.js')
    static MD_EXT = '.md'
    static HTML_EXT = '.html'

    constructor() {
        this.#init()
    }


    use(plugin: Plugin) {
        if (this.plugins.find(v => v.name === plugin.name)) {
            return
        }

        this.plugins.push(plugin)
    }

    #callPluginHookBeforeEmit() {
        return this.hooks.beforeEmit.promise(this)

    }

    #callPluginHookAfterEmit() {
        return this.hooks.afterEmit.promise(this)
    }

    async #watch(type: 'change' | 'rename', filePath: string) {
        const _filePath = resolve(this.config.entry, filePath)
        if (type === 'change') {
            // 更新文章 filename
            for (let index = 0; index < this.assets.length; index++) {
                const { path } = this.assets[index];
                if (_filePath === format(path)) {
                    console.log(_filePath);
                    this.assets[index] = await this.#convert2HTMLInfo(parse(format(path)))
                    await this.#emitWatch(this.assets[index])
                }
            }
        }

        if (type === 'rename') {
            if (!existsSync(_filePath)) {
                // 删除
                const index = this.assets.findIndex(v => format(v.path) === _filePath)
                if (index > -1) {
                    this.assets.splice(index, 1)
                    await this.#emit()
                }
            } else {
                // 新建
                const asset = await this.#convert2HTMLInfo(parse(_filePath))
                this.assets.push(asset)
                await this.#emitWatch(asset)
            }
        }
    }

    async start(): Promise<BlogEngine> {
        if (process.env.NODE_ENV === 'preview') {
            watch(this.config.entry, { recursive: true }, this.#watch.bind(this))
        }
        return new Promise(async (resolve) => {
            console.log('start');
            await this.#readArticlePaths(this.config.entry);
            await this.#convertAllArticles()
            await this.#applyPlugins()
            await this.#emit()
            resolve(this)
        });
    }

    async #emit() {
        await this.#callPluginHookBeforeEmit()
        await this.#emitAssets()
        await this.#callPluginHookAfterEmit()
    }

    async #emitWatch(asset: AssetInfo) {
        await this.#callPluginHookBeforeEmit()
        await this.#emitFile(asset)
        await this.#callPluginHookAfterEmit()
    }

    async #applyPlugins() {
        for (const plugin of this.plugins) {
            await plugin.apply(this)
        }
    }

    async #emitAssets() {
        console.log(this.assets.length);
        for (const asset of this.assets) {
            await this.#emitFile(asset)
            this.#count++;
        }
    }

    async #emitFile(asset: AssetInfo) {
        const { html, path, category } = asset
        const blogDir = `${this.config.output}/${category}/`
        if (!existsSync(blogDir)) {
            ensureDirSync(blogDir)
        }
        await writeFile(`${blogDir}${path.base.replace(BlogEngine.MD_EXT, BlogEngine.HTML_EXT)}`, html)
    }

    async #init() {
        this.#loadConfig();
        this.#initConverter();
    }

    async #convertAllArticles() {
        for (const articltPath of this.#articlePaths) {
            const asset = await this.#convert2HTMLInfo(articltPath)
            this.assets.push(asset)
        }
    }


    async #convert2HTMLInfo(path: ParsedPath) {
        const content = await readFile(`${path.dir}/${path.base}`);
        const html = this.#converter.makeHtml(content.toString());
        const metadata = (this.#converter.getMetadata() as unknown as MyMetaData);
        const arr = path.dir.split('/')
        const category = arr.pop() as string;
        if (metadata.topics && typeof metadata.topics === 'string') {
            metadata.topics = metadata.topics.split(' ')
        }
        return { html, metadata, category, path } as AssetInfo;
    }

    #loadConfig() {
        this.config = require(BlogEngine.CONFIG_PATH) as BlogConfig;
    }

    #initConverter() {
        const defaultConverterOpts: showdown.ConverterOptions = {
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
            metadata: true
        }
        this.#converter = new showdown.Converter(defaultConverterOpts)
    }

    async #readArticlePaths(entry: string) {
        if (entry) {
            if (existsSync(entry)) {
                const paths = await readdir(entry);
                for (const articlePath of paths) {
                    const ap = resolve(entry, articlePath)
                    const _ap = parse(ap)
                    if (statSync(ap).isDirectory()) {
                        await this.#readArticlePaths(ap);
                    } else if (_ap.ext === BlogEngine.MD_EXT) {
                        this.#articleCount++;
                        this.#articlePaths.push(_ap);
                    }
                }
            }
        }
    }


}


const engine = new BlogEngine()

abstract class Plugin {
    name: string | undefined;
    apply!: (cxt: BlogEngine) => unknown;
}

class LayoutPlugin implements Plugin {
    name = "LayoutPlugin"

    async apply(cxt: BlogEngine) {
        cxt.hooks.beforeEmit.tapPromise(this.name, (cxt) => {
            return new Promise(async (resolveP,) => {
                const { templates: { layout }, output } = cxt.config;
                const stylesheet = resolve(
                    output,
                    "/assets/styles",
                    "default.css"
                );
                let count = 0
                for (const asset of cxt.assets) {
                    const templateContent = (await readFile(layout)).toString()
                    const template = handlebars.compile(templateContent)
                    const content = new handlebars.SafeString(asset.html)
                    asset.html = template({
                        ...asset.metadata,
                        stylesheet,
                        content
                    })
                    count += 1
                    if (count === cxt.assets.length) {
                        console.log('layout done');
                        resolveP()
                    }
                }
            });
        })

    }
}

class MinifyHTMLPlugin implements Plugin {
    name = 'MinifyHTMLPlugin'

    async apply(cxt: BlogEngine) {
        cxt.hooks.beforeEmit.tapPromise(this.name, (cxt) => {
            return new Promise(async (resolve) => {
                let count = 0
                for (const asset of cxt.assets) {

                    asset.html = await minify(asset.html, minifyConfig)
                    count += 1
                    if (count === cxt.assets.length) {
                        console.log('minified done');
                        resolve()
                    }
                }
            });
        })
    }
}

class ClearPlugin implements Plugin {
    name = "ClearPlugin"

    apply(cxt: BlogEngine) {
        cxt.hooks.beforeEmit.tapPromise(this.name, (cxt) => {
            return new Promise(async (resolve) => {
                if (process.env.NODE_ENV !== 'preview') {
                    const execPromise = promisify(exec)
                    await execPromise(`rm -rf ${cxt.config.output}/*`)
                    console.log('clear done');
                }
                resolve()
            });
        })
    }

}

class HomePagePlugin implements Plugin {
    name = 'HomePagePlugin'
    apply(cxt: BlogEngine) {
        cxt.hooks.afterEmit.tapPromise(this.name, (cxt) => {
            return new Promise(async (resolveP) => {
                const { config, assets } = cxt;
                const { name: title, socialMedias, author, output, templates: { homepage } } = config;
                const templateContent = (await readFile(homepage)).toString()
                const template = handlebars.compile(templateContent)
                const stylesheet = resolve(
                    output,
                    "/assets/styles",
                    "default.css"
                );

                const categoryMap = {} as { [key: string]: string[] }

                assets.forEach(asset => {
                    if (!categoryMap[asset.category]) {
                        categoryMap[asset.category] = []
                    }
                    categoryMap[asset.category].push(asset.path.name)
                })
                const htmlContent = template({
                    title,
                    socialMedias,
                    author,
                    stylesheet,
                    categoryMap,
                    copyright: `@Copyright ${dayjs().year()} | ${author}`
                })
                const minified = await minify(htmlContent, minifyConfig)
                await writeFile(`${output}/index.html`, minified);
                console.log('home done');
                resolveP()
            });
        })
    }
}


engine.use(new LayoutPlugin())
engine.use(new MinifyHTMLPlugin())
engine.use(new ClearPlugin())
engine.use(new HomePagePlugin())
engine.start().then(async (cxt) => {
    await execPromise(`cp -R ${resolve(__dirname, "../assets")} ${cxt.config.output}`);
    console.log('done');
})
