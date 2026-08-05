export type AdminTabKey = "dashboard" | "cases" | "channels" | "schedule" | "results" | "comparison" | "settings";
export type AdminChannelTab = "email" | "messenger" | "video";
export type SystemSoundSettingKey = "callSoundAssetId" | "emailSoundAssetId" | "messengerSoundAssetId" | "videoSoundAssetId";
export type AdminVisualTone = "orange" | "teal" | "blue" | "purple" | "cyan" | "amber";

export interface AdminVisualIdentity {
  label: string;
  title: string;
  subtitle: string;
  primarySrc: string;
  primaryAlt: string;
  primaryClassName: string;
  tone: AdminVisualTone;
}
