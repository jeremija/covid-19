export interface DayStat {
  date: string
  confirmed: number
  deaths: number
  recovered: number
}

export interface Region {
  'Country/Region': string
  'Province/State': string
  Lat: string
  Long: string
  dates: DayStat[]
}

export interface Data {
  date: string
  total: DayStat[]
  regions: Record<string, Region>
  source: {
    name: string
    link: string
  }
}

export interface RegionMap {
  'Country/Region': string
  'Province/State': string
  Lat: string
  Long: string
  dates: Record<string, DayStat>
}

export interface DataMap {
  date: string
  total: Record<string, DayStat>
  regions: Record<string, RegionMap>
}

export type StatType = 'confirmed' | 'deaths' | 'recovered'

export declare const data: Data
