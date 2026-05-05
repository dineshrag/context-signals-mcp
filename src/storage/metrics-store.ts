import { mkdir, readFile, writeFile, rm } from "fs/promises"
import path from "path"

export interface SearchRecord {
  query: string
  resultsCount: number
  timestamp: number
}

export interface ReindexMetrics {
  signalsRemoved: number
  signalsCreated: number
  filesReindexed: number
}

export interface MetricsData {
  searches: SearchRecord[]
  lastIndexedAt: number | null
  rawSourceChars: number
}

export class MetricsStore {
  private metricsFile: string
  private cache: MetricsData | null = null
  reindexMetrics: ReindexMetrics = { signalsRemoved: 0, signalsCreated: 0, filesReindexed: 0 }

  constructor(memoryDir: string) {
    this.metricsFile = path.join(memoryDir, "metrics.json")
  }

  async load(): Promise<MetricsData> {
    if (this.cache) return this.cache
    try {
      const content = await readFile(this.metricsFile, "utf-8")
      this.cache = JSON.parse(content) as MetricsData
      return this.cache
    } catch {
      this.cache = {
        searches: [],
        lastIndexedAt: null,
        rawSourceChars: 0,
      }
      return this.cache
    }
  }

  async save(metrics: MetricsData): Promise<void> {
    await mkdir(path.dirname(this.metricsFile), { recursive: true })
    await writeFile(this.metricsFile, JSON.stringify(metrics, null, 2), "utf-8")
    this.cache = metrics
  }

  async recordSearch(query: string, resultsCount: number): Promise<void> {
    const metrics = await this.load()
    metrics.searches.push({
      query,
      resultsCount,
      timestamp: Date.now(),
    })
    if (metrics.searches.length > 1000) {
      metrics.searches = metrics.searches.slice(-500)
    }
    await this.save(metrics)
  }

  async updateLastIndexed(rawSourceChars: number): Promise<void> {
    const metrics = await this.load()
    metrics.lastIndexedAt = Date.now()
    metrics.rawSourceChars = rawSourceChars
    await this.save(metrics)
  }

  async getSearchStats(): Promise<{
    totalSearches: number
    avgResultsPerQuery: number
    top3HitRate: number
    zeroResultQueries: number
    recentSearches: SearchRecord[]
  }> {
    const metrics = await this.load()
    const searches = metrics.searches

    if (searches.length === 0) {
      return {
        totalSearches: 0,
        avgResultsPerQuery: 0,
        top3HitRate: 0,
        zeroResultQueries: 0,
        recentSearches: [],
      }
    }

    const totalResults = searches.reduce((sum, s) => sum + s.resultsCount, 0)
    const avgResultsPerQuery = totalResults / searches.length
    const zeroResultQueries = searches.filter(s => s.resultsCount === 0).length
    const top3HitRate = searches.length >= 3
      ? (searches.slice(-3).filter(s => s.resultsCount >= 3).length / 3) * 100
      : (searches.filter(s => s.resultsCount >= 1).length / searches.length) * 100

    return {
      totalSearches: searches.length,
      avgResultsPerQuery: Math.round(avgResultsPerQuery * 10) / 10,
      top3HitRate: Math.round(top3HitRate),
      zeroResultQueries,
      recentSearches: searches.slice(-10),
    }
  }

  async clear(): Promise<void> {
    await rm(this.metricsFile, { force: true })
    this.cache = null
  }
}
