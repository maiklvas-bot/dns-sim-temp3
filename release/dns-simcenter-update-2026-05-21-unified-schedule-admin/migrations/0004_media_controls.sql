ALTER TABLE simulation_cases ADD COLUMN audio_asset_id TEXT;
ALTER TABLE channel_items ADD COLUMN audio_asset_id TEXT;

ALTER TABLE simulation_settings ADD COLUMN waiting_image_asset_id TEXT;
ALTER TABLE simulation_settings ADD COLUMN call_sound_asset_id TEXT;
ALTER TABLE simulation_settings ADD COLUMN email_sound_asset_id TEXT;
ALTER TABLE simulation_settings ADD COLUMN messenger_sound_asset_id TEXT;
ALTER TABLE simulation_settings ADD COLUMN video_sound_asset_id TEXT;
