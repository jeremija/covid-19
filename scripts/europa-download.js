// Downloads data from Europa's ECDC website
const fs = require('fs')
const https = require('https')
const path = require('path')

async function download(date, dest) {
  date = date.toISOString().substring(0, 10)
  const url = `https://www.ecdc.europa.eu/sites/default/files/documents/COVID-19-geographic-disbtribution-worldwide-${date}.xlsx`
  console.error(url)
  return new Promise((resolve, reject) => {
    var request = https.get(url, function(response) {
      if (response.statusCode !== 200) {
        reject(new Error('Status ' + response.statusMessage))
      }
      var file = fs.createWriteStream(dest)
      response.pipe(file)
      file.on('error', function(err) {
        file.close()
        rejec(err)
      })
      file.on('finish', function() {
        file.close()
        resolve()
      })
    })
  })
}

async function downloadTodayOrYesterday() {
  const date = new Date()
  const dest = 'build/europa.xlsx'
  try {
    await download(date, dest)
  } catch (err) {
    console.error(err)
    console.error('Trying yesterday')
    date.setDate(date.getDate() - 1)
    await download(date, dest)
  }
}

downloadTodayOrYesterday()
.then(() => process.exit())
.catch(err => {
  console.error(err)
  process.exit(1)
})
