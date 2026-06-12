import { useLocation } from "wouter";
import {
  BarChart3,
  BookOpen,
  Boxes,
  MessageCircleMore,
  Rocket,
  Shield,
  Sparkles,
  Target,
} from "lucide-react";

import { BrandAccessShell, BrandLogo } from "@/components/brand-access-shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BRAND_ASSETS, hideMissingBrandAsset } from "@/lib/brand-assets";
import { clearLiveSimulationRole, resetLiveSimulation } from "@/lib/live-session";
import {
  getSimulationContentSnapshot,
  getSimulationSettingsSnapshot,
  resolveSimulationBriefingHtml,
} from "@/lib/runtime-content";
import type { SimulationRuntimeSettings } from "@shared/simulation-content";

export default function RoleSelectPage() {
  const [, navigate] = useLocation();
  const settings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  const briefingHtml = resolveSimulationBriefingHtml({
    instructionHtml: settings?.preSimulationInstructionHtml,
    instructionVideoAssetId: settings?.preSimulationInstructionVideoAssetId,
    assets: getSimulationContentSnapshot().assets,
  });

  const handleStudentRoute = () => {
    clearLiveSimulationRole();
    resetLiveSimulation();
    navigate("/student");
  };

  return (
    <BrandAccessShell className="dns-home-shell">
      <main className="dns-home-hero">
        <header className="dns-home-header">
          <BrandLogo />
          <div className="dns-home-header__copy">
            <h1>DNS SimCenter</h1>
            <p>Симуляция рабочего дня заместителя управляющего магазином</p>
          </div>
        </header>

        <section className="dns-home-stage">
          <aside
            className="dns-home-character-zone dns-home-character-zone--left"
            aria-label="Помощник приветствует участника"
          >
            <div className="dns-home-character-glow" aria-hidden="true" />
            <img
              className="dns-home-character dns-home-character--welcome"
              src={BRAND_ASSETS.heroes.alienWelcome}
              alt="Дружелюбный помощник DNS указывает на вход в симуляцию"
              onError={hideMissingBrandAsset}
            />
            <article className="dns-home-hud dns-home-hud--left">
              <span className="dns-home-hud__icon">
                <Target />
              </span>
              <div>
                <strong>Практика без риска</strong>
                <p>Решай рабочие ситуации в безопасной среде.</p>
              </div>
            </article>
          </aside>

          <section className="dns-home-entry-card" aria-labelledby="dns-home-role-title">
            <div className="dns-home-entry-card__edge" aria-hidden="true" />
            <div className="dns-home-entry-card__orbit" aria-hidden="true">
              <span>
                <Rocket />
              </span>
            </div>

            <div className="dns-home-entry-card__content">
              <div className="dns-home-entry-card__eyebrow">
                <Sparkles />
                Начать рабочий день
              </div>
              <h2 id="dns-home-role-title">КОСМОНАВТ</h2>
              <p>
                Вход в симуляцию по коду сессии. Код выдаёт оценщик после настройки сценария.
              </p>

              <button
                type="button"
                onClick={handleStudentRoute}
                className="dns-home-primary-action dns-visual-cta-glow"
                data-testid="role-participant"
              >
                <span className="dns-home-primary-action__icon">
                  <Rocket />
                </span>
                <span>Перейти к вводу кода</span>
                <span className="dns-home-primary-action__arrow" aria-hidden="true">
                  →
                </span>
              </button>

              <div className="dns-home-secondary-actions">
                <button
                  type="button"
                  onClick={() => navigate("/staff-login")}
                  className="dns-home-secondary-action"
                >
                  <Shield />
                  Служебный вход
                </button>

                <Dialog>
                  <DialogTrigger asChild>
                    <button type="button" className="dns-home-secondary-action">
                      <BookOpen />
                      Инструкция
                    </button>
                  </DialogTrigger>
                  <DialogContent className="dns-access-dialog max-w-3xl border-[#2a3a4e] bg-[#101826] p-0 text-white">
                    <div className="max-h-[80vh] overflow-y-auto custom-scroll p-6">
                      <DialogHeader className="border-b border-[#2a3a4e] pb-4 text-left">
                        <DialogTitle className="flex items-center gap-2 text-xl text-white">
                          <BookOpen className="h-5 w-5 text-[#FF6B00]" />
                          Инструкция для космонавта
                        </DialogTitle>
                        <DialogDescription className="text-sm text-[#8890a8]">
                          Коротко о том, как устроена симуляция, что влияет на результат и что вы увидите на экране.
                        </DialogDescription>
                      </DialogHeader>

                      {briefingHtml?.trim() ? (
                        <div
                          className="mt-5 space-y-4 text-sm leading-relaxed text-[#c9d2e6] [&_a]:text-[#8ec5ff] [&_a]:underline [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mb-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-[0.16em] [&_h3]:text-[#8ec5ff] [&_li+li]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_section+section]:mt-5 [&_section]:rounded-xl [&_section]:border [&_section]:border-[#2a3a4e] [&_section]:bg-[#141c2b]/70 [&_section]:p-4 [&_ul]:list-disc [&_ul]:pl-5 [&_video]:mt-3 [&_video]:w-full [&_video]:rounded-xl [&_video]:border [&_video]:border-[#31455f] [&_video]:bg-black"
                          dangerouslySetInnerHTML={{ __html: briefingHtml }}
                        />
                      ) : (
                        <div className="mt-5 rounded-xl border border-dashed border-[#2a3a4e] bg-[#141c2b]/60 p-4 text-sm text-[#9aa3bb]">
                          Инструкция пока не загружена. Обратитесь к оценщику или администратору, чтобы проверить контент симуляции.
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <p className="dns-home-entry-card__footer">
                Версия 3.0 <span aria-hidden="true">•</span> Контент и результаты хранятся в БД
              </p>
            </div>
          </section>

          <aside
            className="dns-home-character-zone dns-home-character-zone--right"
            aria-label="Помощник анализирует результаты"
          >
            <div className="dns-home-character-glow" aria-hidden="true" />
            <div className="dns-home-analyst-scene">
              <span className="dns-home-monitor-light" aria-hidden="true" />
              <img
                className="dns-home-character dns-home-character--analyst"
                src={BRAND_ASSETS.heroes.alienAnalyst}
                alt="Помощник DNS с ноутбуком анализирует решения"
                onError={hideMissingBrandAsset}
              />
              <span className="dns-home-keyboard-taps" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
            <article className="dns-home-hud dns-home-hud--right">
              <span className="dns-home-hud__icon dns-home-hud__icon--blue">
                <BarChart3 />
              </span>
              <div>
                <strong>Анализ решений</strong>
                <p>Получай обратную связь и развивай навыки.</p>
              </div>
            </article>
          </aside>
        </section>

        <section className="dns-home-benefits" aria-label="Преимущества симуляции">
          <article>
            <span className="dns-home-benefit-icon" tabIndex={0} aria-describedby="dns-benefit-safe">
              <Target />
            </span>
            <div>
              <strong>Практика без риска</strong>
              <p>Без последствий для магазина</p>
            </div>
            <span id="dns-benefit-safe" className="dns-home-benefit-cloud" role="tooltip">
              Можно экспериментировать с решениями без последствий для реального магазина. Ошибки становятся материалом для разбора.
            </span>
          </article>
          <article>
            <span className="dns-home-benefit-icon" tabIndex={0} aria-describedby="dns-benefit-skills">
              <Sparkles />
            </span>
            <div>
              <strong>Развитие навыков</strong>
              <p>Решения становятся увереннее</p>
            </div>
            <span id="dns-benefit-skills" className="dns-home-benefit-cloud" role="tooltip">
              Симуляция тренирует планирование, коммуникацию, делегирование и ответственность. Повторные прохождения закрепляют сильные решения.
            </span>
          </article>
          <article>
            <span className="dns-home-benefit-icon" tabIndex={0} aria-describedby="dns-benefit-scenarios">
              <Boxes />
            </span>
            <div>
              <strong>Реальные сценарии</strong>
              <p>Ситуации из рабочего дня</p>
            </div>
            <span id="dns-benefit-scenarios" className="dns-home-benefit-cloud" role="tooltip">
              Кейсы охватывают смену, клиентов, команду и операционные задачи магазина. Ситуации развиваются в зависимости от выбранных действий.
            </span>
          </article>
          <article>
            <span className="dns-home-benefit-icon" tabIndex={0} aria-describedby="dns-benefit-feedback">
              <MessageCircleMore />
            </span>
            <div>
              <strong>Обратная связь</strong>
              <p>Результаты и рекомендации</p>
            </div>
            <span id="dns-benefit-feedback" className="dns-home-benefit-cloud" role="tooltip">
              После прохождения формируется оценка компетенций и рекомендации. Оценщик видит ход решений и может провести предметный разбор.
            </span>
          </article>
        </section>
      </main>
    </BrandAccessShell>
  );
}
