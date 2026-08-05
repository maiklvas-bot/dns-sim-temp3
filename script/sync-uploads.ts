import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Синхронизация загруженных файлов между стендом и репозиторием.
 *
 * Файлы из `uploads/` — это контент: картинки кейсов и скриншоты материалов
 * справочника. Они должны переезжать вместе с кодом, иначе на новом стенде
 * кейсы остаются без медиа.
 *
 * Правило одно: **скрипт ничего не удаляет**. Ни на диске, ни в репозитории.
 * Расхождение всегда трактуется как «файл где-то потерялся» и чинится
 * добавлением, а не удалением:
 *
 * - файл есть на диске, но не в репозитории → добавляется в git;
 * - файл есть в репозитории, но пропал с диска → восстанавливается из git.
 *
 * Так случайное удаление — хоть на стенде, хоть влетевшее в репозиторий с
 * чужим коммитом — не приводит к потере файла: следующий запуск вернёт его
 * на место.
 */

const UPLOADS_DIR = "uploads";

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/**
 * Git-команда, чей провал — рабочий вариант развития событий, а не ошибка.
 * Своё сообщение git печатает в stderr и путает вывод, поэтому глушим его.
 */
function gitQuiet(args: string[]): boolean {
  try {
    execFileSync("git", args, { stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

/** Файлы, которые числятся в репозитории. */
function listTrackedFiles(): Set<string> {
  const output = git(["ls-files", UPLOADS_DIR]);
  return new Set(output ? output.split("\n").map((line) => line.trim()).filter(Boolean) : []);
}

/**
 * Файлы, которые когда-либо лежали в `uploads/` по истории репозитория.
 *
 * Нужны для случая, когда файл удалили и из репозитория, и с диска — например,
 * кто-то убрал его коммитом, и это влилось с чужим PR. Тогда обычная сверка
 * «диск против индекса» расхождения не увидит: с обеих сторон пусто. История
 * помнит, что файл был, и позволяет его вернуть.
 */
function listHistoricalFiles(): Set<string> {
  const output = git(["log", "--pretty=format:", "--name-only", "--diff-filter=A", "--", UPLOADS_DIR]);
  return new Set(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith(`${UPLOADS_DIR}/`)),
  );
}

/** Файлы, которые фактически лежат на диске. */
function listDiskFiles(): Set<string> {
  if (!fs.existsSync(UPLOADS_DIR)) return new Set();
  return new Set(
    fs
      .readdirSync(UPLOADS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => `${UPLOADS_DIR}/${entry.name}`),
  );
}

/**
 * Последний коммит, в котором файл ещё существовал.
 * Нужен, чтобы достать содержимое файла, удалённого в текущем состоянии.
 */
function findLastCommitWithFile(file: string): string | null {
  const output = git(["log", "--format=%H", "--diff-filter=D", "-1", "--", file]);
  if (!output) return null;
  // Файл удалили в этом коммите — значит целым он был в предыдущем.
  return `${output}^`;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const tracked = listTrackedFiles();
  const onDisk = listDiskFiles();

  const historical = listHistoricalFiles();

  const missingInGit = [...onDisk].filter((file) => !tracked.has(file)).sort();
  const missingOnDisk = [...tracked].filter((file) => !onDisk.has(file)).sort();
  // Пропали отовсюду: их не вернёт обычная сверка, только история.
  const lost = [...historical].filter((file) => !tracked.has(file) && !onDisk.has(file)).sort();

  if (missingInGit.length === 0 && missingOnDisk.length === 0 && lost.length === 0) {
    console.log(`Загруженные файлы синхронны: ${onDisk.size} шт.`);
    return;
  }

  if (missingInGit.length > 0) {
    console.log(`Новые файлы со стенда (нет в репозитории): ${missingInGit.length}`);
    missingInGit.forEach((file) => console.log(`  + ${file}`));
  }
  if (missingOnDisk.length > 0) {
    console.log(`Пропали с диска, но есть в репозитории: ${missingOnDisk.length}`);
    missingOnDisk.forEach((file) => console.log(`  ! ${file}`));
  }
  if (lost.length > 0) {
    console.log(`Удалены и с диска, и из репозитория — восстановим из истории: ${lost.length}`);
    lost.forEach((file) => console.log(`  ‼ ${file}`));
  }

  if (checkOnly) {
    console.log("\nРежим проверки: ничего не менялось. Запустите без --check, чтобы починить.");
    process.exit(missingInGit.length + missingOnDisk.length + lost.length > 0 ? 1 : 0);
  }

  // Новое со стенда — в репозиторий.
  if (missingInGit.length > 0) {
    git(["add", "--", ...missingInGit]);
    console.log(`\nДобавлено в индекс: ${missingInGit.length}`);
  }

  // Пропавшее с диска — обратно на диск. Файл не удаляем ни при каких условиях:
  // раз он был в репозитории, значит на него могут ссылаться кейсы и материалы.
  let restored = 0;
  for (const file of [...missingOnDisk, ...lost]) {
    // Файл ещё числится в репозитории — достаточно вернуть его из индекса.
    if (gitQuiet(["checkout", "--", file])) {
      restored += 1;
      continue;
    }
    // Файла нет и в текущем коммите — ищем последнюю версию в истории.
    const commit = findLastCommitWithFile(file);
    if (!commit) {
      console.error(`  не нашлось в истории: ${file}`);
      continue;
    }
    try {
      const content = execFileSync("git", ["show", `${commit}:${file}`], { maxBuffer: 256 * 1024 * 1024 });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
      git(["add", "--", file]);
      restored += 1;
    } catch {
      console.error(`  не удалось восстановить: ${file}`);
    }
  }
  if (restored > 0) {
    console.log(`Восстановлено на диск: ${restored}`);
  }

  console.log("\nГотово. Файлы не удалялись — только добавлялись и восстанавливались.");
}

main();
