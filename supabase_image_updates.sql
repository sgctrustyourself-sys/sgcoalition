-- Add image_url to ai_chat_messages
ALTER TABLE ai_chat_messages 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create chat-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'chat-images' AND auth.uid() = owner );

-- Allow authenticated users to view images
CREATE POLICY "Authenticated users can view chat images"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'chat-images' );

-- Allow public access to view images (since we made the bucket public)
CREATE POLICY "Public can view chat images"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'chat-images' );
