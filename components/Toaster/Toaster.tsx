'use client'
import { useEffect } from 'react'
import { useGameStore } from '@/store/gameStore'

export default function Toaster() {
  const notifications = useGameStore((s) => s.notifications)
  const dismiss = useGameStore((s) => s.dismissNotification)

  useEffect(() => {
    const timers = notifications.map((n) => setTimeout(() => dismiss(n.id), 4000))
    return () => timers.forEach(clearTimeout)
  }, [notifications, dismiss])

  return (
    <div className="fixed right-4 top-4 z-[60] flex flex-col gap-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            n.type === 'win'
              ? 'bg-green-600'
              : n.type === 'loss'
              ? 'bg-red-600'
              : 'bg-slate-700'
          }`}
        >
          {n.message}
        </div>
      ))}
    </div>
  )
}