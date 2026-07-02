/** Колода сброса — светящаяся оранжевая кнопка (стиль референса DAHNebr3cXQ). Сюда уходят разыгранные карты. */
export function ZrdDiscard({ count }: { count: number }) {
  return (
    <button type="button" className="zrd-discard" title={`Колода для сброса (${count})`} aria-label={`Колода для сброса: ${count} карт`}>
      <span className="zrd-discard__gloss" aria-hidden />
      <span className="zrd-discard__bolt zrd-discard__bolt--tl" aria-hidden />
      <span className="zrd-discard__bolt zrd-discard__bolt--tr" aria-hidden />
      <span className="zrd-discard__bolt zrd-discard__bolt--bl" aria-hidden />
      <span className="zrd-discard__bolt zrd-discard__bolt--br" aria-hidden />
      <span className="zrd-discard__label">КОЛОДА<br />для СБРОСА</span>
    </button>
  );
}
