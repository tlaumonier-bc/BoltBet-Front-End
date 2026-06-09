import type { MetadataRoute } from 'next'
import { allCells } from '@/lib/grid'

const BASE = 'https://boltbet.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ['', '/play', '/how-it-works', '/leaderboard'].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: path === '' ? 1 : 0.8,
  }))

  const zoneRoutes = allCells().map((c) => ({
    url: `${BASE}/zone/${c.id}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.5,
  }))

  return [...staticRoutes, ...zoneRoutes]
}