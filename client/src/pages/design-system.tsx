import { useDnsTheme, ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const COLOR_TOKENS = [
  { name: "background", label: "Background" },
  { name: "foreground", label: "Foreground" },
  { name: "card", label: "Card" },
  { name: "primary", label: "Primary" },
  { name: "secondary", label: "Secondary" },
  { name: "muted", label: "Muted" },
  { name: "accent", label: "Accent" },
  { name: "destructive", label: "Destructive" },
  { name: "dns-success", label: "Success" },
  { name: "dns-warning", label: "Warning" },
  { name: "dns-info", label: "Info" },
] as const;

const BRAND_TOKENS = [
  { name: "dns-navy", label: "Navy" },
  { name: "dns-orange", label: "Orange" },
  { name: "dns-blue", label: "Blue" },
  { name: "dns-teal", label: "Teal" },
  { name: "dns-gray", label: "Gray" },
] as const;

const TYPE_SCALE = [
  { cls: "text-3xl", label: "text-3xl · 30px · дисплей" },
  { cls: "text-2xl", label: "text-2xl · 24px · дисплей" },
  { cls: "text-xl", label: "text-xl · 20px · заголовок секции" },
  { cls: "text-lg", label: "text-lg · 18px · заголовок секции" },
  { cls: "text-sm", label: "text-sm · 14px · тело (основной)" },
  { cls: "text-xs", label: "text-xs · 12px · подписи" },
] as const;

function ColorSwatch({ name, label }: { name: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-16 w-full rounded-md border border-border"
        style={{ background: `hsl(var(--${name}))` }}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
      <code className="text-xs">--{name}</code>
    </div>
  );
}

export default function DesignSystemPage() {
  const { theme, themeClass, toggleTheme } = useDnsTheme();

  return (
    <div className={`dns-product-shell min-h-dvh bg-background text-foreground ${themeClass}`}>
      <div className="mx-auto max-w-5xl space-y-10 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Design System — SimCenter</h1>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Базовые бренд-цвета</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-5">
            {BRAND_TOKENS.map((token) => (
              <ColorSwatch key={token.name} {...token} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Семантические токены</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {COLOR_TOKENS.map((token) => (
              <ColorSwatch key={token.name} {...token} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Типографика</h2>
          <div className="space-y-2">
            {TYPE_SCALE.map((t) => (
              <p key={t.cls} className={t.cls}>
                {t.label}
              </p>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Кнопки</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Бейджи</h2>
          <div className="flex flex-wrap gap-3">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Статус-цвета (новые токены)</h2>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-md bg-success px-3 py-1 text-sm text-success-foreground">Success</span>
            <span className="rounded-md bg-warning px-3 py-1 text-sm text-warning-foreground">Warning</span>
            <span className="rounded-md bg-info px-3 py-1 text-sm text-info-foreground">Info</span>
            <span className="rounded-md bg-destructive px-3 py-1 text-sm text-destructive-foreground">Error</span>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Карточка</h2>
          <Card className="max-w-sm">
            <CardHeader>
              <CardTitle>Пример карточки</CardTitle>
            </CardHeader>
            <CardContent>
              <Input placeholder="Поле ввода" />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Алерты</h2>
          <Alert>
            <AlertTitle>Успех</AlertTitle>
            <AlertDescription>Пример стандартного алерта.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>Пример деструктивного алерта.</AlertDescription>
          </Alert>
        </section>
      </div>
    </div>
  );
}
