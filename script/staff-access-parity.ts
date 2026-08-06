import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { STAFF_ROLE_ACCESS, formatStaffRole } from "../shared/staff-access";

/**
 * Контракт учётных записей и переходов между кабинетами.
 *
 * Таблица прав в разделе «Пользователи» — обещание пользователю. Если охрану
 * маршрута снимут, а строку в таблице оставят, администратор будет считать
 * доступ закрытым, хотя он открыт. Здесь это ловится.
 */

const read = (relative: string) => fs.readFileSync(path.resolve(relative), "utf8");

const routes = read("server/routes.ts");
const assessor = read("client/src/features/assessor/AssessorWorkspaceRuntime.tsx");
const adminRuntime = read("client/src/features/admin/AdminWorkspaceRuntime.tsx");
const adminTypes = read("client/src/features/admin/admin-types.ts");
const createScript = read("script/create-staff-account.ts");

// ── 1. Заявленные админские маршруты действительно закрыты requireAdmin ──
for (const route of STAFF_ROLE_ACCESS.admin.guardedRoutes) {
  const occurrences: number[] = [];
  let from = 0;
  for (;;) {
    const at = routes.indexOf(`"${route}"`, from);
    if (at < 0) break;
    occurrences.push(at);
    from = at + 1;
  }

  assert.ok(occurrences.length > 0, `маршрут ${route} заявлен в правах администратора, но в routes.ts его нет`);

  // Искать надо строго в списке middleware ЭТОГО маршрута — от пути до стрелки
  // обработчика. Окно «столько-то символов после пути» заезжает на следующий
  // маршрут и находит его requireAdmin: проверка тогда зелёная при снятой охране.
  const guarded = occurrences.some((at) => {
    const arrow = routes.indexOf("=>", at);
    const nextRoute = routes.indexOf("\n  app.", at);
    const end = Math.min(arrow < 0 ? routes.length : arrow, nextRoute < 0 ? routes.length : nextRoute);
    return routes.slice(at, end).includes("requireAdmin");
  });
  assert.ok(guarded, `маршрут ${route} заявлен как доступный только администратору, но requireAdmin на нём нет`);
}

// ── 2. У оценщика перечислено то, чего он не может, и это не пусто ──
assert.ok(STAFF_ROLE_ACCESS.evaluator.denied.length > 0, "у оценщика должны быть названы ограничения");
assert.equal(STAFF_ROLE_ACCESS.admin.denied.length, 0, "у администратора ограничений быть не должно");
assert.equal(formatStaffRole("evaluator"), "Оценщик");

// ── 3. Раздел «Пользователи» заведён и виден в меню ──
assert.ok(adminTypes.includes('"users"'), "вкладка users не объявлена в AdminTabKey");
const navLine = adminRuntime
  .split(/\r?\n/)
  .find((line) => line.includes('"dashboard", "cases"') && line.includes("TabKey[]"));
assert.ok(navLine, "не найден список разделов бокового меню администратора");
assert.ok(navLine.includes('"users"'), "раздел «Пользователи» не выведен в боковое меню");

// Сохранять в разделе нечего — кнопка сохранения не должна там появляться.
assert.ok(
  adminRuntime.includes('tab !== "users"'),
  "кнопка сохранения не исключена для раздела «Пользователи»",
);

// ── 4. Возврат оценщик → администратор не требует пароля у админской сессии ──
const handlerStart = assessor.indexOf("const handleAdminAccess");
assert.ok(handlerStart > 0, "не найден обработчик перехода в кабинет администратора");
const handlerBody = assessor.slice(handlerStart, assessor.indexOf("};", handlerStart));

assert.ok(
  handlerBody.includes('staffRole === "admin"'),
  "переход в администратора не смотрит на роль сессии",
);
// Проверяем вызов, а не имя: строка «isAdminSessionFreshOff» содержала бы имя
// и оставила бы проверку зелёной при живом старом коде.
assert.ok(
  !handlerBody.includes("isAdminSessionFresh("),
  "возврат администратора снова зависит от отметки свежести в localStorage",
);
assert.ok(
  !handlerBody.includes("markAdminConfirmed("),
  "переход снова отмечает подтверждение в localStorage вместо роли сессии",
);

// Пароль остаётся обязательным для оценщика: путь повышения роли не должен исчезнуть.
assert.ok(
  handlerBody.includes("setAdminAccessOpen(true)"),
  "оценщик потерял окно подтверждения пароля — повышение роли стало бы безусловным",
);
assert.ok(
  assessor.includes('apiRequest("POST", "/api/staff/elevate"'),
  "повышение роли больше не проверяется сервером",
);

// ── 5. Переход администратор → оценщик на месте ──
assert.ok(
  adminRuntime.includes('navigate("/evaluator")'),
  "из кабинета администратора пропал переход к оценщику",
);

// ── 6. Скрипт учёток не заводит логин, которым нельзя войти ──
assert.ok(
  createScript.includes("/^[a-zA-Z0-9._-]+$/"),
  "скрипт создания учётки не проверяет логин тем же выражением, что и вход",
);
// Пароль не должен печататься в консоль — только путь к файлу.
assert.ok(
  !/console\.log\([^)]*\bpassword\b/.test(createScript),
  "скрипт печатает пароль в консоль — он осядет в истории терминала",
);

console.log(
  `staff-access parity checks passed (${STAFF_ROLE_ACCESS.admin.guardedRoutes.length} админских маршрута сверено, `
  + `ограничений у оценщика: ${STAFF_ROLE_ACCESS.evaluator.denied.length})`,
);
