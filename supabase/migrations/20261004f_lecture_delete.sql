-- Expertise Engine: deleting a lecture also deletes its MP3.
create policy xe_lectures_delete on storage.objects for delete to anon, authenticated
  using (bucket_id = 'xe-lectures');
