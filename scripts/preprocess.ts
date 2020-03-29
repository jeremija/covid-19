import * as fs from 'fs'
import * as path from 'path'
import * as papaparse from 'papaparse'
import { DayStat, Region, RegionMap, Data, DataMap, StatType } from '../types/data'

const srcDir = path.join(__dirname, '..', 'data', 'csse_covid_19_data', 'csse_covid_19_time_series')
const outDir = path.join(__dirname, '..', 'build', 'web')
fs.mkdirSync(outDir, {recursive: true})
const outFile = path.join(outDir, 'csse.json')

const confirmedCSV =
  fs.readFileSync(path.join(srcDir, 'time_series_covid19_confirmed_global.csv'), 'utf8').trim()
const deathsCSV =
  fs.readFileSync(path.join(srcDir, 'time_series_covid19_deaths_global.csv'), 'utf8').trim()
const recoveredCSV =
  fs.readFileSync(path.join(srcDir, 'time_series_covid19_recovered_global.csv'), 'utf8').trim()

function parseHeader(line: string[]) {
  return line.map(field => {
    const date = new Date(field + 'Z')
    if (isNaN(date.getTime())) {
      return {name: field, type: 'string'}
    }
    return {
      name: date.toISOString().substring(0, 10),
      type: 'date',
    }
  })
}

const getKey = (item: CSVRecord)  => [item['Country/Region'], item['Province/State']].filter(key => key).join(', ')
// const getKey = item => item['Country/Region']

interface CSVRecord {
  'Country/Region': string
  'Province/State': string
  Lat: string
  Long: string
  dates: Record<string, number>
}

function parseCSV(csv: string) {
  const lines = papaparse.parse(csv).data as string[][]
  const header = parseHeader(lines[0])

  return lines.slice(1).map((row, i) => {
    let values = row.map(value => value.trim())

    return values.reduce((obj, value, index) => {
      const field = header[index]
      if (field.type === 'date') {
        obj.dates[field.name as StatType] = parseInt(value)
      } else {
        type k = Exclude<keyof typeof obj, 'dates'>
        obj[field.name as k] = value
      }
      return obj
    }, {
      'Country/Region': '',
      'Province/State': '',
      Lat: '0',
      Long: '0',
      dates: {},
    } as CSVRecord)
  })
}

function mergeAllData(type: StatType, parsed: CSVRecord[], allData: DataMap) {
  parsed.forEach(item => {
    const key = getKey(item)
    const {dates, ...newItem} = item
    const regions = allData.regions[key] = allData.regions[key] || {
      ...newItem,
      dates: {},
    }
    Object.keys(dates).forEach(date => {
      regions.dates = regions.dates || {}
      const cDates = regions.dates[date] = regions.dates[date] || {
        date,
        recovered: 0,
        confirmed: 0,
        deaths: 0,
      }
      const count = dates[date]
      if (count < 0) {
        console.warn('count is negative: "%s" date: %s, type: %s, count: %s',
          key, date, type, count)
      }
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

function toArrays(allData: DataMap): Data {
  const data: Data = {
    date: allData.date,
    total: [],
    regions: {},
    source: {
      name: 'John Hopkins\' COVID-19 dataset',
      link: 'https://github.com/CSSEGISandData/COVID-19',
    }
  }

  data.total = Object.keys(allData.total).map(key => {
    return allData.total[key]
  })

  Object.keys(allData.regions).forEach(regionKey => {
    const region = allData.regions[regionKey]
    data.regions[regionKey] = {
      ...region,
      dates: Object.keys(region.dates).map(key => region.dates[key]),
    }
  })

  return data
}

const confirmed = parseCSV(confirmedCSV)
const deaths = parseCSV(deathsCSV)
const recovered = parseCSV(recoveredCSV)

const allData: DataMap = {
  date: new Date().toISOString(),
  total: {},
  regions: {},
}
mergeAllData('confirmed', confirmed, allData)
mergeAllData('deaths', deaths, allData)
mergeAllData('recovered', recovered, allData)

fs.writeFileSync(outFile, JSON.stringify(toArrays(allData)))
