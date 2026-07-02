import type { StandardAction } from "@shared/zrd/types";
import staffPile from "@/assets/brand/zrd/staff/pile.png";
import st1 from "@/assets/brand/zrd/staff/card1.png";
import st2 from "@/assets/brand/zrd/staff/card2.png";
import st3 from "@/assets/brand/zrd/staff/card3.png";
import st4 from "@/assets/brand/zrd/staff/card4.png";
import st5 from "@/assets/brand/zrd/staff/card5.png";
import st6 from "@/assets/brand/zrd/staff/card6.png";
import st7 from "@/assets/brand/zrd/staff/card7.png";
import st8 from "@/assets/brand/zrd/staff/card8.png";
import st9 from "@/assets/brand/zrd/staff/card9.png";
import st10 from "@/assets/brand/zrd/staff/card10.png";
import goodsPile from "@/assets/brand/zrd/goods/pile.png";
import gd1 from "@/assets/brand/zrd/goods/card1.png";
import gd2 from "@/assets/brand/zrd/goods/card2.png";
import gd3 from "@/assets/brand/zrd/goods/card3.png";
import gd4 from "@/assets/brand/zrd/goods/card4.png";
import gd5 from "@/assets/brand/zrd/goods/card5.png";
import gd6 from "@/assets/brand/zrd/goods/card6.png";
import gd7 from "@/assets/brand/zrd/goods/card7.png";
import gd8 from "@/assets/brand/zrd/goods/card8.png";
import gd9 from "@/assets/brand/zrd/goods/card9.png";
import logiPile from "@/assets/brand/zrd/logistics/pile.png";
import lg1 from "@/assets/brand/zrd/logistics/card1.png";
import lg2 from "@/assets/brand/zrd/logistics/card2.png";
import lg3 from "@/assets/brand/zrd/logistics/card3.png";
import lg4 from "@/assets/brand/zrd/logistics/card4.png";
import lg5 from "@/assets/brand/zrd/logistics/card5.png";
import lg6 from "@/assets/brand/zrd/logistics/card6.png";
import lg7 from "@/assets/brand/zrd/logistics/card7.png";
import lg8 from "@/assets/brand/zrd/logistics/card8.png";
import lg9 from "@/assets/brand/zrd/logistics/card9.png";
import svcPile from "@/assets/brand/zrd/service/pile.png";
import sv1 from "@/assets/brand/zrd/service/card1.png";
import sv2 from "@/assets/brand/zrd/service/card2.png";
import sv3 from "@/assets/brand/zrd/service/card3.png";
import sv4 from "@/assets/brand/zrd/service/card4.png";
import sv5 from "@/assets/brand/zrd/service/card5.png";
import sv6 from "@/assets/brand/zrd/service/card6.png";
import sv7 from "@/assets/brand/zrd/service/card7.png";
import sv8 from "@/assets/brand/zrd/service/card8.png";
import sv9 from "@/assets/brand/zrd/service/card9.png";
import promoPile from "@/assets/brand/zrd/promo/pile.png";
import pr1 from "@/assets/brand/zrd/promo/card1.png";
import pr2 from "@/assets/brand/zrd/promo/card2.png";
import pr3 from "@/assets/brand/zrd/promo/card3.png";
import pr4 from "@/assets/brand/zrd/promo/card4.png";
import pr5 from "@/assets/brand/zrd/promo/card5.png";
import pr6 from "@/assets/brand/zrd/promo/card6.png";
import pr7 from "@/assets/brand/zrd/promo/card7.png";
import pr8 from "@/assets/brand/zrd/promo/card8.png";
import pr9 from "@/assets/brand/zrd/promo/card9.png";
import projPile from "@/assets/brand/zrd/projects/pile.png";
import pj1 from "@/assets/brand/zrd/projects/card1.png";
import pj2 from "@/assets/brand/zrd/projects/card2.png";
import pj3 from "@/assets/brand/zrd/projects/card3.png";
import pj4 from "@/assets/brand/zrd/projects/card4.png";
import pj5 from "@/assets/brand/zrd/projects/card5.png";
import pj6 from "@/assets/brand/zrd/projects/card6.png";
import pj7 from "@/assets/brand/zrd/projects/card7.png";
import pj8 from "@/assets/brand/zrd/projects/card8.png";
import pj9 from "@/assets/brand/zrd/projects/card9.png";

