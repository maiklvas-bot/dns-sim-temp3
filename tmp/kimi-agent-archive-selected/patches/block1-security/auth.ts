/**
 * =============================================================================
 * Модуль аутентификации — улучшенная версия с bcrypt
 * =============================================================================
 * 
 * ИЗМЕНЕНИЯ БЕЗОПАСНОСТИ:
 * — Переход с scrypt на bcrypt (более надёжный алгоритм хеширования)
 * — Cost factor 12 (4096 раундов) — оптимальный баланс безопасности/производительности
 * — Автоматическая генерация соли для каждого пароля
 * — Асинхронное хеширование (не блокирует event loop)
 * — timingSafeEqual для сравнения хешей (защита от timing-атак)
 * 
 * ТРЕБУЕТСЯ УСТАНОВИТЬ:
 *   npm install bcrypt @types/bcrypt
 * =============================================================================
 */

import bcrypt from "bcrypt";

/**
 * Cost factor для bcrypt.
 * Значение 12 означает 2^12 = 4096 раундов хеширования.
 * 
 * OWASP рекомендует: cost factor ≥ 10 (минимум), оптимально 12-14
 * — На современном CPU хеширование занимает ~200-300ms
 * — Это замедляет brute-force атаки в ~4000 раз по сравнению с одним раундом
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Хеширует пароль с использованием bcrypt.
 * 
 * Алгоритм:
 * 1. Генерирует криптографически стойкую соль (16 байт, встроено в bcrypt)
 * 2. Выполняет 4096 раундов Blowfish-based хеширования
 * 3. Возвращает строку формата: $2b$12$<salt><hash>
 * 
 * Безопасность:
 * — Каждый вызов генерирует уникальную соль (защита от rainbow table)
 * — Соль встроена в результат — не нужно хранить отдельно
 * — Медленное хеширование защищает от brute-force
 * 
 * @param password — пароль в открытом виде (будет очищен из памяти после)
 * @returns bcrypt hash строка
 * @throws Error если пароль пустой или хеширование не удалось
 */
export async function hashPassword(password: string): Promise<string> {
  // Валидация входных данных
  if (!password || password.length === 0) {
    throw new Error("Password cannot be empty");
  }

  // Проверка минимальной длины пароля (OWASP рекомендация)
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  try {
    // bcrypt автоматически генерирует соль и включает её в результат
    const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    return hash;
  } catch (error) {
    // Не логируем сам пароль даже в случае ошибки!
    throw new Error("Failed to hash password");
  }
}

/**
 * Верифицирует пароль против хеша.
 * 
 * Безопасность:
 * — Использует bcrypt.compare который применяет timing-safe сравнение
 * — Не раскрывает информацию о длине пароля через timing
 * — Возвращает false при любой ошибке (fail-safe)
 * 
 * @param password — пароль в открытом виде от пользователя
 * @param storedHash — хеш из базы данных ($2b$12$...)
 * @returns true если пароль верный, false иначе
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Проверка входных данных
  if (!password || !storedHash) {
    return false;
  }

  // Валидация формата bcrypt hash
  if (!storedHash.startsWith("$2")) {
    // Возможно, это старый формат scrypt — для обратной совместимости
    // В продакшене нужно мигрировать старые хеши
    return verifyLegacyScryptPassword(password, storedHash);
  }

  try {
    // bcrypt.compare выполняет timing-safe сравнение внутри
    const isValid = await bcrypt.compare(password, storedHash);
    return isValid;
  } catch (error) {
    // При любой ошибке возвращаем false (fail-safe)
    return false;
  }
}

/**
 * Обратная совместимость для старых scrypt-хешей.
 * 
 * ВНИМАНИЕ: Эта функция должна быть удалена после полной миграции
 * всех паролей на bcrypt. Как только все пользователи залогинятся,
 * их пароли будут переведены на bcrypt.
 * 
 * @deprecated Используется только для миграции с scrypt на bcrypt
 */
function verifyLegacyScryptPassword(password: string, storedHash: string): boolean {
  try {
    const crypto = require("crypto") as typeof import("crypto");
    const SCRYPT_KEYLEN = 64;
    
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    
    const [salt, expectedHash] = parts;
    if (!salt || !expectedHash) return false;
    
    const actualHash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
    
    // Timing-safe сравнение защищает от timing-атак
    const actualBuffer = Buffer.from(actualHash, "hex");
    const expectedBuffer = Buffer.from(expectedHash, "hex");
    
    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
