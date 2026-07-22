export interface LogoSceneProps {
  title: string;
  subtitle: string;
}

export interface TextSceneProps {
  text: string;
}

export interface ScreenshotSceneProps {
  headline: string;
  subheadline?: string;
  screenshot: string;
}

export interface PdfSceneProps {
  headline: string;
  screenshot: string;
}

export type Scene =
  | { id: string; kind: "logo"; durationInFrames: number; props: LogoSceneProps }
  | { id: string; kind: "text"; durationInFrames: number; props: TextSceneProps }
  | { id: string; kind: "screenshot"; durationInFrames: number; props: ScreenshotSceneProps }
  | { id: string; kind: "pdf"; durationInFrames: number; props: PdfSceneProps };

export const SCENES: Scene[] = [
  {
    id: "title",
    kind: "logo",
    durationInFrames: 240,
    props: {
      title: "DNS SimCenter",
      subtitle: "Тренажёр управленческой готовности",
    },
  },
  {
    id: "problem",
    kind: "text",
    durationInFrames: 420,
    props: {
      text: "Каждый день — решения, которые негде потренировать. Ошибка на практике стоит дорого.",
    },
  },
  {
    id: "solution",
    kind: "screenshot",
    durationInFrames: 480,
    props: {
      headline: "Поэтому появился SimCenter",
      screenshot: "screenshots/role-select.png",
    },
  },
  {
    id: "how-it-works-launch",
    kind: "screenshot",
    durationInFrames: 600,
    props: {
      headline: "Оценщик запускает live-сессию — вам приходит код доступа",
      screenshot: "screenshots/evaluator-console.png",
    },
  },
  {
    id: "how-it-works-cases",
    kind: "screenshot",
    durationInFrames: 720,
    props: {
      headline:
        "Вы попадаете в симуляцию: почта, мессенджер, видеозвонки — реальные дилеммы бизнеса",
      screenshot: "screenshots/simulation-live.png",
    },
  },
  {
    id: "how-it-works-competencies",
    kind: "screenshot",
    durationInFrames: 660,
    props: {
      headline: "Пока вы принимаете решения — система строит ваш профиль компетенций",
      screenshot: "screenshots/results-competencies.png",
    },
  },
  {
    id: "pdf-report",
    kind: "pdf",
    durationInFrames: 420,
    props: {
      headline: "Полный отчёт: сильные стороны и зоны роста",
      screenshot: "screenshots/results-competencies.png",
    },
  },
  {
    id: "growth-pitch",
    kind: "screenshot",
    durationInFrames: 540,
    props: {
      headline: "Это не экзамен. Это тренажёр вашего роста.",
      subheadline: "Впереди — новые симуляции",
      screenshot: "screenshots/zrd-board.png",
    },
  },
  {
    id: "cta",
    kind: "logo",
    durationInFrames: 420,
    props: {
      title: "Участвуйте в SimCenter",
      subtitle: "Обратитесь к вашему HR-партнёру за кодом доступа",
    },
  },
];