/** Эффект-показатель карты (наш, поверх нижней границы арта). good=плюс, иначе минус. */
export interface ZrdCardStat {
  text: string;
  good: boolean;
}

/** Карта колоды: оригинальный арт листа (Canva) + действие движка + (опц.) показатели. */
export interface ZrdDeckCard {
  id: string;
  title: string;
  img: string;
  action: StandardAction;
  stats?: ZrdCardStat[];
}

export interface ZrdDeckDef {
  id: string;
  name: string;
  accent: string;
  /** Оригинальная картинка стопки (из листа Canva). */
  pile: string;
  /** Аспект карты этого листа (width / height). */
  cardAspect: string;
  cards: ZrdDeckCard[];
}

/** Колода «Сотрудники» (бирюзовая). Новый формат: стопка карточной формы. */
export const STAFF_DECK: ZrdDeckDef = {
  id: "staff",
  name: "Сотрудники",
  accent: "#22c3b3",
  pile: staffPile,
  cardAspect: "290 / 414",
  cards: [
    { id: "st_competency", title: "Развивать компетенции", img: st1, action: "improve_service",
      stats: [{ text: "+10% сервис", good: true }, { text: "−20 тыс ₽", good: false }] },
    { id: "st_learning",   title: "Адаптивное обучение",   img: st2, action: "improve_service" },
    { id: "st_hire",       title: "Нанять персонал",       img: st3, action: "hire",
      stats: [{ text: "+2 персонал", good: true }, { text: "−15 тыс ₽", good: false }] },
    { id: "st_motivation", title: "Повысить мотивацию",    img: st4, action: "hire" },
    { id: "st_recruit",    title: "Найти рекрута",         img: st5, action: "hire",
      stats: [{ text: "−12 дн к цели", good: true }, { text: "−15 тыс ₽", good: false }] },
    { id: "st_mentoring",  title: "Наставничество",        img: st6, action: "improve_service" },
    { id: "st_assessment", title: "Оценка навыков",        img: st7, action: "hire",
      stats: [{ text: "+5% сервис", good: true }, { text: "−5% онлайн", good: false }] },
    { id: "st_team",       title: "Собрать команду",       img: st8, action: "hire",
      stats: [{ text: "+5% сервис", good: true }, { text: "−3% онлайн", good: false }] },
    { id: "st_retain",     title: "Удержать сотрудников",  img: st9, action: "hire",
      stats: [{ text: "+3 персонал", good: true }, { text: "−10 тыс ₽", good: false }] },
    { id: "st_conflict",   title: "Разобрать конфликт",    img: st10, action: "improve_service" },
  ],
};

/** Колода «Товар» (фиолетовая). Условия — в нижнем чёрном поле карты. */
export const GOODS_DECK: ZrdDeckDef = {
  id: "goods",
  name: "Товар",
  accent: "#bd4be8",
  pile: goodsPile,
  cardAspect: "290 / 414",
  cards: [
    { id: "gd_assortment", title: "Ассортимент",     img: gd1, action: "promo",
      stats: [{ text: "+8% продажи", good: true }, { text: "−18 тыс ₽", good: false }] },
    { id: "gd_purchase",   title: "Закупка",         img: gd2, action: "improve_logistics" },
    { id: "gd_arrival",    title: "Поступление",     img: gd3, action: "improve_logistics",
      stats: [{ text: "+2 склад", good: true }, { text: "−12 тыс ₽", good: false }] },
    { id: "gd_acceptance", title: "Приёмка",         img: gd4, action: "improve_logistics" },
    { id: "gd_storage",    title: "Хранение",        img: gd5, action: "improve_logistics",
      stats: [{ text: "+1 склад", good: true }, { text: "−8 тыс ₽", good: false }] },
    { id: "gd_pricing",    title: "Ценообразование", img: gd6, action: "promo" },
    { id: "gd_display",    title: "Выкладка",        img: gd7, action: "promo",
      stats: [{ text: "+6% продажи", good: true }, { text: "−5% сервис", good: false }] },
    { id: "gd_labeling",   title: "Маркировка",      img: gd8, action: "improve_logistics" },
    { id: "gd_inventory",  title: "Инвентаризация",  img: gd9, action: "improve_logistics",
      stats: [{ text: "+3% точность", good: true }, { text: "−6 тыс ₽", good: false }] },
  ],
};

