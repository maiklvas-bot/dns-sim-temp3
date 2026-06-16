import { useId } from "react";
import type { CompetencyDefinition } from "@shared/simulation-content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SelectField({ label, value, onChange, options, emptyLabel = "Не выбрано" }: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  emptyLabel?: string;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-[#8890a8]">{label}</Label>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} className="dns-admin-select w-full rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white">
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

export function SuggestField({ label, value, onChange, options, placeholder = "Можно выбрать из готовых или ввести своё" }: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const listId = useId();
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-[#8890a8]">{label}</Label>
      <Input list={listId} value={value || ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="dns-admin-input border-[#2a3a4e] bg-[#141c2b] text-white" />
      <datalist id={listId}>{options.map((option) => <option key={option} value={option} />)}</datalist>
    </div>
  );
}

export function MultiSelectField({ label, values, onChange, options }: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const toggleValue = (targetValue: string) => {
    onChange(values.includes(targetValue) ? values.filter((value) => value !== targetValue) : [...values, targetValue]);
  };
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-[#8890a8]">{label}</Label>
      <div className="flex flex-wrap gap-2 rounded-xl border border-[#2a3a4e] bg-[#141c2b]/45 p-3">
        {options.map((option) => {
          const active = values.includes(option.value);
          return (
            <button key={option.value} type="button" onClick={() => toggleValue(option.value)} className={`rounded-full border px-3 py-1.5 text-xs transition-all ${active ? "border-[#4a9eff] bg-[#4a9eff]/15 text-white" : "border-[#2a3a4e] bg-[#101826]/60 text-[#9aabc6]"}`}>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CompetencyRoleSelector({ label = "Компетенции кейса", primaryValues, secondaryValues, onChange, competencies }: {
  label?: string;
  primaryValues: string[];
  secondaryValues: string[];
  onChange: (next: { primaryCompetencies: string[]; secondaryCompetencies: string[] }) => void;
  competencies: CompetencyDefinition[];
}) {
  const primarySet = new Set(primaryValues || []);
  const secondarySet = new Set(secondaryValues || []);
  const setRole = (competencyId: string, role: "none" | "primary" | "secondary") => {
    const nextPrimary = (primaryValues || []).filter((value) => value !== competencyId);
    const nextSecondary = (secondaryValues || []).filter((value) => value !== competencyId);
    if (role === "primary") nextPrimary.push(competencyId);
    if (role === "secondary") nextSecondary.push(competencyId);
    onChange({ primaryCompetencies: nextPrimary, secondaryCompetencies: nextSecondary });
  };

  return (
    <div>
      <Label className="mb-1.5 block text-xs text-[#8890a8]">{label}</Label>
      <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/45 p-3">
        <div className="mb-3 text-[11px] leading-relaxed text-[#9fb0ca]">Один список вместо двух блоков: первичная компетенция задаёт главный фокус кейса, вторичная добавляет дополнительный вес в оценке.</div>
        <div className="grid gap-2 lg:grid-cols-2">
          {competencies.map((competency) => {
            const role = primarySet.has(competency.id) ? "primary" : secondarySet.has(competency.id) ? "secondary" : "none";
            return (
              <div key={competency.id} className="rounded-lg border border-[#243244] bg-[#101826]/70 p-2">
                <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0"><div className="truncate text-xs font-semibold text-white">{competency.name}</div><div className="text-[10px] uppercase tracking-[0.14em] text-[#70829d]">{competency.category}</div></div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${role === "primary" ? "border-[#4a9eff]/50 bg-[#4a9eff]/15 text-[#b7d9ff]" : role === "secondary" ? "border-[#00d4aa]/45 bg-[#00d4aa]/12 text-[#8ff5de]" : "border-[#2a3a4e] bg-[#0d1522] text-[#7f91ad]"}`}>{role === "primary" ? "Первичная" : role === "secondary" ? "Вторичная" : "Не выбрана"}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {([["none", "Нет"], ["primary", "Первичная"], ["secondary", "Вторичная"]] as const).map(([targetRole, title]) => (
                    <button key={targetRole} type="button" onClick={() => setRole(competency.id, targetRole)} className={`rounded-md border px-2 py-1.5 text-[11px] transition ${role === targetRole ? "border-[#FF6B00] bg-[#FF6B00]/15 text-white" : "border-[#2a3a4e] bg-[#0d1522]/70 text-[#91a2bd] hover:border-[#3b5878]"}`}>{title}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Field({ label, value, onChange }: { label: string; value: any; onChange: (value: string) => void }) {
  return <div><Label className="mb-1.5 block text-xs text-[#8890a8]">{label}</Label><Input value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="dns-admin-input border-[#2a3a4e] bg-[#141c2b] text-white" /></div>;
}

export function FieldArea({ label, value, onChange, onBlur }: { label: string; value: any; onChange: (value: string) => void; onBlur?: () => void }) {
  return <div><Label className="mb-1.5 block text-xs text-[#8890a8]">{label}</Label><Textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} className="dns-admin-textarea min-h-[120px] border-[#2a3a4e] bg-[#141c2b] text-white" /></div>;
}
