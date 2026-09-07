import type { IconBaseProps } from 'react-icons'
import {
  IoAddOutline,
  IoAnalyticsOutline,
  IoArrowBackOutline,
  IoArrowForwardOutline,
  IoCalendarOutline,
  IoCheckmarkCircle,
  IoCheckmarkOutline,
  IoChevronForwardOutline,
  IoCloseCircle,
  IoCloseOutline,
  IoCreateOutline,
  IoEarOutline,
  IoExtensionPuzzleOutline,
  IoGitNetworkOutline,
  IoListOutline,
  IoLocateOutline,
  IoLockClosedOutline,
  IoMapOutline,
  IoMenuOutline,
  IoMusicalNotesOutline,
  IoOptionsOutline,
  IoRefreshOutline,
  IoRemoveOutline,
  IoSettingsOutline,
  IoSparklesOutline,
  IoSwapVerticalOutline,
  IoTrendingUpOutline,
  IoTrophyOutline,
  IoVolumeHighOutline,
} from 'react-icons/io5'

/**
 * Explicit name -> component map (Ionicons 5).
 *
 * Deliberately not `import * as Icons` and not dynamic member access: a
 * namespace import defeats tree-shaking and would pull the entire icon set
 * into the bundle. Add new icons here by name.
 */
const ICONS = {
  add: IoAddOutline,
  analytics: IoAnalyticsOutline,
  arrowBack: IoArrowBackOutline,
  arrowForward: IoArrowForwardOutline,
  calendar: IoCalendarOutline,
  checkmark: IoCheckmarkOutline,
  correct: IoCheckmarkCircle,
  chevronForward: IoChevronForwardOutline,
  close: IoCloseOutline,
  create: IoCreateOutline,
  ear: IoEarOutline,
  list: IoListOutline,
  locate: IoLocateOutline,
  lock: IoLockClosedOutline,
  map: IoMapOutline,
  menu: IoMenuOutline,
  musicalNotes: IoMusicalNotesOutline,
  network: IoGitNetworkOutline,
  options: IoOptionsOutline,
  puzzle: IoExtensionPuzzleOutline,
  refresh: IoRefreshOutline,
  remove: IoRemoveOutline,
  settings: IoSettingsOutline,
  sparkles: IoSparklesOutline,
  swapVertical: IoSwapVerticalOutline,
  trendingUp: IoTrendingUpOutline,
  trophy: IoTrophyOutline,
  volume: IoVolumeHighOutline,
  wrong: IoCloseCircle,
} as const

export type IconName = keyof typeof ICONS

export interface IconProps extends IconBaseProps {
  name: IconName
  /**
   * Icons are decorative by default. Pass a label only when the icon is the
   * sole carrier of meaning and no adjacent text says the same thing.
   */
  label?: string
}

export function Icon({ name, label, ...props }: IconProps) {
  const Component = ICONS[name]
  return (
    <Component
      aria-hidden={label === undefined}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      focusable="false"
      {...props}
    />
  )
}
