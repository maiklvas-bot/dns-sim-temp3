import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, Rocket } from "lucide-react";
import type { SimulationRuntimeSettings } from "@shared/simulation-content";
import { useSimulation } from "@/context/SimulationContext";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BrandAccessShell, BrandMiniHeader } from "@/components/brand-access-shell";
import { primeAudioPlayback } from "@/data/audio-map";
import {
  joinRemoteLiveSimulation,
  resetLiveSimulation,
  setPendingLiveSimulationState,
  setLiveSimulationRole,
} from "@/lib/live-session";
import { BRAND_ASSETS, hideMissingBrandAsset } from "@/lib/brand-assets";
import { getSimulationContentSnapshot, getSimulationSettingsSnapshot, resolveSimulationBriefingHtml } from "@/lib/runtime-content";

export default function StudentJoinPage() {
  const [, navigate] = useLocation();
  const { dispatch } = useSimulation();
  const settings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  const briefingHtml = resolveSimulationBriefingHtml({
    instructionHtml: settings?.preSimulationInstructionHtml,
    instructionVideoAssetId: settings?.preSimulationInstructionVideoAssetId,
    assets: getSimulationContentSnapshot().assets,
  });
  const [accessCode, setAccessCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    const normalizedCode = accessCode.trim().toUpperCase();
    if (!normalizedCode) {
      setJoinError("Введите код сессии, который передал оценщик.");
      return;
    }

    setJoinError(null);
    setIsJoining(true);

    try {
      await primeAudioPlayback();
      dispatch({ type: "RESET" });
      resetLiveSimulation();
      const session = await joinRemoteLiveSimulation(normalizedCode);
      setPendingLiveSimulationState(session);
      setLiveSimulationRole("student");
      navigate("/simulation");
    } catch (error) {
      console.error("Failed to join live session", error);
      setJoinError("Сессия по этому коду не найдена или уже завершена.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <BrandAccessShell className="flex flex-col items-center justify-center">
      <main className="dns-access-content dns-access-content--form">
        <button
          onClick={() => navigate("/")}
          className="dns-access-back-button mb-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-[#8890a8] transition-colors hover:text-white"
          data-testid="back-to-role-select"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </button>

        <div className="dns-access-form-card rounded-2xl border border-[#2a3a4e] bg-[#1e2a3acc] p-6 backdrop-blur-sm shadow-2xl">
          <div className="dns-access-visual-strip">
            <BrandMiniHeader />
            <span className="dns-access-visual-strip-label">Команда рядом и поможет уверенно начать симуляцию.</span>
            <img
              className="dns-access-character dns-access-character--student"
              src={BRAND_ASSETS.heroes.alienPoint}
              alt="Фирменный alien DNS указывает участнику на вход в симуляцию"
              onError={hideMissingBrandAsset}
            />
          </div>

          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FF6B00]/30 bg-[#FF6B00]/10">
              <Rocket className="h-6 w-6 text-[#FF6B00]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Вход космонавта</h1>
              <p className="mt-1 text-sm text-[#8890a8]">Введите код, который выдаст оценщик после настройки симуляции.</p>
            </div>
          </div>

          <div className="dns-visual-hud rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">Как начать</div>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed text-[#c9d2e6]">
              <li>1. Дождитесь, пока оценщик настроит симуляцию.</li>
              <li>2. Получите от него 6-символьный код сессии.</li>
              <li>3. Введите код ниже и нажмите «Войти в сессию».</li>
            </ol>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Input
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
              maxLength={6}
              placeholder="КОД СЕССИИ"
              className="border-[#2a3a4e] bg-[#141c2b] text-center text-base font-semibold tracking-[0.45em] text-white placeholder:tracking-[0.3em] placeholder:text-[#4a5068]"
              data-testid="student-live-access-code"
            />
            <button
              onClick={handleJoin}
              disabled={isJoining}
              className="dns-visual-cta-glow rounded-lg border border-[#FF6B00]/45 bg-[#FF6B00] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e86000] disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="student-join-live-session"
            >
              {isJoining ? "Подключаем..." : "Войти в сессию"}
            </button>
          </div>

          {joinError && (
            <div className="mt-4 rounded-lg border border-[#d98f8f]/35 bg-[#d98f8f]/10 px-3 py-2 text-sm text-[#ffdede]">
              {joinError}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Dialog>
              <DialogTrigger asChild>
                <button className="inline-flex items-center gap-2 rounded-lg border border-[#2a3a4e] bg-[#141c2b]/60 px-4 py-2 text-xs text-[#8890a8] transition-all hover:border-[#3a4a5e] hover:text-white">
                  <BookOpen className="h-3.5 w-3.5" />
                  Инструктаж перед стартом
                </button>
              </DialogTrigger>
              <DialogContent className="dns-access-dialog max-w-3xl border-[#2a3a4e] bg-[#101826] p-0 text-white">
                <div className="max-h-[80vh] overflow-y-auto custom-scroll p-6">
                  <DialogHeader className="border-b border-[#2a3a4e] pb-4 text-left">
                    <DialogTitle className="flex items-center gap-2 text-xl text-white">
                      <BookOpen className="h-5 w-5 text-[#00d4aa]" />
                      Инструктаж перед стартом
                    </DialogTitle>
                    <DialogDescription className="text-sm text-[#8890a8]">
                      Перед подключением к сессии можно ещё раз посмотреть правила и видеоинструкцию.
                    </DialogDescription>
                  </DialogHeader>
                  <div
                    className="mt-5 space-y-4 text-sm leading-relaxed text-[#c9d2e6] [&_a]:text-[#8ec5ff] [&_a]:underline [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-white [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mb-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-[0.16em] [&_h3]:text-[#8ec5ff] [&_li+li]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_section+section]:mt-5 [&_section]:rounded-xl [&_section]:border [&_section]:border-[#2a3a4e] [&_section]:bg-[#141c2b]/70 [&_section]:p-4 [&_ul]:list-disc [&_ul]:pl-5 [&_video]:mt-3 [&_video]:w-full [&_video]:rounded-xl [&_video]:border [&_video]:border-[#31455f] [&_video]:bg-black"
                    dangerouslySetInnerHTML={{ __html: briefingHtml }}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </main>
    </BrandAccessShell>
  );
}
