const fs = require('fs')
const path = require('path')

const srcDir = path.join(__dirname, '..', 'data', 'csse_covid_19_data', 'csse_covid_19_time_series')
const outFile = path.join(__dirname, '..', 'build', 'data.json')

const confirmedCSV =
  fs.readFileSync(path.join(srcDir, 'time_series_19-covid-Confirmed.csv'), 'utf8').trim().split('\n')
const deathsCSV =
  fs.readFileSync(path.join(srcDir, 'time_series_19-covid-Deaths.csv'), 'utf8').trim().split('\n')
const recoveredCSV =
  fs.readFileSync(path.join(srcDir, 'time_series_19-covid-Recovered.csv'), 'utf8').trim().split('\n')

function parseHeader(line) {
  return line.split(',').map(field => {
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

const getKey = item => [item['Country/Region'], item['Province/State']].filter(key => key).join('_')

function parseCSV(lines) {
  const header = parseHeader(lines[0])

  return lines.slice(1).map(row => {
    const values = row.split(',').slice(0, header.length)

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
      cDates[type] = dates[date]

      const total = allData.total[date] = allData.total[date] || {
        date,
        confirmed: 0,
        deaths: 0,
        recovered: 0,
      }
      total[type] += dates[date]
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

fs.writeFileSync(outFile, "export const data" + JSON.stringify(allData))
