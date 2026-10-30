alter table chatbots
  add column if not exists use_case text not null default 'site_widget'
    check (use_case in ('site_widget', 'second_cerveau'));
