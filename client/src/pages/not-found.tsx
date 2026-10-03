import { useLocation } from "wouter";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-[#f68b1f] mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Страница не найдена</h1>
        <p className="text-sm text-muted-foreground mb-6">Запрошенная страница не существует</p>
        <Button
          onClick={() => navigate("/")}
          className="bg-[#f68b1f] hover:bg-[#e06000] text-white"
        >
          На главную
        </Button>
      </div>
    </div>
  );
}
