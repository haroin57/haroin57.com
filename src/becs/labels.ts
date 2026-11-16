import type { Purpose } from './model'

export const checkpointLabels: Record<Purpose, string> = { NFC_WAKE: '起床', NFC_DEPARTURE: '外出', NFC_LAB_ARRIVAL: '研究室到着', NFC_FOCUS_START: '集中開始', NFC_HOME_RETURN: '帰宅', NFC_STRENGTH_SET: '筋トレ1セット完了', NFC_BIKE_START: 'バイク開始', NFC_BATH_DONE: '入浴完了', NFC_CROQUIS_DONE: 'クロッキー完了', NFC_DAILY_CLOSE: '日次クローズの確認', NFC_SLEEP: '就寝準備' }
