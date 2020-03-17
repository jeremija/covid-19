const fs = require('fs')
const path = require('path')
const papaparse = require('papaparse')

const srcDir = path.join(__dirname, '..', 'data', 'csse_covid_19_data', 'csse_covid_19_time_series')
const outDir = path.join(__dirname, '..', 'build', 'data')
fs.mkdirSync(outDir, {recursive: true})
const outFile = path.join(outDir, 'index.js')

const confirmedCSV =
  fs.readFileSync(path.join(srcDir, 'time_series_19-covid-Confirmed.csv'), 'utf8')
const deathsCSV =
  fs.readFileSync(path.join(srcDir, 'time_series_19-covid-Deaths.csv'), 'utf8')
const recoveredCSV =
  fs.readFileSync(path.join(srcDir, 'time_series_19-covid-Recovered.csv'), 'utf8')

function parseHeader(line) {
  return line.map(field => {
    const date = new Date(field)
    if (isNaN(date.getTime())) {
      return {name: field, type: 'string'}
    }
    return {
      name: date.toISOString().substring(0, 10),
      type: 'date',
    }
  })
}

const getKey = item => [item['Country/Region'], item['Province/State']].filter(key => key).join(', ')
// const getKey = item => item['Country/Region']

function parseCSV(csv) {
  const lines = papaparse.parse(csv).data
  const header = parseHeader(lines[0])

  return lines.slice(1).map((row, i) => {
    let values = row.map(value => value.trim())

    return values.reduce((obj, value, index) => {
      const field = header[index]
      if (field.type === 'date') {
        obj.dates[field.name] = parseInt(value)
      } else {
        obj[field.name] = value
      }
      return obj
    }, {
      dates: {},
    })
  })
}

function mergeAllData(type, parsed, allData) {
  parsed.forEach(item => {
    const key = getKey(item)
    const {dates, ...newItem} = item
    const regions = allData.regions[key] = allData.regions[key] || newItem
    Object.keys(dates).forEach(date => {
      regions.dates = regions.dates || {}
      const cDates = regions.dates[date] = regions.dates[date] || {
        date,
      }
      const count = dates[date]
      if (count < 0) {
        console.warn('count is negative: "%s" date: %s, type: %s, count: %s',
          key, date, type, count)
      }
      cDates[type] = cDates[type] || 0
      cDates[type] += count

      const total = allData.total[date] = allData.total[date] || {
        date,
        confirmed: 0,
        deaths: 0,
        recovered: 0,
      }
      total[type] += count
    })
  })
  return allData
}

const confirmed = parseCSV(confirmedCSV)
const deaths = parseCSV(deathsCSV)
const recovered = parseCSV(recoveredCSV)

const allData = {
  date: new Date().toISOString(),
  total: {},
  regions: {},
}
mergeAllData('confirmed', confirmed, allData)
mergeAllData('deaths', deaths, allData)
mergeAllData('recovered', recovered, allData)

fs.writeFileSync(outFile, "module.exports.data = " + JSON.stringify(allData, null, "  "))

const types = fs.readFileSync(path.join(__dirname, '..', 'types', 'data.d.ts'), 'utf8')
fs.writeFileSync(path.join(__dirname, '..', 'build', 'data', 'index.d.ts'), types)