/** Колода «Логистика» (синяя). Название стопки перенесено вниз. Условия — в чёрном поле. */
export const LOGISTICS_DECK: ZrdDeckDef = {
  id: "logistics",
  name: "Логистика",
  accent: "#2f83f0",
  pile: logiPile,
  cardAspect: "290 / 414",
  cards: [
    { id: "lg_supply",     title: "Поставка",           img: lg1, action: "improve_logistics",
      stats: [{ text: "+2 склад", good: true }, { text: "−15 тыс ₽", good: false }] },
    { id: "lg_transport",  title: "Транспортировка",    img: lg2, action: "improve_logistics" },
    { id: "lg_warehouse",  title: "Складирование",      img: lg3, action: "improve_logistics",
      stats: [{ text: "+1 склад", good: true }, { text: "−8 тыс ₽", good: false }] },
    { id: "lg_distribute", title: "Распределение",      img: lg4, action: "improve_logistics" },
    { id: "lg_acceptance", title: "Приёмка товара",     img: lg5, action: "improve_logistics",
      stats: [{ text: "+5% точность", good: true }, { text: "−6 тыс ₽", good: false }] },
    { id: "lg_picking",    title: "Комплектация заказа", img: lg6, action: "improve_logistics" },
    { id: "lg_shipping",   title: "Отгрузка",           img: lg7, action: "improve_logistics",
      stats: [{ text: "−10 дн к цели", good: true }, { text: "−12 тыс ₽", good: false }] },
    { id: "lg_delivery",   title: "Доставка",           img: lg8, action: "improve_logistics" },
    { id: "lg_inventory",  title: "Инвентаризация",     img: lg9, action: "improve_logistics",
      stats: [{ text: "+3% точность", good: true }, { text: "−5 тыс ₽", good: false }] },
  ],
};

/** Колода «Сервис» (оранжевая). Название стопки перенесено вниз. Условия — в чёрном поле «через одну». */
export const SERVICE_DECK: ZrdDeckDef = {
  id: "service",
  name: "Сервис",
  accent: "#f5a623",
  pile: svcPile,
  cardAspect: "290 / 414",
  cards: [
    { id: "sv_operations", title: "Сервисные операции", img: sv1, action: "improve_service",
      stats: [{ text: "+8% сервис", good: true }, { text: "−12 тыс ₽", good: false }] },
    { id: "sv_repair",     title: "Ремонт",             img: sv2, action: "improve_service" },
    { id: "sv_recovery",   title: "Восстановление",     img: sv3, action: "improve_service",
      stats: [{ text: "+5% сервис", good: true }, { text: "−8 тыс ₽", good: false }] },
    { id: "sv_replace",    title: "Замена",             img: sv4, action: "improve_service" },
    { id: "sv_claim",      title: "Претензия",          img: sv5, action: "improve_service",
      stats: [{ text: "+4% лояльность", good: true }, { text: "−6 тыс ₽", good: false }] },
    { id: "sv_warranty",   title: "Гарантия",           img: sv6, action: "improve_service" },
    { id: "sv_nowarranty", title: "Не гарантия",        img: sv7, action: "improve_service",
      stats: [{ text: "+3% маржа", good: true }, { text: "−5% лояльность", good: false }] },
    { id: "sv_court",      title: "Суд",                img: sv8, action: "improve_service" },
    { id: "sv_extremist",  title: "Экстремист",         img: sv9, action: "improve_service",
      stats: [{ text: "−15 тыс ₽", good: false }, { text: "−8% репутация", good: false }] },
  ],
};

