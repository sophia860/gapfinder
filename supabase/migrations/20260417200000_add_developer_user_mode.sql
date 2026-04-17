-- Add 'developer' to the user_mode enum to support a dev-focused niche-finder experience.
ALTER TYPE public.user_mode ADD VALUE IF NOT EXISTS 'developer';
