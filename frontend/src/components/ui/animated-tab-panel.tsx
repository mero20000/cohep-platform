'use client'

import { AnimatePresence, motion } from 'motion/react'

interface AnimatedTabPanelProps {
  tabId: string
  activeTab: string
  children: React.ReactNode
  className?: string
}

export function AnimatedTabPanel({ tabId, activeTab, children, className }: AnimatedTabPanelProps) {
  return (
    <AnimatePresence mode="wait">
      {activeTab === tabId && (
        <motion.div
          key={tabId}
          role="tabpanel"
          id={`panel-${tabId}`}
          aria-labelledby={`tab-${tabId}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
