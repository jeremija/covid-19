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

const types: Array<'confirmed' | 'deaths' | 'recovered'> = [
  'confirmed', 'deaths', 'recovered',
]

function calculateCummulativeTimeSeries(data: Record<string, Region>) {
  const dates = Object.keys(data).reduce((obj, key) => {
    const region = data[key]
    Object.keys(region.dates).forEach(date => {
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

  return types.map(type => {
    return {
      label: type,
      fill: false,
      backgroundColor: colorByType[type],
      borderColor: colorByType[type],
      data: Object.keys(dates).map(key => dates[key][type]),
    }
  })
}

function calculateDistinctTimeSeries(data: Record<string, Region>) {
  const d: Chart.ChartDataSets[] = []

  Object.keys(data).forEach((key, index) => {
    const region = data[key]

    types.forEach(type => {
      const data = Object
      .keys(region.dates)
      .map(date => region.dates[date][type])

      const colors = paletteByType[type]
      const color = colors[index % colors.length]

      d.push({
        label: `${key} (${type})`,
        fill: false,
        backgroundColor: color,
        borderColor: color,
        data,
      })
    })
  })

  return d
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

function CheckboxAndLabel(params: {
  id: string
  className: string
  label: string
  checked: boolean
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
  form.autocomplete = 'off'
  const countries = document.createElement('div')
  countries.className = 'countries'

  function rebuildCheckboxes() {
    checkboxes.length = 0
    countries.innerHTML = ''
    const divs = Object.keys(data.regions).sort().map(key => {
      const { node, checkbox } = CheckboxAndLabel({
        id: key,
        className: 'country',
        label: key,
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
      chart.data.datasets = calculateCummulativeTimeSeries(regions)
    } else {
      chart.data.datasets = calculateDistinctTimeSeries(regions)
    }
    chart.update()
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
    onChange: () => update(),
    checked: true,
    label: 'Cummulative'
  })
  buttons.appendChild(cummulative.node)
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

  const footer = document.createElement('footer')
  footer.innerHTML = `<footer>
    Generated from John Hopkins'
    <a href="https://github.com/CSSEGISandData/COVID-19"> COVID-19 dataset</a>
    at ${new Date(allData.date).toUTCString()}
    by <a href="https://github.com/jeremija">jeremija</a>
  </footer>`

  form.appendChild(footer)

  return form
}

const {chart, canvas} = CreateChart(_data)
app.appendChild(canvas)
app.appendChild(Form(_data, chart))
chart.data.datasets = calculateCummulativeTimeSeries(_data.regions)
chart.update()
