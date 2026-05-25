import { useLocation } from "wouter";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-[#FF6B00] mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Страница не найдена</h1>
        <p className="text-sm text-[#8890a8] mb-6">Запрошенная страница не существует</p>
        <Button
          onClick={() => navigate("/")}
          className="bg-[#FF6B00] hover:bg-[#e06000] text-white"
        >
          На главную
        </Button>
      </div>
    </div>
  );
}
