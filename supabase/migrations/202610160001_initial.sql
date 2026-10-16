-- ForgeIQ: all financial and job state mutations are service-role-only RPCs.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 email text not null, full_name text not null default '', role text not null default 'user' check(role in ('user','admin')),
 retention_days integer not null default 30 check(retention_days between 1 and 90),
 consent_at timestamptz, deletion_requested_at timestamptz, created_at timestamptz not null default now()
);
create table public.organizations(id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles on delete cascade, name text not null, created_at timestamptz not null default now());
create table public.organization_members(organization_id uuid references public.organizations on delete cascade,user_id uuid references public.profiles on delete cascade,role text not null check(role in ('owner','member')),created_at timestamptz not null default now(),primary key(organization_id,user_id));
create table public.wallets(user_id uuid primary key references public.profiles on delete cascade,balance integer not null default 0 check(balance>=0),updated_at timestamptz not null default now());
create table public.ai_modules(id text primary key check(id in ('quotation','ecommerce')),name text not null,enabled boolean not null default true,created_at timestamptz not null default now());
insert into public.ai_modules values('quotation','Supplier Quotation Intelligence',true,now()),('ecommerce','E-commerce Intelligence',true,now());
create table public.pricing_rules(module_id text primary key references public.ai_modules,credits_per_document integer not null default 2 check(credits_per_document between 0 and 1000),credits_per_image integer not null default 1 check(credits_per_image between 0 and 1000),credits_per_job integer not null default 3 check(credits_per_job between 0 and 1000),max_files integer not null default 8 check(max_files between 1 and 10),updated_at timestamptz not null default now());
insert into public.pricing_rules(module_id) values('quotation'),('ecommerce');
create table public.platform_settings(id boolean primary key default true check(id),trial_credits integer not null default 25 check(trial_credits between 0 and 10000),subscription_allowance integer not null default 0 check(subscription_allowance between 0 and 100000));
insert into public.platform_settings default values;
create table public.analysis_jobs(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,module_id text not null references public.ai_modules,title text not null check(length(title) between 1 and 120),status text not null default 'queued' check(status in ('queued','processing','completed','failed')),credits_charged integer not null check(credits_charged>=0),request_key uuid not null,error_code text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,request_key));
create table public.uploaded_files(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,job_id uuid references public.analysis_jobs on delete cascade,name text not null,storage_path text not null unique,mime_type text not null,size_bytes bigint not null check(size_bytes>0),status text not null default 'pending' check(status in ('pending','ready','deleted')),expires_at timestamptz not null,created_at timestamptz not null default now());
create table public.credit_transactions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,job_id uuid references public.analysis_jobs on delete set null,amount integer not null,kind text not null check(kind in ('trial','charge','refund','purchase','adjustment','payment_refund')),idempotency_key text not null unique,description text not null,created_at timestamptz not null default now());
create table public.analysis_results(job_id uuid primary key references public.analysis_jobs on delete cascade,user_id uuid not null references public.profiles on delete cascade,result jsonb not null,created_at timestamptz not null default now());
create table public.document_extractions(file_id uuid primary key references public.uploaded_files on delete cascade,job_id uuid not null references public.analysis_jobs on delete cascade,user_id uuid not null references public.profiles on delete cascade,result jsonb not null,model text not null,input_tokens integer not null,output_tokens integer not null,estimated_cost_usd numeric,created_at timestamptz not null default now());
create table public.generated_reports(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,job_id uuid not null references public.analysis_jobs on delete cascade,format text not null check(format in ('pdf','xlsx')),storage_path text not null,created_at timestamptz not null default now());
create table public.credit_packages(id text primary key,name text not null,credits integer not null check(credits>0),amount_cents integer not null check(amount_cents>0),currency text not null default 'usd',enabled boolean not null default true);
insert into public.credit_packages values('starter','Test Starter',100,1000,'usd',true),('growth','Test Growth',500,4000,'usd',true);
create table public.payment_transactions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,package_id text references public.credit_packages,credits integer not null check(credits>0),amount_cents integer not null check(amount_cents>0),currency text not null,provider text not null default 'stripe_test',session_id text unique,payment_intent text unique,status text not null default 'pending' check(status in ('pending','paid','failed','refunded')),refunded_cents integer not null default 0,credits_revoked integer not null default 0,created_at timestamptz not null default now());
create table public.payment_events(event_id text primary key,event_type text not null,created_at timestamptz not null default now());
create table public.payment_refunds(id text primary key,payment_id uuid not null references public.payment_transactions on delete cascade,amount_cents integer not null,credits_recovered integer not null,credits_shortfall integer not null,created_at timestamptz not null default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles on delete set null,action text not null,target_id text,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create table public.job_outbox(job_id uuid primary key references public.analysis_jobs on delete cascade,dispatched_at timestamptz,lease_until timestamptz,attempts integer not null default 0,created_at timestamptz not null default now());
create table public.rate_limits(key text primary key,count integer not null,reset_at timestamptz not null);
create index jobs_user_created on public.analysis_jobs(user_id,created_at desc);
create index jobs_status on public.analysis_jobs(status,updated_at);
create index files_user_created on public.uploaded_files(user_id,created_at desc);
create index files_job on public.uploaded_files(job_id);
create index files_retention on public.uploaded_files(expires_at) where status<>'deleted';
create index credits_user_created on public.credit_transactions(user_id,created_at desc);
create index payments_user_created on public.payment_transactions(user_id,created_at desc);
create index audits_created on public.audit_logs(created_at desc);

create function public.on_signup() returns trigger language plpgsql security definer set search_path=public as $$
declare n integer; o uuid;
begin
 insert into profiles(id,email,full_name) values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'full_name',''),120));
 select trial_credits into n from platform_settings where id=true;
 insert into wallets(user_id,balance) values(new.id,n);
 insert into credit_transactions(user_id,amount,kind,idempotency_key,description) values(new.id,n,'trial','trial:'||new.id,'Trial credits');
 insert into organizations(owner_id,name) values(new.id,'Personal workspace') returning id into o;
 insert into organization_members values(o,new.id,'owner',now());
 return new;
