/**
 * ЗРД — фигурки игроков (арты Canva DAHOZN_SGlY / DAHOZE2m074 / DAHOZJBdQgs / DAHOZHAMwQQ).
 * Имя и характеристика стиля — в shared (MASCOT_META); здесь — картинки и акценты.
 */
import type { MascotId } from "@shared/zrd/match-types";
import { MASCOT_META } from "@shared/zrd/match-types";
import strategImg from "@/assets/brand/zrd/mascots/m1.png";
import mediaImg from "@/assets/brand/zrd/mascots/m2.png";
import dispatcherImg from "@/assets/brand/zrd/mascots/m3.png";
import captainImg from "@/assets/brand/zrd/mascots/m4.png";

export const MASCOT_VISUAL: Record<MascotId, { img: string; name: string; style: string; accent: string }> = {
  strateg: { img: strategImg, name: MASCOT_META.strateg.name, style: MASCOT_META.strateg.style, accent: "#8a93a6" },
  media: { img: mediaImg, name: MASCOT_META.media.name, style: MASCOT_META.media.style, accent: "#2ec4b6" },
  dispatcher: { img: dispatcherImg, name: MASCOT_META.dispatcher.name, style: MASCOT_META.dispatcher.style, accent: "#FF6B00" },
  captain: { img: captainImg, name: MASCOT_META.captain.name, style: MASCOT_META.captain.style, accent: "#f0b429" },
};
