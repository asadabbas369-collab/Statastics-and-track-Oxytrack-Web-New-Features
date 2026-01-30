import { BottleType, InventoryCounts } from './types';

export const INITIAL_COUNTS: InventoryCounts = {
  [BottleType.OXYZONE_LARGE]: 0,
  [BottleType.OXYZONE_SMALL]: 0,
  [BottleType.CO2_LARGE]: 0,
  [BottleType.CO2_SMALL]: 0,
};

export const BOTTLE_CONFIG = {
  [BottleType.OXYZONE_LARGE]: { 
    label: 'Oxygen (45KG)', 
    short: 'Oxygen',
    sub: '45KG',
    color: 'bg-rose-500', 
    text: 'text-rose-500', 
    bgLight: 'bg-rose-50',
    iconColor: 'text-white'
  },
  [BottleType.OXYZONE_SMALL]: { 
    label: 'Oxygen (30KG)', 
    short: 'Oxygen',
    sub: '30KG',
    color: 'bg-rose-400', 
    text: 'text-rose-400',
    bgLight: 'bg-rose-50',
    iconColor: 'text-white' 
  },
  [BottleType.CO2_LARGE]: { 
    label: 'CO2 (45KG)', 
    short: 'CO2',
    sub: '45KG',
    color: 'bg-slate-600', 
    text: 'text-slate-600',
    bgLight: 'bg-slate-100',
    iconColor: 'text-white' 
  },
  [BottleType.CO2_SMALL]: { 
    label: 'CO2 (30KG)', 
    short: 'CO2',
    sub: '30KG',
    color: 'bg-slate-500', 
    text: 'text-slate-500',
    bgLight: 'bg-slate-100',
    iconColor: 'text-white' 
  },
};