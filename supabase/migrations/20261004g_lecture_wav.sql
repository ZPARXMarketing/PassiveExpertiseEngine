-- Expertise Engine: some voice models return raw PCM, which the app wraps as WAV.
update storage.buckets set allowed_mime_types = array['audio/mpeg', 'audio/wav'] where id = 'xe-lectures';
