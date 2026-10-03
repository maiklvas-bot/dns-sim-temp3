import assert from "node:assert/strict";
import {
  applyMetricEffects,
  normalizeEffects,
  type MetricApplicationContext,
} from "../client/src/features/simulation-engine/scoring/metric-effects";
import type { RealisticMetrics } from "../client/src/features/simulation-engine/simulation-types";

/**
 * Контракт направления метрик.
 *
 * «Скорость выдачи» измеряется в МИНУТАХ ожидания: меньше — лучше. Знак у затора
 * был перевёрнут, и растущая очередь вычитала минуты: система показывала
 * «выдача ускорилась» там, где в зале становилось хуже — в том числе на худшем
 * варианте кейса. Проверяем не формулу, а направление: стало хуже — метрики
 * обязаны сказать «хуже» согласованно.
 */

const base: RealisticMetrics = {
  customersInStore: 18,
  avgCheck: 7200,
  conversion: 48,
  nps: 4.5,
  pickupSpeed: 12,
  warehouseLoad: 40,
  teamMorale: 7,
  dailyRevenue: 1500,
};

// Зоны зала и выдачи разом: обе метрики получают полный вес, поэтому видно,
// что они реагируют на один и тот же затор согласованно.
const context: MetricApplicationContext = {
  sourceType: "main_case",
  title: "Очередь на выдаче",
  description: "",
  zones: ["торговый_зал", "выдача"],
};

const jam = applyMetricEffects(base, normalizeEffects({ queue: 5 }), "medium", context);
const relief = applyMetricEffects(base, normalizeEffects({ queue: -5 }), "medium", context);

assert.ok(
  jam.pickupSpeed > base.pickupSpeed,
  `затор обязан увеличивать ожидание на выдаче: было ${base.pickupSpeed} мин, стало ${jam.pickupSpeed} мин`,
);
assert.ok(
  relief.pickupSpeed < base.pickupSpeed,
  `разгрузка зала обязана сокращать ожидание: было ${base.pickupSpeed} мин, стало ${relief.pickupSpeed} мин`,
);

// Согласованность: один и тот же затор не может одновременно ухудшать зал
// и улучшать выдачу. Именно это участник и видел на экране.
assert.ok(
  jam.customersInStore < base.customersInStore,
  "затор уменьшает число покупателей в зале",
);
assert.ok(
  jam.conversion < base.conversion,
  "затор снижает конверсию",
);
assert.ok(
  jam.teamMorale <= base.teamMorale,
  "затор не может поднимать настроение команды",
);

// delivery_status трактуется отдельно и в подсказке автору описан верно:
// положительное значение ускоряет выдачу, то есть сокращает минуты.
const faster = applyMetricEffects(base, normalizeEffects({ delivery_status: 5 }), "medium", context);
assert.ok(
  faster.pickupSpeed < base.pickupSpeed,
  "положительный статус выдачи сокращает ожидание",
);

// Нулевые эффекты ничего не двигают — иначе «декоративный» вариант всё равно
// шевелил бы метрики и создавал ложный сигнал в отчёте.
const idle = applyMetricEffects(base, normalizeEffects({}), "medium", context);
assert.deepEqual(idle, base, "нулевые эффекты не меняют состояние");

console.log("metric-effects parity checks passed: заторы ухудшают выдачу, а не ускоряют её");
