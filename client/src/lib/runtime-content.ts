import type { PublicMediaAsset, PublicSimulationContent } from "@shared/simulation-content";

export const EMPTY_SIMULATION_CONTENT: PublicSimulationContent = {
  competencies: [],
  cases: [],
  emailCases: [],
  messengerCases: [],
  messengerChats: [],
  videoCases: [],
  assets: [],
};

let simulationContentSnapshot: PublicSimulationContent = EMPTY_SIMULATION_CONTENT;
let simulationSettingsSnapshot: Record<string, unknown> | null = null;

export const SIMULATION_BRIEFING_VIDEO_PLACEHOLDER = "{{instructionVideoBlock}}";

export const SIMULATION_BRIEFING_VIDEO_SNIPPET = `<section>
  <h3>Видеоинструктаж</h3>
  <p>Перед началом симуляции посмотрите короткое видео с вводными и правилами работы.</p>
  ${SIMULATION_BRIEFING_VIDEO_PLACEHOLDER}
</section>`;

export const DEFAULT_SIMULATION_BRIEFING_HTML = `<section>
  <h3>Как проходит симуляция</h3>
  <ul>
    <li>Вы входите по коду, который выдаёт оценщик после настройки сценария.</li>
    <li>Во время прохождения в систему поступают звонки, письма, сообщения и видеообращения.</li>
    <li>На каждый сигнал нужно вовремя открыть ситуацию, оценить контекст и выбрать управленческое действие.</li>
  </ul>
</section>
<section>
  <h3>Что влияет на результат</h3>
  <ul>
    <li>Каждое решение влияет на метрики магазина, скорость реакции и профиль компетенций.</li>
    <li>Просрочка по таймеру может уменьшить итоговый балл даже у сильного решения.</li>
    <li>В конце учитываются ответы, динамика метрик и соблюдение сроков.</li>
  </ul>
</section>
${SIMULATION_BRIEFING_VIDEO_SNIPPET}
<section>
  <h3>Что будет после завершения</h3>
  <p>После окончания откроется экран результатов с итоговыми метриками, баллами и профилем компетенций.</p>
</section>`;

function isSafeUrl(value: string) {
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(value);
}

function isSafeMediaUrl(value: string) {
  return /^(https?:\/\/|\/|data:video\/)/i.test(value);
}

function sanitizeSimulationBriefingHtml(input: string) {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return input.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(input, "text/html");
  const safeDocument = document.implementation.createHTMLDocument("");
  const allowedTags = new Set([
    "a",
    "article",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "hr",
    "i",
    "li",
    "ol",
    "p",
    "pre",
    "section",
    "source",
    "span",
    "strong",
    "u",
    "ul",
    "video",
  ]);
  const booleanAttributes = new Set(["controls", "autoplay", "muted", "loop", "playsinline"]);

  const sanitizeNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return safeDocument.createTextNode(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    if (!allowedTags.has(tagName)) {
      const fragment = safeDocument.createDocumentFragment();
      Array.from(element.childNodes).forEach((child) => {
        const sanitizedChild = sanitizeNode(child);
        if (sanitizedChild) {
          fragment.appendChild(sanitizedChild);
        }
      });
      return fragment;
    }

    const cleanElement = safeDocument.createElement(tagName);
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();

      if (!value && !booleanAttributes.has(name)) {
        return;
      }

      if (tagName === "a" && ["href", "target", "rel", "title"].includes(name)) {
        if (name === "href" && !isSafeUrl(value)) {
          return;
        }
        cleanElement.setAttribute(name, value);
        return;
      }

      if (tagName === "video" && ["controls", "autoplay", "muted", "loop", "playsinline", "preload", "poster", "src"].includes(name)) {
        if ((name === "src" || name === "poster") && !isSafeMediaUrl(value)) {
          return;
        }
        cleanElement.setAttribute(name, booleanAttributes.has(name) ? "" : value);
        return;
      }

      if (tagName === "source" && ["src", "type"].includes(name)) {
        if (name === "src" && !isSafeMediaUrl(value)) {
          return;
        }
        cleanElement.setAttribute(name, value);
      }
    });

    Array.from(element.childNodes).forEach((child) => {
      const sanitizedChild = sanitizeNode(child);
      if (sanitizedChild) {
        cleanElement.appendChild(sanitizedChild);
      }
    });

    return cleanElement;
  };

  const fragment = safeDocument.createDocumentFragment();
  Array.from(parsed.body.childNodes).forEach((node) => {
    const sanitizedNode = sanitizeNode(node);
    if (sanitizedNode) {
      fragment.appendChild(sanitizedNode);
    }
  });

  const wrapper = safeDocument.createElement("div");
  wrapper.appendChild(fragment);
  return wrapper.innerHTML;
}

function buildSimulationBriefingVideoBlock(videoUrl: string) {
  return `<div>
    <video controls playsinline preload="metadata">
      <source src="${videoUrl}" />
      Ваш браузер не поддерживает воспроизведение видео.
    </video>
  </div>`;
}

export function setSimulationContentSnapshot(content: PublicSimulationContent, settings?: Record<string, unknown> | null) {
  simulationContentSnapshot = content;
  simulationSettingsSnapshot = settings || null;
}

export function getSimulationContentSnapshot(): PublicSimulationContent {
  return simulationContentSnapshot;
}

export function getSimulationSettingsSnapshot<T>() {
  return simulationSettingsSnapshot as T | null;
}

export function resolveSimulationBriefingHtml(params: {
  instructionHtml?: string | null;
  instructionVideoAssetId?: string | null;
  assets?: PublicMediaAsset[];
}) {
  const { instructionHtml, instructionVideoAssetId, assets = [] } = params;
  const rawHtml = (instructionHtml || "").trim() || DEFAULT_SIMULATION_BRIEFING_HTML;
  const instructionVideoUrl =
    instructionVideoAssetId
      ? assets.find((asset) => asset.id === instructionVideoAssetId)?.publicUrl || null
      : null;

  const videoBlock = instructionVideoUrl ? buildSimulationBriefingVideoBlock(instructionVideoUrl) : "";
  const htmlWithVideo = rawHtml.includes(SIMULATION_BRIEFING_VIDEO_PLACEHOLDER)
    ? rawHtml.replaceAll(SIMULATION_BRIEFING_VIDEO_PLACEHOLDER, videoBlock)
    : instructionVideoUrl
      ? `${rawHtml}\n${SIMULATION_BRIEFING_VIDEO_SNIPPET.replace(SIMULATION_BRIEFING_VIDEO_PLACEHOLDER, videoBlock)}`
      : rawHtml;

  return sanitizeSimulationBriefingHtml(htmlWithVideo);
}

export function createRuntimeArrayProxy<T>(selector: () => T[]): T[] {
  return new Proxy([] as T[], {
    get(_target, property) {
      const current = selector();
      const value = Reflect.get(current as unknown as object, property);
      return typeof value === "function" ? value.bind(current) : value;
    },
    ownKeys() {
      return Reflect.ownKeys(selector() as unknown as object);
    },
    getOwnPropertyDescriptor(_target, property) {
      return Object.getOwnPropertyDescriptor(selector() as unknown as object, property);
    },
  });
}
