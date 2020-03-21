import { data as _data, Data, DayStat, Region } from '../build/data'
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

type StatType = 'confirmed' | 'deaths' | 'recovered'
const types: Array<StatType> = [
  'confirmed', 'recovered', 'deaths',
]

function calculateCummulativeTimeSeries(data: Record<string, Region>) {
  let labels: string[] = []

  const dates = Object.keys(data).reduce((obj, key) => {
    const region = data[key]
    const keys = labels = Object.keys(region.dates)
    keys.forEach(date => {
      const dayStat = obj[date] = obj[date] || {
        date,
        confirmed: 0,
        deaths: 0,
        recovered: 0,
      }
      const regionDayStat = region.dates[date]
      dayStat.confirmed += regionDayStat.confirmed
      dayStat.deaths += regionDayStat.deaths
      dayStat.recovered += regionDayStat.recovered
    })
    return obj
  }, {} as Record<string, DayStat>)

  const datasets = types.map(type => {
    return {
      label: type,
      fill: false,
      backgroundColor: colorByType[type],
      borderColor: colorByType[type],
      data: Object.keys(dates).map(key => dates[key][type]),
    }
  })

  return { datasets, labels }
}

function calculateDistinctTimeSeries(data: Record<string, Region>) {
  const datasets: Array<Chart.ChartDataSets & { statType: StatType }> = []

  let labels: string[] = []

  Object.keys(data).forEach((key, index) => {
    const region = data[key]

    let offset = Infinity
    types.forEach(type => {
      labels = Object.keys(region.dates)
      const data = labels.map(date => region.dates[date][type])

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

function calculateTotal(data: Record<string, Region>, lastDate: string) {
  return Object.keys(data).reduce((obj, key) => {
    types.forEach(type => {
      obj[type] += data[key].dates[lastDate][type]
    })
    return obj
  }, {
    confirmed: 0,
    recovered: 0,
    deaths: 0,
  })
}

function mergeByCountries(data: Data): Data {
  const result: Data = {
    total: data.total,
    regions: {},
    date: data.date,
  }

  Object.keys(data.regions).forEach(key => {
    const region = data.regions[key]
    const country = region['Country/Region']
    const resultRegion = result.regions[country] = result.regions[country] || {
      'Country/Region': country,
      'Province/State': '',
      dates: {},
      Lat: 0,
      Lng: 0,
    }
    Object.keys(region.dates).forEach(date => {
      const dayStat = region.dates[date]
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

  return result
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

    const values = types.reduce((obj, type) => {
      const stat = document.createElement('div')
      stat.style.color = 'white'
      stat.style.backgroundColor = colorByType[type]
      const label = document.createElement('span')
      label.textContent = type[0].toUpperCase() + type.substring(1) + ':'
      const value = document.createElement('span')
      stat.appendChild(label)
      stat.appendChild(value)
      node.appendChild(stat)
      obj[type] = value
      return obj
    }, {} as Record<StatType, HTMLSpanElement>)

    return { node, values }
  })()
  form.appendChild(selectedStats.node)

  function updateSelectedStats(data: Record<string, Region>) {
    const stats = calculateTotal(data, lastDate)
    selectedStats.values.confirmed.textContent = stats.confirmed.toLocaleString()
    selectedStats.values.recovered.textContent = stats.recovered.toLocaleString()
    selectedStats.values.deaths.textContent = stats.deaths.toLocaleString()
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
    checkboxes.length = 0
    countries.innerHTML = ''
    const divs = Object.keys(data.regions)
    .sort((key1, key2) => {
      if (sort === 'name') {
        return key1 <  key2 ? -1 : 1
      }
      const r1 = data.regions[key1]
      const r2 = data.regions[key2]
      return r2.dates[lastDate][sort] - r1.dates[lastDate][sort]
    })
    .map(key => {
      const casesKey: StatType = sort === 'name' ? 'confirmed' : sort
      const cases = ' ' + toHumanReadable(
        data.regions[key].dates[lastDate][casesKey],
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
    if (sortId === sort) {
      option.setAttribute('selected', '')
    }
    option.textContent = 'Sort by ' + sortId
    option.value = sortId
    sortSelect.appendChild(option)
  })
  sortSelect.addEventListener('change', e => {
    sort = (e.target as HTMLSelectElement).value as Sort
    rebuildCheckboxes()
  })
  sortSelect.style.marginLeft = '0.25rem'
  buttons.appendChild(sortSelect)

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
    }
    return encodeURIComponent(JSON.stringify(values))
  }

  function deserialize() {
    try {
      const values: Serialized = JSON.parse(decodeURIComponent(location.hash.slice(1)))
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
      patientZero.checkbox.checked = values.patientZero
      perCountry.checkbox.checked = values.perCountry
    } catch (err) {
      console.error('Error deserializing:', err)
    }
  }

  deserialize()
  update()

  return form
}

const {chart, canvas} = CreateChart(_data)
app.appendChild(canvas)
app.appendChild(Form(_data, chart))
// chart.data.datasets = calculateCummulativeTimeSeries(_data.regions)
// chart.update()
