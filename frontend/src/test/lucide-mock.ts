import React from 'react'

/**
 * Every icon name imported from lucide-react anywhere in src/.
 *
 * Test suites mock lucide-react for speed, but Vitest validates that the mock
 * factory actually exports each name the component imports — a missing one
 * throws at render. Hand-maintained per-file allowlists meant that adding an
 * icon to any component silently broke unrelated suites (a missing 'Zap'
 * failed 28 tests across two files), and the failure surfaces in whichever
 * suite transitively renders it, not the one you edited.
 *
 * If a suite reports a missing icon, add the name to the list below.
 */
export const LUCIDE_ICON_NAMES = [
  'AlertCircle', 'AlertTriangle', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp',
  'ArrowUpDown', 'ArrowUpRight', 'Award', 'Baby', 'Ban', 'BarChart3', 'Bell', 'BellOff',
  'Book', 'BookMarked', 'BookOpen', 'Building', 'Building2', 'Calendar', 'CalendarCheck',
  'CalendarClock', 'CalendarDays', 'CalendarPlus', 'Camera', 'CameraOff', 'Check',
  'CheckCheck', 'CheckCircle', 'CheckCircle2', 'ChevronDown', 'ChevronLeft', 'ChevronRight',
  'ChevronUp', 'Church', 'Circle', 'CircleDollarSign', 'ClipboardCheck', 'ClipboardList',
  'ClipboardPaste', 'Clock', 'Code2', 'Columns3', 'Copy', 'Cross', 'Crown', 'Database',
  'Download', 'Dumbbell', 'Edit3', 'ExternalLink', 'Eye', 'EyeOff', 'Feather', 'FileDown',
  'FileMusic', 'FileSpreadsheet', 'FileText', 'Filter', 'Flame', 'Gem', 'GitBranch', 'Globe',
  'GraduationCap', 'Grid3x3', 'GripVertical', 'Headphones', 'Heart', 'HelpCircle', 'History',
  'Home', 'ImagePlus', 'Info', 'Key', 'KeyRound', 'Keyboard', 'Languages', 'Layers',
  'LayoutDashboard', 'LayoutGrid', 'Link2', 'ListChecks', 'Loader2', 'Lock', 'LogOut',
  'LucideIcon', 'Mail', 'MapPin', 'Maximize', 'Medal', 'Megaphone', 'Menu', 'MessageCircle',
  'MessageSquare', 'Mic', 'Minimize', 'Minus', 'MonitorSmartphone', 'Moon', 'MoreVertical',
  'Music', 'Music2', 'Music3', 'Palette', 'PanelLeft', 'PanelLeftClose', 'Pause', 'Pencil',
  'Phone', 'Play', 'PlayCircle', 'Plus', 'PlusSquare', 'Power', 'PowerOff', 'Presentation',
  'Printer', 'QrCode', 'Quote', 'RefreshCw', 'RotateCcw', 'RotateCw', 'Rows3', 'Save',
  'School', 'Search', 'Send', 'Settings', 'Share', 'Shield', 'ShieldCheck', 'Sliders',
  'SlidersHorizontal', 'Sparkles', 'Sprout', 'Square', 'Star', 'StickyNote', 'Sun', 'Tag',
  'Target', 'Trash2', 'TrendingDown', 'TrendingUp', 'Trophy', 'Upload', 'User', 'UserCheck',
  'UserCog', 'UserPlus', 'UserX', 'Users', 'Volume2', 'Wifi', 'X', 'XCircle', 'Zap',
] as const

/**
 * Mock factory returning a stub component per icon.
 *
 * Use the async form so the dynamic import survives vi.mock hoisting:
 *
 *   vi.mock('lucide-react', async () => (await import('@/test/lucide-mock')).lucideMock())
 */
export function lucideMock(): Record<string, React.FC<Record<string, unknown>>> {
  const icons: Record<string, React.FC<Record<string, unknown>>> = {}
  for (const name of LUCIDE_ICON_NAMES) {
    const Icon = (props: Record<string, unknown>) =>
      React.createElement('span', { 'data-testid': `icon-${name}`, ...props })
    Icon.displayName = `MockIcon(${name})`
    icons[name] = Icon
  }
  return icons
}
