import { data as _data, Data, DataMap, DayStat, Region, StatType } from '../build/data'
import { Chart } from 'chart.js'
import palette from 'coloring-palette'

const app = document.getElementById('app')!

function getColors(color: string): string[] {
  const p = palette(color, 'hex');
  const colors = (Object.keys(p) as Array<keyof typeof p>)
  .filter(k => !isNaN(k as unknown as number))
  .slice(0, 5)
  .reverse()
  .map(k => p[k].color as string)
  return colors
}

const colors = {
  primary:   '#0d6efd',
  secondary: '#6c757d',
  success:   '#28a745',
  info:      '#17a2b8',
  warning:   '#ffc107',
  danger:    '#dc3545',
  dark:      '#333333',
}

const palettes = {
  primary:   getColors(colors.primary),
  secondary: getColors(colors.secondary),
  success:   getColors(colors.success),
  info:      getColors(colors.info),
  warning:   getColors(colors.warning),
  danger:    getColors(colors.danger),
  dark:      getColors(colors.dark),
}

const colorByType = {
  confirmed: colors.danger,
  deaths: colors.dark,
  recovered: colors.primary,
}

const paletteByType = {
  confirmed: palettes.danger,
  deaths: palettes.dark,
  recovered: palettes.primary,
}

function CreateChart(data: Data) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const labels = Object.keys(data.total)

  const datasets = [] as Chart.ChartDataSets[]

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets,
    },
    options: {
      // tooltips: {
      //   mode: 'x',
      // },
    },
  })

  return {canvas, chart}
}

const types: Array<StatType> = [
  'confirmed', 'recovered', 'deaths',
]

function calculateCummulativeTimeSeries(data: Record<string, Region>) {
  const dates = Object.keys(data).reduce((obj, key) => {
    const region = data[key]
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
      dayStat.recovered += regionDayStat.recovered
    })
    return obj
  }, {} as Record<string, DayStat>)

  console.log('dates', dates)

  const labels = Object.keys(dates)
  const datasets = types.map(type => {
    return {
      label: type,
      fill: false,
      backgroundColor: colorByType[type],
      borderColor: colorByType[type],
      data: labels.map(key => dates[key][type]),
    }
  })

  return { datasets, labels }
}

function calculateDistinctTimeSeries(data: Record<string, Region>) {
  const datasets: Array<Chart.ChartDataSets & { statType: StatType }> = []

  const labelKeys: Record<string, number> = {}

  Object.keys(data).forEach(key => {
    const region = data[key]
    region.dates.forEach(dayStat => labelKeys[dayStat.date] = -1)
  })

  const labels = Object.keys(labelKeys).sort()
  labels.forEach((date, index) => {
    labelKeys[date] = index
  })

  Object.keys(data).forEach((key, index) => {
    const region = data[key]

    let offset = Infinity
    types.forEach(type => {
      const data = region.dates.reduce((arr, dayStat) => {
        const expectedIndex = labelKeys[dayStat.date]
        while (arr.length < expectedIndex) {
          console.log('filling missing value for', key, dayStat.date, type)
          // fill missing values
          arr.push(arr[arr.length - 1] || 0)
        }
        arr.push(dayStat[type])
        return arr
      }, [] as number[])

      const colors = paletteByType[type]
      const color = colors[index % colors.length]

      datasets.push({
        label: `${key} (${type})`,
        statType: type,
        fill: false,
        backgroundColor: color,
        borderColor: color,
        data,
      })
    })
  })

  return { datasets, labels }
}

function calculatePatientZeroTimeSeries(data: Record<string, Region>) {
  let { datasets, labels } = calculateDistinctTimeSeries(data)

  const maxSize = datasets
  .filter(d => d.statType === 'confirmed')
  .reduce((maxSize, d) => {
    const data = d.data as number[]
    const patientZeroIndex = data.findIndex(value => value > 0)
    d.data = data.slice(patientZeroIndex)
    return Math.min(maxSize, d.data.length)
  }, Infinity)

  datasets.forEach(d => d.data = d.data!.slice(0, maxSize))
  labels = labels.slice(0, maxSize).map((_, i) => String(i + 1))

  return { datasets, labels }
}

