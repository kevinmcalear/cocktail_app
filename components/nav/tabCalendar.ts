import { Platform } from 'react-native';

/**
 * The Tonight tab's calendar page, one drawing per day of the month: white on
 * clear, so the tab bar tints it. Android, and iOS before 26, which has no
 * numbered calendar symbols. Drawn by scripts/tab-calendar-icons.swift from
 * the whole-app canvas's tab glyph (nav-phone-venue).
 */
const DAYS = [
  require('@/assets/images/tab-calendar/1.png'),
  require('@/assets/images/tab-calendar/2.png'),
  require('@/assets/images/tab-calendar/3.png'),
  require('@/assets/images/tab-calendar/4.png'),
  require('@/assets/images/tab-calendar/5.png'),
  require('@/assets/images/tab-calendar/6.png'),
  require('@/assets/images/tab-calendar/7.png'),
  require('@/assets/images/tab-calendar/8.png'),
  require('@/assets/images/tab-calendar/9.png'),
  require('@/assets/images/tab-calendar/10.png'),
  require('@/assets/images/tab-calendar/11.png'),
  require('@/assets/images/tab-calendar/12.png'),
  require('@/assets/images/tab-calendar/13.png'),
  require('@/assets/images/tab-calendar/14.png'),
  require('@/assets/images/tab-calendar/15.png'),
  require('@/assets/images/tab-calendar/16.png'),
  require('@/assets/images/tab-calendar/17.png'),
  require('@/assets/images/tab-calendar/18.png'),
  require('@/assets/images/tab-calendar/19.png'),
  require('@/assets/images/tab-calendar/20.png'),
  require('@/assets/images/tab-calendar/21.png'),
  require('@/assets/images/tab-calendar/22.png'),
  require('@/assets/images/tab-calendar/23.png'),
  require('@/assets/images/tab-calendar/24.png'),
  require('@/assets/images/tab-calendar/25.png'),
  require('@/assets/images/tab-calendar/26.png'),
  require('@/assets/images/tab-calendar/27.png'),
  require('@/assets/images/tab-calendar/28.png'),
  require('@/assets/images/tab-calendar/29.png'),
  require('@/assets/images/tab-calendar/30.png'),
  require('@/assets/images/tab-calendar/31.png'),
] as number[];

/** The drawing for a day of the month (1 to 31). */
export const calendarDayImage = (day: number): number => DAYS[day - 1];

/** iOS 26 ships "1.calendar" to "31.calendar" (SF Symbols 7), drawn to match the system's weight. */
export const hasNumberedCalendarSymbols = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;
