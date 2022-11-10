const showdown = require("showdown")
const fs = require("fs-extra")
const Path = require("path")
const Util = require("util")
const execSync = require("child_process").execSync
const config = require("../config.json")
const convert = new showdown.Converter()

const readFileAsync = Util.promisify(fs.readFile)

const resolvePath = (path, mid = '../') => Path.resolve(__dirname, mid, path)
const isDir = path => fs.statSync(path).isDirectory()


async function doConvert() {
    const entry = resolvePath(config.entry)
    const output = resolvePath(config.output)
    if (!fs.existsSync(output)) {
        fs.ensureDirSync(output)
    } else {
        execSync(`rm -rf ${output}/*`)
    }
    async function read2Cov(entry) {
        const _paths = await fs.readdir(entry)
        for (const _path of _paths) {
            const tempPath = Path.resolve(entry, _path)
            if (!isDir(tempPath)) {
                const res = await readFileAsync(tempPath)
                const htmlTxt = convert.makeHtml(res.toString())
                const articlePath = Path.parse(tempPath.replace('md', 'html'))
                articlePath.dir = articlePath.dir.replace(config.entry, config.output)
                if (!fs.existsSync(articlePath.dir)) {
                    fs.ensureDirSync(articlePath.dir)
                }
                await fs.writeFile(Path.format(articlePath), htmlTxt)
            } else {
                read2Cov(tempPath)
            }
        }
    }

    await read2Cov(entry)
}

doConvert()