function calculateTotal(
  data: Record<string, Region>,
  lastDate: string,
  secondToLastDate: string,
) {
  return Object.keys(data).reduce((obj, key) => {
    const dayStat = data[key].dates

    types.forEach(type => {
      obj.last[type] += dayStat.length > 0 ? dayStat[dayStat.length - 1][type] : 0
      obj.secondToLast[type] += dayStat.length > 1 ? dayStat[dayStat.length - 2][type] : 0
    })
    return obj
  }, {
    last: {
      confirmed: 0,
      recovered: 0,
      deaths: 0,
    },
    secondToLast: {
      confirmed: 0,
      recovered: 0,
      deaths: 0,
    }
  })
}

function mergeByCountries(data: Data): Data {
  const regions: DataMap['regions'] = {}

  Object.keys(data.regions).forEach(key => {
    const region = data.regions[key]
    const country = region['Country/Region']
    const resultRegion = regions[country] = regions[country] || {
      'Country/Region': country,
      'Province/State': '',
      dates: {},
      Lat: 0,
      Lng: 0,
    }
    region.dates.forEach(dayStat => {
      const date = dayStat.date
      const resultDayStat = resultRegion.dates[date] = resultRegion.dates[date] || {
        confirmed: 0,
        date: date,
        deaths: 0,
        recovered: 0,
      }
      resultDayStat.confirmed += dayStat.confirmed
      resultDayStat.deaths += dayStat.deaths
      resultDayStat.recovered += dayStat.recovered
    })
  })

  const regionsWithArray = Object.keys(regions).reduce((obj, regionKey) => {
    const region = regions[regionKey]
    obj[regionKey] = {
      ...region,
      dates: Object.keys(region.dates).map(date => region.dates[date]),
    }
    return obj
  }, {} as Data['regions'])

  return {
    date: data.date,
    total: data.total,
    regions: regionsWithArray,
  }
}

const humanReadables = ['k', 'm', 'b']
function toHumanReadable(value: number): string {
  let suffix = ''
  for (let i = 0; i < humanReadables.length && value > 1000; i++) {
    value = value / 1000
    suffix = humanReadables[i]
  }

  return value.toFixed(0) + suffix
}

function CheckboxAndLabel(params: {
  id: string
  className: string
  label: string
  checked: boolean
  title?: string
  onChange: (e: Event) => void
}) {
  const node = document.createElement('div')
  node.className = params.className
  const checkbox = document.createElement('input')
  checkbox.id = params.id
  checkbox.type = 'checkbox'
  checkbox.checked = params.checked
  checkbox.addEventListener('change', params.onChange)
  const label = document.createElement('label')
  label.setAttribute('for', params.id)
  label.textContent = params.label
  label.title = params.title || params.label
  node.appendChild(checkbox)
  node.appendChild(label)
  return {node, checkbox}
}

