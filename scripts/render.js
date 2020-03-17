const ejs = require('ejs')
const fs = require('fs')
const path = require('path')
const data = require('../data')

const outDir = path.join(__dirname, '..', 'build', 'web')
fs.mkdirSync(outDir, {recursive: true})

const files = process.argv.slice(2)

files.forEach(file => {
  const source = fs.readFileSync(file, 'utf8')
  const basename = path.basename(file)
  console.log('render', basename)
  const outFile = path.join(outDir, basename)
  const t = ejs.compile(source, {async: false})
  const result = t(data[basename])
  fs.writeFileSync(outFile, result)
})
