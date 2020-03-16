import { data, Data, DayStat, Region } from '../build/data'
import { Chart } from 'chart.js'

const app = document.getElementById('app')!

const colors = {
  primary:   '#0d6efd',
  secondary: '#6c757d',
  success:   '#28a745',
  info:      '#17a2b8',
  warning:   '#ffc107',
  danger:    '#dc3545',
}

const colorByType = {
  confirmed: colors.danger,
  deaths: '#000000',
  recovered: colors.primary,
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
      borderColor: colorByType[type],
      data: Object.keys(dates).map(key => dates[key][type]),
    }
  })
}

function calculateDistinctTimeSeries(data: Record<string, Region>) {
  const d: Chart.ChartDataSets[] = []

  Object.keys(data).forEach(key => {
    const region = data[key]

    types.forEach(type => {
      const data = Object
      .keys(region.dates)
      .map(date => region.dates[date][type])

      d.push({
        label: `${key} (${type})`,
        fill: false,
        borderColor: colorByType[type],
        data,
      })
    })
  })

  return d
}

function Form(data: Data, chart: Chart) {
  const allSelections: Record<string, boolean> = {}
  const noSelections: Record<string, boolean> = {}
  Object.keys(data.regions).forEach(key => {
    allSelections[key] = true
    noSelections[key] = false
  })
  let selections = {...allSelections}

  const checkboxes: HTMLInputElement[] = []
  const divs = Object.keys(data.regions).sort().map(key => {
    const div = document.createElement('div')
    div.className = 'country'
    const checkbox = document.createElement('input')
    checkbox.id = key
    checkbox.type = 'checkbox'
    checkbox.checked = true
    checkbox.addEventListener('change', e => {
      selections[key] = !selections[key]
      update()
    })
    checkboxes.push(checkbox)
    const label = document.createElement('label')
    label.setAttribute('for', key)
    label.textContent = key
    div.appendChild(checkbox)
    div.appendChild(label)
    return div
  })

  const form = document.createElement('form')
  const countries = document.createElement('div')
  countries.className = 'countries'
  divs.forEach(div => {
    countries.appendChild(div)
  })
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
    if (cummulativeCheckbox.checked) {
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
    selections = {...allSelections}
    checkboxes.forEach(c => c.checked = true)
    update()
  })

  const unselectAllButton = document.createElement('button')
  unselectAllButton.textContent = 'Select None'
  unselectAllButton.addEventListener('click', e => {
    e.preventDefault()
    selections = {...noSelections}
    checkboxes.forEach(c => c.checked = false)
    update()
  })

  buttons.className = 'buttons'
  buttons.appendChild(selectAllButton)
  buttons.appendChild(unselectAllButton)

  const cummulative = document.createElement('div')
  cummulative.className = 'cummulative'
  const cummulativeCheckbox = document.createElement('input')
  cummulativeCheckbox.id = 'cummulative'
  cummulativeCheckbox.type = 'checkbox'
  cummulativeCheckbox.checked = true
  cummulativeCheckbox.addEventListener('change', () => {
    update()
  })
  cummulative.appendChild(cummulativeCheckbox)
  const label = document.createElement('label')
  label.setAttribute('for', 'cummulative')
  label.textContent = 'Cummulative'
  cummulative.appendChild(label)
  buttons.appendChild(cummulative)

  return form
}

const {chart, canvas} = CreateChart(data)
app.appendChild(canvas)
app.appendChild(Form(data, chart))
chart.data.datasets = calculateCummulativeTimeSeries(data.regions)
chart.update()
