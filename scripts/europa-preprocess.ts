import * as fs from 'fs'
import * as path from 'path'
import { Data, RegionMap, Region, DayStat } from '../types/data'
const xlsx = require('xlsx')

const srcDir = path.join(__dirname, '..', 'build')
const outDir = path.join(__dirname, '..', 'build', 'data')
fs.mkdirSync(outDir, {recursive: true})
const outFile = path.join(outDir, 'index.js')

const europaXLSX = fs.readFileSync(path.join(srcDir, 'europa.xlsx'))
const result = xlsx.read(europaXLSX)

const sheet = result.Sheets[result.SheetNames[0]]

let lastRowIndex = -1
const rows: Array<Array<string|number>> = []
let row: Array<string|number> = []
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


const headers = rows.slice(0, 1)[0] as string[]
const sorted = rows.slice(1)
.filter(row => row.length !== 0)
.map(row => {
  return row.reduce((obj, value, index) => {
    obj[headers[index]] = value
    return obj
  }, {} as Record<string, string | number>)
})
.map(row => {
  const dateString = row.Year + '-' + row.Month + '-' + row.Day + 'Z'
  const date = new Date(dateString).toISOString().substring(0, 10)
  return {
    'Country/Region': row['Countries and territories'] as string,
    'Province/State': '',
    date,
    confirmed: row.Cases as number,
    deaths: row.Deaths as number,
    recovered: 0,
  }
})
.sort((row1, row2) =>
  (row1['Country/Region'] + '_' + row1.date) <
  (row2['Country/Region'] + '_' + row2.date) ? -1 : 1
)

let lastRegion = ''
let count: DayStat = {
  date: '',
  confirmed: 0,
  deaths: 0,
  recovered: 0,
}
const regions: Record<string, Region> = {}
sorted.forEach(row => {
  const currentRegion = row['Country/Region']
  if (lastRegion !== currentRegion) {
    count = {
      date: '',
      confirmed: 0,
      deaths: 0,
      recovered: 0,
    }
  }
  count.confirmed += row.confirmed
  count.recovered += row.recovered
  count.deaths += row.deaths
  const r = regions[currentRegion] = regions[currentRegion] || {
    'Country/Region': currentRegion,
    'Province/State': '',
    dates: [],
    Lat: '0',
    Long: '0',
  }
  r.dates.push({
    ...count,
    date: row.date,
  })
  lastRegion = row['Country/Region']
})

const total = Object.keys(regions).reduce((obj, regionKey) => {
  const region = regions[regionKey]
  const dates = Object.keys(region.dates)

  region.dates.forEach(regionDayStat => {
    const date = regionDayStat.date
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
}, {} as Record<string, DayStat>)

const allData: Data = {
  date: new Date().toISOString(),
  source: {
    name: 'ECDC\'s COVID-19 dataset',
    link: 'https://www.ecdc.europa.eu/en/publications-data/download-todays-data-geographic-distribution-covid-19-cases-worldwide',
  },
  regions,
  total: Object.keys(total).map(key => total[key]),
}

fs.writeFileSync(outFile, "module.exports.data = " + JSON.stringify(allData, null, "  "))
const types = fs.readFileSync(path.join(__dirname, '..', 'types', 'data.d.ts'), 'utf8')
fs.writeFileSync(path.join(__dirname, '..', 'build', 'data', 'index.d.ts'), types)
