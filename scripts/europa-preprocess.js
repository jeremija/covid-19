const fs = require('fs')
const path = require('path')
const xlsx = require('xlsx')
const papaparse = require('papaparse')

const srcDir = path.join(__dirname, '..', 'build')
const outDir = path.join(__dirname, '..', 'build', 'data')
fs.mkdirSync(outDir, {recursive: true})
const outFile = path.join(outDir, 'index.js')

const europaXLSX = fs.readFileSync(path.join(srcDir, 'europa.xlsx'))
const result = xlsx.read(europaXLSX)

const sheet = result.Sheets[result.SheetNames[0]]

let lastRowIndex = -1
const rows = []
let row = []
Object.keys(sheet).filter(k => !k.startsWith('!')).forEach(key => {
  const colIndex = key[0]
  const rowIndex = parseInt(key.substring(1))
  const value = sheet[key].v

  if (rowIndex !== lastRowIndex) {
    lastRowIndex = rowIndex
    row = []
    rows.push(row)
  }

  row.push(value)
})

const headers = rows.slice(0, 1)[0]
const sorted = rows.slice(1)
.filter(row => row.length !== 0)
.map(row => {
  return row.reduce((obj, value, index) => {
    obj[headers[index]] = value
    return obj
  }, {})
})
.map(row => {
  const dateString = row.Year + '-' + row.Month + '-' + row.Day + 'Z'
  const date = new Date(dateString).toISOString().substring(0, 10)
  return {
    'Country/Region': row['Countries and territories'],
    'Province/State': '',
    date,
    confirmed: row.Cases,
    deaths: row.Deaths,
    recovered: 0,
  }
})
.sort((row1, row2) =>
  (row1['Country/Region'] + '_' + row1.date) <
  (row2['Country/Region'] + '_' + row2.date) ? -1 : 1
)

const allDates = sorted.reduce((set, item) => {
  set.add(item.date)
  return set
}, new Set())
const maxDate = Array.from(allDates).sort()[allDates.size - 1]

function fillMissingDates(array, lastRow, currentDateString) {
  const lastDate = new Date(lastRow.date)
  lastDate.setDate(lastDate.getDate() + 1)
  while (lastDate.toISOString().substring(0, 10) !== currentDateString) {
    array.push({
      ...lastRow,
      date: lastDate.toISOString().substring(0, 10),
    })
    lastDate.setDate(lastDate.getDate() + 1)
  }
}

const regions = sorted
.reduce((newArray, row, index, array) => {
  const lastItem = newArray[newArray.length - 1]
  if (lastItem && lastItem['Country/Region'] === row['Country/Region']) {
    fillMissingDates(newArray, lastItem, row.date)
    // const lastDate = new Date(lastItem.date)
    // lastDate.setDate(lastDate.getDate() + 1)
    // while (lastDate.toISOString().substring(0, 10) !== row.date) {
    //   newArray.push({
    //     ...row,
    //     date: lastDate.toISOString().substring(0, 10),
    //   })
    //   lastDate.setDate(lastDate.getDate() + 1)
    // }
  }

  newArray.push(row)

  const isLastItem = index === array.length - 1 || array[index + 1]['Country/Region'] !== row['Country/Region']
  if (isLastItem && row.date !== maxDate) {
    d = new Date(maxDate)
    d.setDate(d.getDate() + 1)
    fillMissingDates(newArray, row, d.toISOString().substring(0, 10))
  }

  return newArray
}, [])
.reduce((regions, row) => {
  const key = row['Country/Region']
  const region = regions[key] = regions[key] || {
    'Country/Region': row['Country/Region'],
    'Province/State': row['Province/State'],
    Lat: '0',
    Long: '0',
    dates: {},
  }

  region.dates[row.date] = {
    date: row.date,
    confirmed: row.confirmed,
    deaths: row.deaths,
    recovered: row.recovered,
  }

  return regions
}, {})

const total = Object.keys(regions).reduce((obj, regionKey) => {
  const region = regions[regionKey]
  const dates = Object.keys(region.dates)

  dates.forEach(date => {
    regionDayStat = region.dates[date]
    const dayStat = obj[date] = obj[date] || {
      date,
      confirmed: 0,
      deaths: 0,
      recovered: 0,
    }
    dayStat.confirmed += regionDayStat.confirmed
    dayStat.deaths += regionDayStat.deaths
    dayStat.confirmed += regionDayStat.confirmed
  })

  return obj
}, {})

const allData = {
  date: new Date().toISOString(),
  regions,
  total,
}

fs.writeFileSync(outFile, "module.exports.data = " + JSON.stringify(allData, null, "  "))
const types = fs.readFileSync(path.join(__dirname, '..', 'types', 'data.d.ts'), 'utf8')
fs.writeFileSync(path.join(__dirname, '..', 'build', 'data', 'index.d.ts'), types)
