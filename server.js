import { createReadStream } from 'node:fs'
import { lstat, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { Readable } from 'node:stream'

const PORT = 8000

const MIME_TYPES = {
  default: 'application/octet-stream',
  html: 'text/html; charset=UTF-8',
  js: 'application/javascript; charset=UTF-8',
  json: 'application/json',
  css: 'text/css',
  png: 'image/png',
  jpg: 'image/jpg',
  gif: 'image/gif',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
}

const STATIC_PATH = join(process.cwd(), './build')

function folderIndex(folder) {
  return new Readable({
    async read() {
      const files = []
      const folders = []
      const rel = folder.slice(STATIC_PATH.length)
      const items = await readdir(folder, { withFileTypes: true })
      for (const item of items) {
        if (item.isDirectory()) folders.push(item.name + '/')
        else files.push(item.name)
      }
      console.log({ folders, files, rel })
      const list = folders
        .concat(files)
        .map((item) => `<li><a href="${rel}/${item}">${item}</a></li>`)
        .join('\n')
      const goUp = `<li><a href="${join(rel, '..')}">⬆</a></li>`
      this.push(`<h2>Directory index:</h2><ul>${goUp}${list}</ul>`)
      this.push(null)
    },
  })
}

async function prepareFile(url) {
  const name = url === '/' ? 'index.html' : url
  const filePath = join(STATIC_PATH, name)
  const pathTraversal = !filePath.startsWith(STATIC_PATH)
  const stat = await lstat(filePath).catch((e) =>
    console.log('lstat error', e.message)
  )
  const exists = !!stat
  const isDirectory = stat && stat.isDirectory()
  const found = !pathTraversal && exists
  const streamPath = found ? filePath : join(STATIC_PATH, '/404.html')
  const ext = extname(streamPath).slice(1).toLowerCase()
  const factory = isDirectory ? folderIndex : createReadStream
  const stream = factory(streamPath)

  return { found, ext: isDirectory ? 'html' : ext, stream }
}

createServer(async (req, res) => {
  const file = await prepareFile(req.url)
  const statusCode = file.found ? 200 : 404
  const mimeType = MIME_TYPES[file.ext] ?? MIME_TYPES.default
  res.writeHead(statusCode, { 'Content-Type': mimeType })
  file.stream.pipe(res)
  console.log(`${req.method} ${req.url} ${statusCode}`)
}).listen(PORT)

console.log(`Server running at http://localhost:${PORT}/`)
