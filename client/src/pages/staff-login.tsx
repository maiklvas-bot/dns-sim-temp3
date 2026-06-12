import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandAccessShell, BrandMiniHeader } from "@/components/brand-access-shell";
import { getStaffBrandHero, hideMissingBrandAsset } from "@/lib/brand-assets";

export default function StaffLoginPage() {
  const [, navigate] = useLocation();
  const [role, setRole] = useState<"admin" | "evaluator">("evaluator");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (loading) {
      return;
    }

    const trimmedUsername = username.trim();
    const nextFieldErrors = {
      username: trimmedUsername ? undefined : "Введите логин",
      password: password ? undefined : "Введите пароль",
    };

    if (nextFieldErrors.username || nextFieldErrors.password) {
      setFieldErrors(nextFieldErrors);
      setError(
        nextFieldErrors.username && nextFieldErrors.password
          ? "Введите логин и пароль"
          : nextFieldErrors.username
            ? "Введите логин"
            : "Введите пароль",
      );
      return;
    }

    setLoading(true);
    setFieldErrors({});
    setError("");
    try {
      const response = await apiRequest("POST", "/api/staff/login", { role, username: trimmedUsername, password });
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
    <BrandAccessShell className="flex items-center justify-center">
      <main className="dns-access-content dns-access-content--staff">
        <div className="dns-access-form-card w-full max-w-md rounded-2xl border border-[#2a3a4e] bg-[#1e2a3acc] p-6 backdrop-blur-sm">
          <div className="dns-access-visual-strip dns-access-visual-strip--staff">
            <BrandMiniHeader />
            <span className="dns-access-visual-strip-label">
              {role === "evaluator" ? "Оценщик сопровождает запуск сессии." : "Администратор поддерживает рабочую среду."}
            </span>
            <img
              key={role}
              className={`dns-access-character dns-access-character--${role}`}
              src={getStaffBrandHero(role)}
              alt={role === "evaluator" ? "Фирменный alien DNS наблюдает за запуском сессии" : "Фирменный alien DNS работает за компьютером"}
              onError={hideMissingBrandAsset}
            />
          </div>

          <h1 className="text-xl font-bold text-white mb-2">Служебный вход</h1>
          <p className="text-sm text-[#8890a8] mb-5">Отдельный доступ для оценщика и администратора</p>

          <div className="dns-access-role-switch grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => setRole("evaluator")}
              disabled={loading}
              className={`rounded-lg border px-3 py-2 text-sm transition-all ${role === "evaluator" ? "border-[#FF6B00] bg-[#FF6B00]/10 text-white" : "border-[#2a3a4e] text-[#8890a8]"}`}
            >
              Оценщик
            </button>
            <button
              type="button"
              onClick={() => setRole("admin")}
              disabled={loading}
              className={`rounded-lg border px-3 py-2 text-sm transition-all ${role === "admin" ? "border-[#00d4aa] bg-[#00d4aa]/10 text-white" : "border-[#2a3a4e] text-[#8890a8]"}`}
            >
              Администратор
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <Label htmlFor="staff-login-username" className="text-xs text-[#8890a8] mb-1.5 block">Логин</Label>
              <Input
                id="staff-login-username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) {
                    setError("");
                  }
                  if (fieldErrors.username) {
                    setFieldErrors((current) => ({ ...current, username: undefined }));
                  }
                }}
                disabled={loading}
                autoComplete="username"
                autoFocus
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? "staff-login-username-error" : undefined}
                className="bg-[#141c2b] border-[#2a3a4e] text-white"
                data-testid="staff-login-username"
              />
              {fieldErrors.username && (
                <div id="staff-login-username-error" className="mt-1.5 text-xs text-[#ff9a9a]">
                  {fieldErrors.username}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="staff-login-password" className="text-xs text-[#8890a8] mb-1.5 block">Пароль</Label>
              <Input
                id="staff-login-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) {
                    setError("");
                  }
                  if (fieldErrors.password) {
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                  }
                }}
                disabled={loading}
                autoComplete="current-password"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "staff-login-password-error" : undefined}
                className="bg-[#141c2b] border-[#2a3a4e] text-white"
                data-testid="staff-login-password"
              />
              {fieldErrors.password && (
                <div id="staff-login-password-error" className="mt-1.5 text-xs text-[#ff9a9a]">
                  {fieldErrors.password}
                </div>
              )}
            </div>

            {error && <div className="rounded-lg border border-[#ff4444]/40 bg-[#ff4444]/10 px-3 py-2 text-sm text-[#ff8f8f]">{error}</div>}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1 border-[#2a3a4e] text-[#8890a8] bg-transparent" onClick={() => navigate("/")} disabled={loading}>
                Назад
              </Button>
              <Button type="submit" className="flex-1 bg-[#FF6B00] hover:bg-[#e06000]" disabled={loading} data-testid="staff-login-submit">
                {loading ? "Вход..." : "Войти"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </BrandAccessShell>
  );
}
