import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import storeBg from "@assets/store_bg.png";

export default function StaffLoginPage() {
  const [, navigate] = useLocation();
  const [role, setRole] = useState<"admin" | "evaluator">("evaluator");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError("Введите логин и пароль");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await apiRequest("POST", "/api/staff/login", { role, username: trimmedUsername, password: trimmedPassword });
      const principal = await response.json();
      queryClient.setQueryData(["/api/staff/me"], principal);
      navigate(principal.role === "admin" ? "/admin" : "/evaluator");
    } catch (err: any) {
      setError(err.message || "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        backgroundImage: `url(${storeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2eee] via-[#16213ef0] to-[#1a1a2eee]" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#2a3a4e] bg-[#1e2a3acc] p-6 backdrop-blur-sm">
        <h1 className="text-xl font-bold text-white mb-2">Служебный вход</h1>
        <p className="text-sm text-[#8890a8] mb-5">Отдельный доступ для оценщика и администратора</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setRole("evaluator")}
            className={`rounded-lg border px-3 py-2 text-sm transition-all ${role === "evaluator" ? "border-[#FF6B00] bg-[#FF6B00]/10 text-white" : "border-[#2a3a4e] text-[#8890a8]"}`}
          >
            Оценщик
          </button>
          <button
            onClick={() => setRole("admin")}
            className={`rounded-lg border px-3 py-2 text-sm transition-all ${role === "admin" ? "border-[#00d4aa] bg-[#00d4aa]/10 text-white" : "border-[#2a3a4e] text-[#8890a8]"}`}
          >
            Администратор
          </button>
        </div>

        <div
          className="space-y-4"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        >
          <div>
            <Label className="text-xs text-[#8890a8] mb-1.5 block">Логин</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="bg-[#141c2b] border-[#2a3a4e] text-white" />
          </div>
          <div>
            <Label className="text-xs text-[#8890a8] mb-1.5 block">Пароль</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-[#141c2b] border-[#2a3a4e] text-white" />
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg border border-[#ff4444]/40 bg-[#ff4444]/10 px-3 py-2 text-sm text-[#ff8f8f]">{error}</div>}

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1 border-[#2a3a4e] text-[#8890a8] bg-transparent" onClick={() => navigate("/")}>
            Назад
          </Button>
          <Button className="flex-1 bg-[#FF6B00] hover:bg-[#e06000]" onClick={() => void handleSubmit()} disabled={loading}>
            {loading ? "Вход..." : "Войти"}
          </Button>
        </div>
      </div>
    </div>
  );
}
