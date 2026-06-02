import { Award, BookMarked, Wrench, type LucideIcon } from 'lucide-react'
import type { ProgrammeComponentType } from '@/config/pillarProgrammeComponents'

export interface TypeVisual {
  icon: LucideIcon
  brand: string
  brandHover: string
  iconBg: string
  iconColor: string
  eyebrowColor: string
  focusBorder: string
}

/** Per-type brand colors/icons shared by the programme-component card and the
 *  inline parts picker. Kept in a non-component module so the picker file can
 *  export only its component (react-refresh friendly). */
export const TYPE_VISUALS: Record<ProgrammeComponentType, TypeVisual> = {
  capstone: {
    icon: Award,
    brand: '#350e6f',
    brandHover: '#27062e',
    iconBg: '#f4f0fb',
    iconColor: '#350e6f',
    eyebrowColor: '#350e6f',
    focusBorder: '#350e6f',
  },
  case_study: {
    icon: BookMarked,
    brand: '#eab130',
    brandHover: '#b58721',
    iconBg: '#fdf6e3',
    iconColor: '#8a6310',
    eyebrowColor: '#8a6310',
    focusBorder: '#eab130',
  },
  practical: {
    icon: Wrench,
    brand: '#f4540c',
    brandHover: '#c4400a',
    iconBg: '#fdece1',
    iconColor: '#c4400a',
    eyebrowColor: '#c4400a',
    focusBorder: '#f4540c',
  },
}
