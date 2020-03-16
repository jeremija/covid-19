import { data, DayStat } from '../build/data'
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
  confirmed: colors.warning,
  deaths: colors.danger,
  recovered: colors.success,
}

function insertTimeSeries(data: Record<string, DayStat>) {
  const canvas = document.createElement('canvas')
  app.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  const array = Object.keys(data).map(key => data[key])
  const labels = array.map(t => t.date)

  const types: Array<'confirmed' | 'deaths' | 'recovered'> = [
    'confirmed', 'deaths', 'recovered',
  ]
  const datasets = types.map(type => {
    return {
      label: type,
      fill: false,
      borderColor: colorByType[type],
      data: array.map(t => {
        if (t[type] < 0) {
          console.warn('less than zero', t.date, t[type])
        }
        return t
      }).map(t => t[type]),
    }
  })

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets,
    },
  })

  return chart
}

insertTimeSeries(data.total)