end $$;
create trigger create_profile after insert on auth.users for each row execute function public.on_signup();

create function public.begin_analysis(p_user uuid,p_module text,p_title text,p_files uuid[],p_request uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare j uuid; rule pricing_rules; cost integer; n integer; balance_now integer;
begin
 -- Wallet lock serializes retries and all deductions for the owner.
 select balance into balance_now from wallets where user_id=p_user for update;
 if not found then raise exception 'WALLET_NOT_FOUND'; end if;
 select id into j from analysis_jobs where user_id=p_user and request_key=p_request;
 if found then return j; end if;
 if not exists(select 1 from profiles where id=p_user and consent_at is not null and deletion_requested_at is null) then raise exception 'CONSENT_REQUIRED'; end if;
 if not exists(select 1 from ai_modules where id=p_module and enabled) then raise exception 'MODULE_DISABLED'; end if;
 select * into rule from pricing_rules where module_id=p_module;
 if not found then raise exception 'PRICING_MISSING'; end if;
 if cardinality(p_files)<1 or cardinality(p_files)>rule.max_files then raise exception 'FILE_LIMIT'; end if;
 perform 1 from uploaded_files where id=any(p_files) order by id for update;
 select count(*),coalesce(sum(case when mime_type like 'image/%' then rule.credits_per_image else rule.credits_per_document end),0)+rule.credits_per_job into n,cost from uploaded_files where id=any(p_files) and user_id=p_user and status='ready' and job_id is null and expires_at>now();
 if n<>cardinality(p_files) then raise exception 'INVALID_FILES'; end if;
 if balance_now<cost then raise exception 'INSUFFICIENT_CREDITS'; end if;
 if (select count(*) from analysis_jobs where user_id=p_user and status in ('queued','processing'))>=3 then raise exception 'ACTIVE_JOB_LIMIT'; end if;
 insert into analysis_jobs(user_id,module_id,title,credits_charged,request_key) values(p_user,p_module,p_title,cost,p_request) returning id into j;
 update uploaded_files set job_id=j where id=any(p_files);
 update wallets set balance=balance-cost,updated_at=now() where user_id=p_user;
 insert into credit_transactions(user_id,job_id,amount,kind,idempotency_key,description) values(p_user,j,-cost,'charge','job:'||j,'Analysis credits reserved');
 insert into job_outbox(job_id) values(j);
 insert into audit_logs(actor_id,action,target_id) values(p_user,'analysis.created',j::text);
 return j;
end $$;

create function public.fail_analysis(p_job uuid,p_code text) returns void language plpgsql security definer set search_path=public as $$
declare j analysis_jobs;
begin
 perform 1 from wallets where user_id=(select user_id from analysis_jobs where id=p_job) for update;
 select * into j from analysis_jobs where id=p_job for update;
 if not found or j.status in ('failed','completed') then return; end if;
 update analysis_jobs set status='failed',error_code=left(p_code,80),updated_at=now() where id=p_job;
 update wallets set balance=balance+j.credits_charged,updated_at=now() where user_id=j.user_id;
 insert into credit_transactions(user_id,job_id,amount,kind,idempotency_key,description) values(j.user_id,j.id,j.credits_charged,'refund','refund:'||j.id,'Failed analysis refunded');
 insert into audit_logs(actor_id,action,target_id,metadata) values(j.user_id,'analysis.failed',j.id::text,jsonb_build_object('code',left(p_code,80)));
end $$;
create function public.finish_analysis(p_job uuid,p_result jsonb) returns void language plpgsql security definer set search_path=public as $$
declare j analysis_jobs;
begin
 select * into j from analysis_jobs where id=p_job for update;
 if not found or j.status in ('failed','completed') then return; end if;
 insert into analysis_results(job_id,user_id,result) values(j.id,j.user_id,p_result);
 update analysis_jobs set status='completed',updated_at=now() where id=j.id;
 insert into audit_logs(actor_id,action,target_id) values(j.user_id,'analysis.completed',j.id::text);
end $$;
create function public.take_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 insert into rate_limits(key,count,reset_at) values(p_key,1,now()+make_interval(secs=>p_seconds)) on conflict(key) do update set count=case when rate_limits.reset_at<=now() then 1 else rate_limits.count+1 end,reset_at=case when rate_limits.reset_at<=now() then now()+make_interval(secs=>p_seconds) else rate_limits.reset_at end returning count into n;
 return n<=p_limit;
end $$;
create function public.claim_outbox() returns setof public.job_outbox language plpgsql security definer set search_path=public as $$
begin
 return query update job_outbox set lease_until=now()+interval '2 minutes',attempts=attempts+1 where job_id in (select job_id from job_outbox where dispatched_at is null and (lease_until is null or lease_until<now()) order by created_at limit 25 for update skip locked) returning *;
end $$;
create function public.adjust_credits(p_admin uuid,p_user uuid,p_amount integer,p_reason text,p_key uuid) returns void language plpgsql security definer set search_path=public as $$
declare b integer;
begin
 if not exists(select 1 from profiles where id=p_admin and role='admin') then raise exception 'FORBIDDEN'; end if;
 select balance into b from wallets where user_id=p_user for update;
 if not found then raise exception 'WALLET_NOT_FOUND'; end if;
 if exists(select 1 from credit_transactions where idempotency_key='admin:'||p_key) then return; end if;
 if b+p_amount<0 then raise exception 'INSUFFICIENT_CREDITS'; end if;
 update wallets set balance=balance+p_amount,updated_at=now() where user_id=p_user;
 insert into credit_transactions(user_id,amount,kind,idempotency_key,description) values(p_user,p_amount,'adjustment','admin:'||p_key,p_reason);
 insert into audit_logs(actor_id,action,target_id,metadata) values(p_admin,'credits.adjusted',p_user::text,jsonb_build_object('amount',p_amount,'reason',p_reason));
end $$;
create function public.settle_payment(p_event text,p_payment uuid,p_session text,p_intent text,p_amount integer,p_currency text) returns void language plpgsql security definer set search_path=public as $$
declare p payment_transactions;
begin
 select * into p from payment_transactions where id=p_payment for update;
 if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
 if p.session_id is distinct from p_session or p.amount_cents<>p_amount or p.currency<>p_currency then raise exception 'PAYMENT_MISMATCH'; end if;
 if exists(select 1 from payment_events where event_id=p_event) then return; end if;
 insert into payment_events values(p_event,'checkout.paid',now());
 if p.status='paid' or p.status='refunded' then return; end if;
 if p.status<>'pending' then raise exception 'PAYMENT_STATE'; end if;
 update payment_transactions set status='paid',payment_intent=p_intent where id=p.id;
 update wallets set balance=balance+p.credits,updated_at=now() where user_id=p.user_id;
 insert into credit_transactions(user_id,amount,kind,idempotency_key,description) values(p.user_id,p.credits,'purchase','payment:'||p.id,'Test credit purchase');
end $$;
create function public.record_refund(p_event text,p_intent text,p_cumulative_cents integer) returns void language plpgsql security definer set search_path=public as $$
declare p payment_transactions; desired integer; recovered integer; b integer;
begin
 select * into p from payment_transactions where payment_intent=p_intent for update;
 if not found then raise exception 'PAYMENT_NOT_READY'; end if;
 if exists(select 1 from payment_events where event_id=p_event) then return; end if;
 insert into payment_events values(p_event,'charge.refunded',now());
 if p_cumulative_cents<=p.refunded_cents then return; end if;
 if p_cumulative_cents>p.amount_cents then raise exception 'REFUND_TOO_LARGE'; end if;
 desired=floor(p.credits*p_cumulative_cents::numeric/p.amount_cents)-floor(p.credits*p.refunded_cents::numeric/p.amount_cents);
 select balance into b from wallets where user_id=p.user_id for update;
 recovered=least(b,desired);
 update wallets set balance=balance-recovered,updated_at=now() where user_id=p.user_id;
 insert into credit_transactions(user_id,amount,kind,idempotency_key,description) values(p.user_id,-recovered,'payment_refund','payment-refund:'||p_event,'Test payment refund credit recovery');
 insert into payment_refunds values(p_event,p.id,p_cumulative_cents-p.refunded_cents,recovered,desired-recovered,now());
 update payment_transactions set status=case when p_cumulative_cents=p.amount_cents then 'refunded' else status end,refunded_cents=p_cumulative_cents,credits_revoked=credits_revoked+recovered where id=p.id;
end $$;

-- No client can mutate privileged state, even with a valid authenticated JWT.
do $$ declare t text; begin
 foreach t in array array['profiles','organizations','organization_members','wallets','ai_modules','pricing_rules','platform_settings','analysis_jobs','uploaded_files','credit_transactions','analysis_results','document_extractions','generated_reports','credit_packages','payment_transactions','payment_events','payment_refunds','audit_logs','job_outbox','rate_limits'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['wallets','analysis_jobs','uploaded_files','credit_transactions','analysis_results','generated_reports','payment_transactions'] loop
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy owner_read on public.%I for select to authenticated using (user_id=auth.uid())',t);
 end loop;
 foreach t in array array['ai_modules','pricing_rules','credit_packages'] loop
 execute format('grant select on public.%I to anon, authenticated',t);
 execute format('create policy catalog_read on public.%I for select using (true)',t);
 end loop;
end $$;
grant select on public.profiles,public.organizations,public.organization_members to authenticated;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid());
create policy org_read on public.organizations for select to authenticated using(owner_id=auth.uid());
create policy membership_read on public.organization_members for select to authenticated using(user_id=auth.uid());
-- SECURITY DEFINER functions are not callable directly by browser clients.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on all functions in schema public to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('documents','documents',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),('reports','reports',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) on conflict(id) do nothing;
-- Storage access is issued only by ownership-checked server routes as short-lived signed URLs.
create function public.retry_analysis(p_user uuid,p_job uuid,p_request uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare j analysis_jobs; ids uuid[]; existing uuid;
begin
 perform 1 from wallets where user_id=p_user for update;
 select id into existing from analysis_jobs where user_id=p_user and request_key=p_request;
 if found then return existing; end if;
 select * into j from analysis_jobs where id=p_job and user_id=p_user for update;
 if not found or j.status<>'failed' then raise exception 'INVALID_FILES'; end if;
 select array_agg(id) into ids from uploaded_files where job_id=p_job and status='ready' and expires_at>now();
 if ids is null or cardinality(ids)<>(select count(*) from uploaded_files where job_id=p_job) then raise exception 'INVALID_FILES'; end if;
 update uploaded_files set job_id=null where id=any(ids);
 delete from document_extractions where file_id=any(ids);
 return begin_analysis(p_user,j.module_id,left(j.title,112)||' (retry)',ids,p_request);
end $$;
revoke all on function public.retry_analysis(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.retry_analysis(uuid,uuid,uuid) to service_role;
create function public.request_deletion(p_user uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from wallets where user_id=p_user for update;
 if exists(select 1 from analysis_jobs where user_id=p_user and status in ('queued','processing')) then raise exception 'ACTIVE_JOB_LIMIT'; end if;
 update profiles set deletion_requested_at=now() where id=p_user;
 insert into audit_logs(actor_id,action,target_id) values(p_user,'account.deletion-requested',p_user::text);
end $$;
revoke all on function public.request_deletion(uuid) from public,anon,authenticated;
grant execute on function public.request_deletion(uuid) to service_role;
-- Coordinate file removal with job creation using the same file-row locks.
alter table uploaded_files drop constraint uploaded_files_status_check;
alter table uploaded_files add constraint uploaded_files_status_check check(status in ('pending','ready','deleting','deleted'));
create function public.prepare_file_deletion(p_user uuid,p_file uuid) returns text language plpgsql security definer set search_path=public as $$
declare f uploaded_files;
begin
 select * into f from uploaded_files where id=p_file and user_id=p_user for update;
 if not found then raise exception 'INVALID_FILES'; end if;
 if exists(select 1 from analysis_jobs where id=f.job_id and status in ('queued','processing')) then raise exception 'ACTIVE_JOB_LIMIT'; end if;
 update uploaded_files set status='deleting' where id=f.id;
 return f.storage_path;
end $$;
-- Every new upload is fenced against deletion and concurrent storage-limit bypasses.
create function public.guard_upload() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform 1 from wallets where user_id=new.user_id for update;
 if not exists(select 1 from profiles where id=new.user_id and consent_at is not null and deletion_requested_at is null) then raise exception 'CONSENT_REQUIRED'; end if;
 if (select count(*) from uploaded_files where user_id=new.user_id and status<>'deleted')>=100 then raise exception 'FILE_LIMIT'; end if;
 return new;
end $$;
create trigger before_upload before insert on uploaded_files for each row execute function public.guard_upload();
revoke all on function public.prepare_file_deletion(uuid,uuid),public.guard_upload() from public,anon,authenticated;
grant execute on function public.prepare_file_deletion(uuid,uuid),public.guard_upload() to service_role;
-- Query expired rows directly so retention does not stop at a default profile page size.
create index reports_created on generated_reports(created_at);
create index results_created on analysis_results(created_at);
create index extractions_created on document_extractions(created_at);
create function public.expired_reports() returns table(id uuid,storage_path text) language sql security definer set search_path=public as $$
 select r.id,r.storage_path from generated_reports r join profiles p on p.id=r.user_id where r.created_at<now()-make_interval(days=>p.retention_days) order by r.created_at limit 200;
$$;
create function public.purge_expired_results() returns void language plpgsql security definer set search_path=public as $$
begin
 delete from analysis_results where job_id in(select r.job_id from analysis_results r join profiles p on p.id=r.user_id where r.created_at<now()-make_interval(days=>p.retention_days) order by r.created_at limit 500);
 delete from document_extractions where file_id in(select r.file_id from document_extractions r join profiles p on p.id=r.user_id join analysis_jobs j on j.id=r.job_id where j.status in ('completed','failed') and r.created_at<now()-make_interval(days=>p.retention_days) order by r.created_at limit 500);
end $$;
create function public.expired_files() returns table(id uuid,user_id uuid,storage_path text) language sql security definer set search_path=public as $$
 select f.id,f.user_id,f.storage_path from uploaded_files f left join analysis_jobs j on j.id=f.job_id where f.status<>'deleted' and (f.expires_at<now() or f.status='deleting') and (j.id is null or j.status in ('completed','failed')) order by f.expires_at limit 200;
$$;
revoke all on function public.expired_reports(),public.purge_expired_results(),public.expired_files() from public,anon,authenticated;
grant execute on function public.expired_reports(),public.purge_expired_results(),public.expired_files() to service_role;
create function public.set_user_role(p_admin uuid,p_user uuid,p_role text) returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from profiles where id in(p_admin,p_user) order by id for update;
 if not exists(select 1 from profiles where id=p_admin and role='admin') then raise exception 'FORBIDDEN'; end if;
 if p_admin=p_user then raise exception 'SELF_ROLE_CHANGE_DENIED'; end if;
 if p_role not in('user','admin') then raise exception 'INVALID_ROLE'; end if;
 update profiles set role=p_role where id=p_user;
 if not found then raise exception 'USER_NOT_FOUND'; end if;
 insert into audit_logs(actor_id,action,target_id,metadata) values(p_admin,'user.role-updated',p_user::text,jsonb_build_object('role',p_role));
end $$;
revoke all on function public.set_user_role(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.set_user_role(uuid,uuid,text) to service_role;
