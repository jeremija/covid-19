export interface DayStat {
  date: string
  confirmed: number
  deaths: number
  recovered: number
}

export interface Region {
  dates: Record<string, DayStat>
}

export interface Data {
  date: string
  total: Record<string, DayStat>
  regions: Record<string, Region>
}

export declare const data: Data
