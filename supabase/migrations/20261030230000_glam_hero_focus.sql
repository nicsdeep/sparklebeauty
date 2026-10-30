-- The homepage banner artwork (public/brand/hero-banner.jpg) is now the "Glow · Slay · Sparkle"
-- design Nicholas chose. Its subject, slogan and products sit on the right, so anchor the image
-- to its right edge. Only touches the banner still using that file, so other admin edits stay.
update public.hero_banners
set image_focus = '100% center', updated_at = now()
where image_url = '/brand/hero-banner.jpg' and image_focus = '72% center';