function Form(allData: Data, chart: Chart) {
  const dataByCountry = mergeByCountries(allData)
  let data = dataByCountry
  let selections: Record<string, boolean> = getSelections(true)

  function getSelections(selected: boolean) {
    return Object.keys(data.regions).reduce((obj, key) => {
      obj[key] = selected
      return obj
    }, {} as typeof selections)
  }

  const checkboxes: HTMLInputElement[] = []
  const form = document.createElement('form')

  const selectedStats = (function() {
    const node = document.createElement('div')
    node.className = 'total-stats'

    function createStat(name: string, fg: string, bg: string) {
      const stat = document.createElement('div')
      stat.style.color = fg
      stat.style.backgroundColor = bg
      const label = document.createElement('span')
      label.textContent = name
      const value = document.createElement('span')
      stat.appendChild(label)
      stat.appendChild(value)
      node.appendChild(stat)
      return value
    }

    const values = types.reduce((obj, type) => {
      obj[type] = createStat(
        type[0].toUpperCase() + type.substring(1) + ':',
        'white',
        colorByType[type],
      )
      return obj
    }, {} as Record<StatType | 'growth', HTMLSpanElement>)

    return { node, values }
  })()
  form.appendChild(selectedStats.node)

  function calcGrowth(last: number, secondToLast: number) {
    return ' (+' + ((last/secondToLast - 1) * 100).toFixed(0) + '%)'
  }

  function updateSelectedStats(data: Record<string, Region>) {
    const stats = calculateTotal(data, lastDate, secondToLastDate)
    selectedStats.values.confirmed.textContent = stats.last.confirmed.toLocaleString() + calcGrowth(stats.last.confirmed, stats.secondToLast.confirmed)
    selectedStats.values.recovered.textContent = stats.last.recovered.toLocaleString() + calcGrowth(stats.last.recovered, stats.secondToLast.recovered)

    selectedStats.values.deaths.textContent = stats.last.deaths.toLocaleString() + calcGrowth(stats.last.deaths, stats.secondToLast.deaths)
  }

  form.autocomplete = 'off'
  const countries = document.createElement('div')
  countries.className = 'countries'

  const [lastDate, secondToLastDate] = (function() {
    const allDates = Object.keys(allData.total).sort()
    const size = allDates.length
    return [allDates[size - 1], allDates[size - 2]]
  }())

  type Sort = 'name' | StatType
  let sort: Sort = 'confirmed'


  function rebuildCheckboxes() {
    function getLastValue(region: Region, stat: StatType) {
      const value = region.dates[region.dates.length - 1]
      return value && value[stat] ? value[stat] : 0
    }

    checkboxes.length = 0
    countries.innerHTML = ''
    const divs = Object.keys(data.regions)
    .sort((key1, key2) => {
      if (sort === 'name') {
        return key1 <  key2 ? -1 : 1
      }
      const r1 = data.regions[key1]
      const r2 = data.regions[key2]
      return getLastValue(r2, sort) - getLastValue(r1, sort)
    })
    .map(key => {
      const casesKey: StatType = sort === 'name' ? 'confirmed' : sort
      const cases = ' ' + toHumanReadable(
        getLastValue(data.regions[key], casesKey),
      )
      const { node, checkbox } = CheckboxAndLabel({
        id: key,
        className: 'country',
        label: key + cases,
        checked: selections[key],
        onChange: e => {
          selections[key] = !selections[key]
          update()
        }
      })
      checkboxes.push(checkbox)
      return node
    })

    divs.forEach(div => countries.appendChild(div))
  }
  rebuildCheckboxes()

  form.appendChild(countries)
  const buttons = document.createElement('div')
  form.appendChild(buttons)

  function update() {
    const regions = Object
    .keys(data.regions)
    .filter(key => selections[key])
    .reduce((obj, key) => {
      obj[key] = data.regions[key]
      return obj
    }, {} as Record<string, Region>)
    if (cummulative.checkbox.checked) {
      const { datasets, labels } = calculateCummulativeTimeSeries(regions)
      chart.data.labels = labels
      chart.data.datasets = datasets
    } else {
      const { datasets, labels } = patientZero.checkbox.checked
      ? calculatePatientZeroTimeSeries(regions)
      : calculateDistinctTimeSeries(regions)
      chart.data.labels = labels
      chart.data.datasets = datasets
    }
    updateSelectedStats(regions)
    chart.options.scales!.yAxes![0].type = scale
    chart.update()
    location.hash = serialize()
  }

  const selectAllButton = document.createElement('button')
  selectAllButton.textContent = 'Select All'
  selectAllButton.addEventListener('click', e => {
    e.preventDefault()
    selections = getSelections(true)
    checkboxes.forEach(c => c.checked = true)
    update()
  })

  const unselectAllButton = document.createElement('button')
  unselectAllButton.textContent = 'Select None'
  unselectAllButton.addEventListener('click', e => {
    e.preventDefault()
    selections = getSelections(false)
    checkboxes.forEach(c => c.checked = false)
    update()
  })

  buttons.className = 'buttons'
  buttons.appendChild(selectAllButton)
  buttons.appendChild(unselectAllButton)

  const cummulative = CheckboxAndLabel({
    id: 'cummulative',
    className: 'cummulative',
    onChange: e => {
      const checked = (e.target as HTMLInputElement).checked
      if (checked) {
        patientZero.checkbox.checked = false
      }
      patientZero.checkbox.disabled = checked
      update()
    },
    checked: true,
    label: 'Cummulative'
  })
  buttons.appendChild(cummulative.node)
  const patientZero = CheckboxAndLabel({
    id: 'patientZero',
    className: 'patientZero',
    onChange: e => {
      update()
    },
    checked: false,
    label: 'Patient Zero',
    title: 'Compare cases in countries from first case',
  })
  patientZero.checkbox.disabled = true
  buttons.appendChild(patientZero.node)
  const perCountry = CheckboxAndLabel({
    id: 'merge',
    className: 'Per Country',
    onChange: e => {
      if ((e.target as HTMLInputElement).checked) {
        data = dataByCountry
      } else {
        data = allData
      }
      rebuildCheckboxes()
      update()
    },
    checked: true,
    label: 'Group by Country',
  })
  buttons.appendChild(perCountry.node)

  const sortSelect = document.createElement('select')
  sortSelect.id = 'sort'
  const sortOptions: string[] = ['name', 'confirmed', 'recovered', 'deaths']
  sortOptions.forEach(sortId => {
    const option = document.createElement('option')
    option.selected = sortId === sort
    option.textContent = 'Sort by ' + sortId
    option.value = sortId
    sortSelect.appendChild(option)
  })
  sortSelect.addEventListener('change', e => {
    sort = (e.target as HTMLSelectElement).value as Sort
    rebuildCheckboxes()
    location.hash = serialize()
  })
  sortSelect.style.marginLeft = '0.25rem'
  buttons.appendChild(sortSelect)

  type Scale = 'linear' | 'logarithmic'
  let scale: Scale = 'linear'
  const scaleSelect = document.createElement('select')
  scaleSelect.id = 'scale'
  const scaleOptions: Scale[] = ['linear', 'logarithmic']
  scaleOptions.forEach(scaleId => {
    const option = document.createElement('option')
    option.selected = scaleId === scale
    option.textContent = scaleId
    option.value = scaleId
    scaleSelect.appendChild(option)
  })
  scaleSelect.addEventListener('change', e => {
    scale = (e.target as HTMLSelectElement).value as Scale
    update()
  })
  scaleSelect.style.marginLeft = '0.25rem'
  buttons.appendChild(scaleSelect)

  const footer = document.createElement('footer')
  footer.innerHTML = `<footer>
    Generated from John Hopkins'
    <a href="https://github.com/CSSEGISandData/COVID-19"> COVID-19 dataset</a>
    at ${new Date(allData.date).toUTCString()}
    by <a href="https://github.com/jeremija">jeremija</a>/<a href="https://github.com/jeremija/covid-19">covid-19</a>
  </footer>`

  form.appendChild(footer)


  interface Serialized {
    checkboxes: Record<string, boolean>
    cummulative: boolean
    patientZero: boolean
    perCountry: boolean
    sort: Sort
    scale: Scale,
    hiddenCharts: number[]
  }

  function serialize(): string {
    const values: Serialized = {
      checkboxes: checkboxes.filter(c => c.checked).reduce((obj, c) => {
        obj[c.id] = true
        return obj
      }, {} as Record<string, boolean>),
      cummulative: cummulative.checkbox.checked,
      patientZero: patientZero.checkbox.checked,
      perCountry: perCountry.checkbox.checked,
      sort: sort,
      scale: scale,
      hiddenCharts: chart.data.datasets!
      .map((d, i) => ({ hidden: chart.getDatasetMeta(i).hidden, index: i }))
      .filter(item => item.hidden)
      .map(item => item.index),
    }
    return encodeURIComponent(JSON.stringify(values))
  }

  let hiddenCharts: number[] = []
  function deserialize() {
    const hash = location.hash.substring(1)
    if (hash.length === 0) {
      return
    }
    try {
      const values: Serialized = JSON.parse(decodeURIComponent(hash))
      checkboxes.forEach(checkbox => {
        if (values.checkboxes[checkbox.id]) {
          selections[checkbox.id] = true
          checkbox.checked = true
        } else {
          selections[checkbox.id] = false
          checkbox.checked = false
        }
      })
      cummulative.checkbox.checked = values.cummulative
      cummulative.checkbox.checked = values.cummulative
      if (values.cummulative) {
        patientZero.checkbox.setAttribute('disabled', '')
      } else {
        patientZero.checkbox.removeAttribute('disabled')
      }
      patientZero.checkbox.checked = values.patientZero
      perCountry.checkbox.checked = values.perCountry
      sort = values.sort
      scale = values.scale
      Array.from(sortSelect.options).forEach(option => {
        option.selected = option.value === sort
      })
      rebuildCheckboxes()
      hiddenCharts = values.hiddenCharts || hiddenCharts
    } catch (err) {
      console.error('Error deserializing:', err)
    }
  }

  const onLegendClick = chart.options.legend!.onClick!
  chart.options.legend!.onClick = function (e, legendLabelItem) {
    onLegendClick.call(this, e, legendLabelItem)
    location.hash = serialize()
  }

  deserialize()
  update()
  hiddenCharts.forEach(index => {
    const d = chart.data.datasets![index]
    console.log('hiding datasets', index, !!d)
    if (d) {
      chart.getDatasetMeta(index).hidden = true
      d.hidden = true
    }
  })
  chart.update()
  location.hash = serialize()

  return form
}

const {chart, canvas} = CreateChart(_data)
app.appendChild(canvas)
app.appendChild(Form(_data, chart))
// chart.data.datasets = calculateCummulativeTimeSeries(_data.regions)
// chart.update()