/** Колода «Продвижение» (красная). Название стопки перенесено вниз. Условия — в чёрном поле «через одну». */
export const PROMO_DECK: ZrdDeckDef = {
  id: "promo",
  name: "Продвижение",
  accent: "#ef3e56",
  pile: promoPile,
  cardAspect: "290 / 414",
  cards: [
    { id: "pr_ad",         title: "Реклама",                    img: pr1, action: "promo",
      stats: [{ text: "+7% охват", good: true }, { text: "−14 тыс ₽", good: false }] },
    { id: "pr_sale",       title: "Акция распродажа",           img: pr2, action: "promo" },
    { id: "pr_viral",      title: "Вирусный ролик в сети",      img: pr3, action: "promo",
      stats: [{ text: "+12% охват", good: true }, { text: "−8 тыс ₽", good: false }] },
    { id: "pr_reviews",    title: "Купить отзывы платные",      img: pr4, action: "promo" },
    { id: "pr_promoter",   title: "Нанять промоутера на улице", img: pr5, action: "promo",
      stats: [{ text: "+5% трафик", good: true }, { text: "−6 тыс ₽", good: false }] },
    { id: "pr_branding",   title: "Брендинг",                   img: pr6, action: "promo" },
    { id: "pr_tv",         title: "ТВ реклама",                 img: pr7, action: "promo",
      stats: [{ text: "+10% узнаваемость", good: true }, { text: "−20 тыс ₽", good: false }] },
    { id: "pr_loyalty",    title: "Лояльность",                 img: pr8, action: "promo" },
    { id: "pr_cutbudget",  title: "Сократить бюджеты",          img: pr9, action: "promo",
      stats: [{ text: "+10 тыс ₽", good: true }, { text: "−8% охват", good: false }] },
  ],
};

/** Колода «Проекты» (золотая). Стратегические проекты РРС. Название стопки перенесено вниз. */
export const PROJECTS_DECK: ZrdDeckDef = {
  id: "projects",
  name: "Проекты",
  accent: "#e0a92e",
  pile: projPile,
  cardAspect: "290 / 414",
  cards: [
    { id: "pj_open_store", title: "Открытие магазина",           img: pj1, action: "open_basic",
      stats: [{ text: "+1 магазин", good: true }, { text: "−25 тыс ₽", good: false }] },
    { id: "pj_resize",     title: "Изменение площади",           img: pj2, action: "open_basic" },
    { id: "pj_close_store",title: "Закрытие магазина",           img: pj3, action: "open_basic",
      stats: [{ text: "+8 тыс ₽ экономия", good: true }, { text: "−1 магазин", good: false }] },
    { id: "pj_relocate",   title: "Переезд магазина",            img: pj4, action: "open_basic" },
    { id: "pj_warehouse",  title: "Расширение склада",           img: pj5, action: "improve_logistics",
      stats: [{ text: "+3 склад", good: true }, { text: "−18 тыс ₽", good: false }] },
    { id: "pj_modernize",  title: "Модернизация зала",           img: pj6, action: "improve_service" },
    { id: "pj_pickup",     title: "Открытие пункта выдачи",      img: pj7, action: "open_basic",
      stats: [{ text: "+4% охват", good: true }, { text: "−12 тыс ₽", good: false }] },
    { id: "pj_new_loc",    title: "Развитие новой локации",      img: pj8, action: "open_basic" },
    { id: "pj_potential",  title: "Раскрытие потенциала РРС",    img: pj9, action: "open_basic",
      stats: [{ text: "+6% доля рынка", good: true }, { text: "−30 тыс ₽", good: false }] },
  ],
};
