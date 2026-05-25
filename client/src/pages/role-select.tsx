import { useLocation } from "wouter";
import { BookOpen, Shield, Rocket } from "lucide-react";
import { clearLiveSimulationRole, resetLiveSimulation } from "@/lib/live-session";
import type { SimulationRuntimeSettings } from "@shared/simulation-content";
import { getSimulationContentSnapshot, getSimulationSettingsSnapshot, resolveSimulationBriefingHtml } from "@/lib/runtime-content";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import storeBg from "@assets/store_bg.png";

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
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${storeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2eee] via-[#16213ef0] to-[#1a1a2eee]" />

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-8 px-4">
        <div className="mb-4 text-center">
          <div className="mb-3 flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF6B00]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-label="DNS Sim">
                <rect x="3" y="3" width="7" height="7" rx="1" fill="white"/>
                <rect x="14" y="3" width="7" height="7" rx="1" fill="white" opacity="0.6"/>
                <rect x="3" y="14" width="7" height="7" rx="1" fill="white" opacity="0.6"/>
                <rect x="14" y="14" width="7" height="7" rx="1" fill="white" opacity="0.3"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              DNS <span className="text-[#FF6B00]">SimCenter</span>
            </h1>
          </div>
          <p className="text-sm text-[#a0a0b8]">
            Симуляция рабочего дня заместителя управляющего магазином
          </p>
        </div>

        <div className="grid w-full max-w-xl grid-cols-1 gap-6">
          <button
            onClick={handleStudentRoute}
            className="group relative cursor-pointer rounded-xl border border-[#2a3a4e] bg-[#1e2a3acc] p-8 text-left backdrop-blur-sm transition-all duration-300 hover:border-[#00d4aa]"
            data-testid="role-participant"
          >
            <div className="absolute left-0 right-0 top-0 h-[2px] rounded-t-xl bg-gradient-to-r from-transparent via-[#00d4aa] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 transition-colors group-hover:bg-[#00d4aa]/20">
                <Rocket className="h-8 w-8 text-[#00d4aa]" />
              </div>
              <div>
                <h2 className="mb-2 text-xl font-bold tracking-wide text-white">КОСМОНАВТ</h2>
                <p className="text-sm leading-relaxed text-[#8890a8]">
                  Вход в симуляцию по коду сессии. Код выдаёт оценщик после настройки сценария.
                </p>
              </div>
              <div className="mt-2 rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-5 py-2 text-xs font-medium uppercase tracking-wider text-[#00d4aa] transition-colors group-hover:bg-[#00d4aa]/20">
                Перейти к вводу кода →
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={() => navigate("/staff-login")}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#2a3a4e] bg-[#141c2b]/60 px-4 py-2 text-xs text-[#8890a8] transition-all hover:border-[#3a4a5e] hover:text-white"
        >
          <Shield className="h-3.5 w-3.5" />
          Служебный вход
        </button>

        <Dialog>
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-2 rounded-lg border border-[#2a3a4e] bg-[#141c2b]/60 px-4 py-2 text-xs text-[#8890a8] transition-all hover:border-[#3a4a5e] hover:text-white">
              <BookOpen className="h-3.5 w-3.5" />
              Инструкция
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl border-[#2a3a4e] bg-[#101826] p-0 text-white">
            <div className="max-h-[80vh] overflow-y-auto custom-scroll p-6">
              <DialogHeader className="border-b border-[#2a3a4e] pb-4 text-left">
                <DialogTitle className="flex items-center gap-2 text-xl text-white">
                  <BookOpen className="h-5 w-5 text-[#00d4aa]" />
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

        <p className="mt-2 text-xs text-[#555570]">
          Версия 3.0 • Контент и результаты хранятся в БД
        </p>
      </div>
    </div>
  );
}
