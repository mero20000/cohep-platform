'use client'

export function DemoBanner({ onExit }: { onExit: () => void }) {
  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-white text-sm px-4 py-2 flex justify-between">
      <span>Demo Mode — data is not saved</span>
      <button onClick={onExit} className="underline">Exit Demo</button>
    </div>
  )
}
