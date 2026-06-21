import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { BrandAccessShell, BrandMiniHeader } from "@/components/brand-access-shell";
import { ProductFooter } from "@/components/product-footer";
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
      // Отмечаем подтверждение админ-доступа (грейс 10 минут для возврата из оценщика без пароля).
      if (principal.role === "admin") {
        try { localStorage.setItem("dns-admin-confirmed-at", String(Date.now())); } catch { /* нет storage */ }
      }
      navigate(principal.role === "admin" ? "/admin" : "/evaluator");
    } catch (err: any) {
      setError(err.message || "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BrandAccessShell className="flex items-center justify-center">
      <main className="dns-ios-login-wrap">
        <div className="dns-ios-login">
          <div className="dns-ios-login__brand">
            <BrandMiniHeader />
            <img
              key={role}
              className="dns-ios-login__mascot"
              src={getStaffBrandHero(role)}
              alt={role === "evaluator" ? "Фирменный alien DNS наблюдает за запуском сессии" : "Фирменный alien DNS работает за компьютером"}
              onError={hideMissingBrandAsset}
            />
          </div>

          <h1 className="dns-ios-login__title">Служебный вход</h1>
          <p className="dns-ios-login__subtitle">
            {role === "evaluator" ? "Оценщик сопровождает запуск сессии." : "Администратор поддерживает рабочую среду."}
          </p>

          <div className="dns-ios-segmented" role="tablist" aria-label="Роль доступа">
            <span className="dns-ios-segmented__thumb" data-role={role} aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={role === "evaluator"}
              className="dns-ios-segmented__seg"
              onClick={() => setRole("evaluator")}
              disabled={loading}
            >
              Оценщик
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === "admin"}
              className="dns-ios-segmented__seg"
              onClick={() => setRole("admin")}
              disabled={loading}
            >
              Администратор
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="dns-ios-field-group">
              <Label htmlFor="staff-login-username" className="sr-only">Логин</Label>
              <input
                id="staff-login-username"
                className="dns-ios-field__input"
                placeholder="Логин"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError("");
                  if (fieldErrors.username) setFieldErrors((current) => ({ ...current, username: undefined }));
                }}
                disabled={loading}
                autoComplete="username"
                autoFocus
                aria-invalid={Boolean(fieldErrors.username)}
                data-testid="staff-login-username"
              />
              <div className="dns-ios-field-sep" />
              <Label htmlFor="staff-login-password" className="sr-only">Пароль</Label>
              <input
                id="staff-login-password"
                type="password"
                className="dns-ios-field__input"
                placeholder="Пароль"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                  if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
                }}
                disabled={loading}
                autoComplete="current-password"
                aria-invalid={Boolean(fieldErrors.password)}
                data-testid="staff-login-password"
              />
            </div>

            {error && <div className="dns-ios-error" role="alert">{error}</div>}

            <button type="submit" className="dns-ios-primary" disabled={loading} data-testid="staff-login-submit">
              {loading ? "Вход…" : "Войти"}
            </button>
            <button type="button" className="dns-ios-ghost" onClick={() => navigate("/")} disabled={loading}>
              Назад
            </button>
          </form>
        </div>
      </main>
      <ProductFooter className="fixed inset-x-0 bottom-0" version="" />
    </BrandAccessShell>
  );
}
