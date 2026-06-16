import { useEffect, useId, useMemo, useState } from "react";
import type { ChatInfo, CompetencyDefinition, EmailCase, MessengerCase, SimCase, VideoCase } from "@shared/simulation-content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Pause, Play, Trash2 } from "lucide-react";
import { CompetencyRoleSelector, Field, FieldArea, MultiSelectField, SelectField, SuggestField } from "../components/AdminFields";
import { CompetencyHorizontalImpactChart } from "../components/CompetencyHorizontalImpactChart";
import type { AdminChannelTab as ChannelTab } from "../admin-types";
import {
  buildCompetencyAliasMap,
  buildCompetencyNameMap,
  buildOptionCompetencyProfile,
  CASE_SIGNAL_TYPE_OPTIONS,
  createEmptyCase,
  STORE_EFFECT_FIELDS,
  STORE_ZONE_OPTIONS,
} from "./case-editor-support";

export function CaseMediaPanel({
  title,
  helper,
  target,
  assets,
  onChange,
  onUploadAsset,
  onTogglePreviewAudio,
  activePreviewKey,
  previewKey,
}: {
  title: string;
  helper: string;
  target: { imageAssetId?: string | null; imageUrl?: string | null; audioAssetId?: string | null; audioUrl?: string | null };
  assets: any[];
  onChange: (patch: Record<string, any>) => void;
  onUploadAsset: (file: File) => Promise<string | null>;
  onTogglePreviewAudio: (previewKey: string, url: string | null) => void;
  activePreviewKey: string | null;
  previewKey: string;
}) {
  const imageAssets = assets.filter((asset) => asset.kind === "image");
  const audioAssets = assets.filter((asset) => asset.kind === "audio");
  const selectedImage = imageAssets.find((asset) => asset.id === target.imageAssetId);
  const selectedAudio = audioAssets.find((asset) => asset.id === target.audioAssetId);
  const audioUrl = selectedAudio?.publicUrl || target.audioUrl || null;
  const isPreviewActive = activePreviewKey === previewKey;
  const imageInputId = useId();
  const audioInputId = useId();

  return (
    <div className="dns-admin-media-panel rounded-2xl border border-[#4a9eff]/25 bg-[#122031]/80 p-4 shadow-[0_18px_45px_rgba(74,158,255,0.08)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">Медиа</div>
          <div className="mt-1 text-base font-bold text-white">{title}</div>
          <div className="mt-1 max-w-2xl text-xs leading-relaxed text-[#b8c7df]">{helper}</div>
        </div>
        {(target.imageAssetId || target.audioAssetId) && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-[#2a3a4e] bg-transparent text-[#cbd8ef]"
            onClick={() => onChange({ imageAssetId: null, imageUrl: null, audioAssetId: null, audioUrl: null })}
          >
            Очистить медиа
          </Button>
        )}
      </div>

      <div className="dns-admin-media-grid">
        <div className="dns-admin-media-card rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6fa0ff]">Изображение</div>
          <div className="dns-admin-media-picker">
            <select
              value={target.imageAssetId || ""}
              onChange={(e) => onChange({ imageAssetId: e.target.value || null })}
              className="dns-admin-select min-w-0 rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white"
            >
              <option value="">Без изображения</option>
              {imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <input
              id={imageInputId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const assetId = await onUploadAsset(file);
                if (assetId) onChange({ imageAssetId: assetId });
              }}
            />
            <label className="dns-admin-upload-button" htmlFor={imageInputId}>
              Выбрать файл
            </label>
          </div>
          <div className="mt-2 min-h-[1rem] truncate text-[11px] text-[#9fb0ca]">
            {selectedImage?.name || (target.imageUrl ? "Внешнее изображение" : "Файл не выбран")}
          </div>
          {(selectedImage?.publicUrl || target.imageUrl) && (
            <div className="mt-3 overflow-hidden rounded-lg border border-[#2a3a4e]">
              <img
                src={selectedImage?.publicUrl || target.imageUrl || ""}
                alt={selectedImage?.name || "Изображение"}
                className="h-28 w-full object-cover"
              />
            </div>
          )}
        </div>

        <div className="dns-admin-media-card rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#6fa0ff]">Озвучка</div>
          <div className="dns-admin-media-picker">
            <select
              value={target.audioAssetId || ""}
              onChange={(e) => onChange({ audioAssetId: e.target.value || null })}
              className="dns-admin-select min-w-0 rounded-md border border-[#2a3a4e] bg-[#141c2b] px-3 py-2 text-white"
            >
              <option value="">Без отдельной озвучки</option>
              {audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
            <input
              id={audioInputId}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/mp4,audio/x-m4a,audio/aac"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const assetId = await onUploadAsset(file);
                if (assetId) onChange({ audioAssetId: assetId });
              }}
            />
            <label className="dns-admin-upload-button" htmlFor={audioInputId}>
              Выбрать файл
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-[#00d4aa] text-[#0d1117] hover:bg-[#00c39c]"
              onClick={() => onTogglePreviewAudio(previewKey, audioUrl)}
              disabled={!audioUrl}
            >
              <Play className="mr-2 h-4 w-4" />
              {isPreviewActive ? "Стоп" : "Плей"}
            </Button>
            <span className="min-w-0 truncate text-[11px] text-[#8aa2c4]">
              {selectedAudio?.name || (audioUrl ? "Связанный аудиофайл" : "Аудио не выбрано")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
