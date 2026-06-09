export interface RealisticMetrics {
  customersInStore: number;
  avgCheck: number;
  conversion: number;
  nps: number;
  pickupSpeed: number;
  warehouseLoad: number;
  teamMorale: number;
  dailyRevenue: number;
}

export function getSignalTypeEmoji(type: string): string {
  switch (type) {
    case "call": return "📞";
    case "email": return "📧";
    case "message": return "💬";
    case "video": return "🎥";
    case "visitor": return "👤";
    case "zone_signal": return "⚠️";
    default: return "📋";
  }
}

export function getSignalTypeLabel(type: string): string {
  switch (type) {
    case "call": return "Входящий звонок";
    case "email": return "Новое письмо";
    case "message": return "Сообщение";
    case "video": return "Видеообращение";
    case "visitor": return "Личное обращение";
    case "zone_signal": return "Сигнал зоны";
    default: return "Уведомление";
  }
}
