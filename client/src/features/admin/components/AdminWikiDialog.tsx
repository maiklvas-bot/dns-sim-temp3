import { BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ADMIN_WIKI_CONTENT } from "../admin-wiki-content";
import type { AdminTabKey } from "../admin-types";

export function AdminWikiDialog({
  open,
  onOpenChange,
  tab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: AdminTabKey;
}) {
  const wiki = ADMIN_WIKI_CONTENT[tab];
  const sections = [
    { title: "Пошаговая инструкция", items: wiki.steps },
    { title: "Описание полей", items: wiki.fields },
    { title: "Частые ошибки", items: wiki.mistakes },
    { title: "Чек-лист перед запуском", items: wiki.checklist },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto border-[#2a3a4e] bg-[#101826] text-white custom-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BookOpen className="h-5 w-5 text-[#FF6B00]" />
            {wiki.title}
          </DialogTitle>
          <DialogDescription className="text-[#9fb0ca]">{wiki.purpose}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.title} className="rounded-xl border border-[#243244] bg-[#141c2b]/70 p-4">
              <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8ec5ff]">{section.title}</div>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#d5e2f4]">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#FF6B00]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[#FF6B00]/35 bg-[#FF6B00]/10 p-4 text-sm leading-relaxed text-[#ffe1cb]">
          <div className="mb-1 font-semibold text-[#ffb27a]">Пример настройки</div>
          {wiki.example}
        </div>
      </DialogContent>
    </Dialog>
  );
}
