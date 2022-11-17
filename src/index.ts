import { readFile, readdir, writeFile } from "node:fs/promises"
import { existsSync, statSync } from "node:fs"
import { resolve, parse, ParsedPath } from "node:path"
import { execSync } from "node:child_process"
import Tapable, { SyncHook } from 'tapable';
import showdown from 'showdown';
import { JSDOM } from 'jsdom';
import { minify, Options } from 'html-minifier-terser'
import handlebars from 'handlebars'




interface BlogConfig {
    entry: string;
    output: string;
    showdownConfig?: showdown.ConverterOptions;
    templates: {
        homepage: string;
        layout: string;
    }
}

interface AssetInfo {
    html: string;
    metadata: showdown.Metadata;
    category: string;
    path: ParsedPath;
}



class BlogEngine {
    config: BlogConfig = {} as BlogConfig;
    #converter: showdown.Converter = null as unknown as showdown.Converter;
    #articlePaths: ParsedPath[] = [];
    #articleCount: number = 0;
    #allFilesCountInEntry: number = 0;
    assets: AssetInfo[] = [];
    plugins: Plugin[] = []

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

    async start(): Promise<string> {
        return new Promise(async (resolve) => {
            await this.#readArticlePaths(this.config.entry);
            await this.#convertAllArticles()
            await this.#beforeEmitAssets()
            await this.#emitAssets()
            resolve('done')
        });
    }

    async #beforeEmitAssets() {
        for (const plugin of this.plugins) {
            await plugin.apply(this)
        }
    }

    async #emitAssets() {
        for (const asset of this.assets) {
            const { html, path, category } = asset
            await writeFile(`${this.config.output}/${category}/${path.base.replace(BlogEngine.MD_EXT, BlogEngine.HTML_EXT)}`, html)
        }
    }

    async #init() {
        this.#loadConfig();
        this.#initConverter();
        this.#allFilesCountInEntry = Number(execSync(`cd ${this.config.entry} && ls -lR|grep "^-"|wc -l`).toString())
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
        const metadata = this.#converter.getMetadata();
        const arr = path.dir.split('/')
        const category = arr.pop() as string;
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
        }
        this.#converter = new showdown.Converter(this.config?.showdownConfig || defaultConverterOpts)
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
    apply!: ((cxt: BlogEngine) => Promise<BlogEngine> | BlogEngine);
}

class JSDOMPlugin implements Plugin {
    name = 'JSDOMPlugin'

    apply(cxt: BlogEngine) {
        console.log(cxt.assets);
        // const root = new JSDOM(html);
        // const header = root.window._document.querySelector("h1");
        // header.setAttribute(
        //     "data-time",
        //     "更新时间：<%= updateDate %> | 创建时间： <%= createDate %>"
        // );

        // return root.serialize();

        return cxt
    }
}

class LayoutPlugin implements Plugin {
    name = "LayoutPlugin"

    async apply(cxt: BlogEngine) {
        const { templates: { layout }, output } = cxt.config;
        const stylesheet = resolve(
            output,
            "/assets/styles",
            "default.css"
        );
        for (const asset of cxt.assets) {
            const templateContent = (await readFile(layout)).toString()
            const template = handlebars.compile(templateContent)
            const content = new handlebars.SafeString(asset.html)
            asset.html = template({
                ...asset.metadata,
                stylesheet,
                content
            })
        }
        return cxt
    }
}

class MinifyHTMLPlugin implements Plugin {
    name = 'MinifyHTMLPlugin'

    async apply(cxt: BlogEngine) {
        for (const asset of cxt.assets) {
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
            asset.html = await minify(asset.html, minifyConfig)
        }
        return cxt
    }
}


engine.use(new LayoutPlugin())
engine.use(new MinifyHTMLPlugin())

engine.start().then((res) => {
    console.log(res);
})

export default engine
