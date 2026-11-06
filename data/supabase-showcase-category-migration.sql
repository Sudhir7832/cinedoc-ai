begin;
alter table public.testimonials add column if not exists category text not null default 'documentary';
alter table public.testimonials drop constraint if exists testimonials_category_check;
alter table public.testimonials add constraint testimonials_category_check check (category in ('documentary', 'kids'));
commit;
