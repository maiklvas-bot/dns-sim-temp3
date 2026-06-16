import { ArrowRight, CheckCircle2, Rocket, Shield, UserCheck } from "lucide-react";

const STEPS = [
  { num: 1, label: "Кто участник?", icon: UserCheck },
  { num: 2, label: "Уровень сложности", icon: Shield },
  { num: 3, label: "Запуск", icon: Rocket },
];

export function WizardSteps({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = step.num === currentStep;
        const isDone = step.num < currentStep;

        return (
          <div key={step.num} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 rounded-full border px-4 py-2.5 transition-all ${
                isActive
                  ? "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]"
                  : isDone
                    ? "border-[#00C853] bg-[#00C853]/10 text-[#00C853]"
                    : "border-[#2a3a4e] bg-[#141c2b]/50 text-[#6f7990]"
              }`}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              <span className="whitespace-nowrap text-xs font-medium">{step.label}</span>
            </div>
            {index < STEPS.length - 1 && <ArrowRight className="h-4 w-4 flex-shrink-0 text-[#3a4a5e]" />}
          </div>
        );
      })}
    </div>
  );
}
