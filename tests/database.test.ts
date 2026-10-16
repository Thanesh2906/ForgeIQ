import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
let db: PGlite;
const a = '11111111-1111-4111-8111-111111111111',
  b = '22222222-2222-4222-8222-222222222222',
  file = '33333333-3333-4333-8333-333333333333';
const scalar = async (sql: string, params: unknown[] = []) =>
  Object.values((await db.query<Record<string, unknown>>(sql, params)).rows[0])[0];
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'', true),'''')::uuid'; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); grant usage on schema auth,public to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated;`,
  );
  const sql = await readFile('supabase/migrations/202610160001_initial.sql', 'utf8');
  await db.exec(
    sql.replace(
      'create extension if not exists pgcrypto;',
      '-- gen_random_uuid is built into the test PostgreSQL runtime.',
    ),
  );
  await db.query(
    "insert into auth.users(id,email) values($1,'a@example.com'),($2,'b@example.com')",
    [a, b],
  );
  await db.query('update profiles set consent_at=now()');
  await db.query(
    "insert into uploaded_files(id,user_id,name,storage_path,mime_type,size_bytes,status,expires_at) values($1,$2,'quote.pdf','a/quote.pdf','application/pdf',100,'ready',now()+interval '1 day')",
    [file, a],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe('PostgreSQL migration and security invariants', () => {
  let job: string;
  it('creates profiles, organization membership and one trial ledger entry', async () => {
    expect(await scalar('select balance from wallets where user_id=$1', [a])).toBe(25);
    expect(
      await scalar('select count(*)::int from organization_members where user_id=$1', [a]),
    ).toBe(1);
  });
  it('rejects foreign files without charging credits', async () => {
    await expect(
      db.query(
        "select begin_analysis($1,'quotation','Foreign',array[$2::uuid],gen_random_uuid())",
        [b, file],
      ),
    ).rejects.toThrow('INVALID_FILES');
    expect(await scalar('select balance from wallets where user_id=$1', [b])).toBe(25);
  });
  it('rejects duplicate file ids', async () => {
    await expect(
      db.query(
        "select begin_analysis($1,'quotation','Duplicate',array[$2::uuid,$2::uuid],gen_random_uuid())",
        [a, file],
      ),
    ).rejects.toThrow('INVALID_FILES');
  });
  it('atomically charges once for an idempotent request', async () => {
    const key = '44444444-4444-4444-8444-444444444444';
    job = String(
      await scalar("select begin_analysis($1,'quotation','Test',array[$2::uuid],$3)", [
        a,
        file,
        key,
      ]),
    );
    expect(
      await scalar("select begin_analysis($1,'quotation','Test',array[$2::uuid],$3)", [
        a,
        file,
        key,
      ]),
    ).toBe(job);
    expect(await scalar('select balance from wallets where user_id=$1', [a])).toBe(20);
    expect(await scalar('select count(*)::int from job_outbox where job_id=$1', [job])).toBe(1);
  });
  it('refunds once and prevents late completion of failed jobs', async () => {
    await db.query("select fail_analysis($1,'TEST_FAILURE')", [job]);
    await db.query("select fail_analysis($1,'TEST_FAILURE')", [job]);
    expect(await scalar('select balance from wallets where user_id=$1', [a])).toBe(25);
    await db.query("select finish_analysis($1,'{}')", [job]);
    expect(await scalar('select count(*)::int from analysis_results where job_id=$1', [job])).toBe(
      0,
    );
  });
  it('retries once with a new atomic charge', async () => {
    const key = '55555555-5555-4555-8555-555555555555';
    const next = await scalar('select retry_analysis($1,$2,$3)', [a, job, key]);
    expect(await scalar('select retry_analysis($1,$2,$3)', [a, job, key])).toBe(next);
    expect(await scalar('select balance from wallets where user_id=$1', [a])).toBe(20);
    await db.query("select finish_analysis($1,'{}')", [next]);
    await db.query("select fail_analysis($1,'LATE_FAILURE')", [next]);
    expect(await scalar('select balance from wallets where user_id=$1', [a])).toBe(20);
  });
  it('denies client wallet writes and privileged RPC execution', async () => {
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${b}';`);
    try {
      expect(await scalar('select count(*)::int from analysis_jobs')).toBe(0);
      expect(await scalar('select count(*)::int from wallets')).toBe(1);
      await expect(db.query('update wallets set balance=999')).rejects.toThrow('permission denied');
      await expect(db.query("select fail_analysis($1,'CLIENT')", [job])).rejects.toThrow(
        'permission denied',
      );
      await expect(db.query("update profiles set role='admin'")).rejects.toThrow(
        'permission denied',
      );
    } finally {
      await db.exec('reset role');
    }
  });
  it('requires admin role and prevents negative balance', async () => {
    await expect(
      db.query("select adjust_credits($1,$2,10,'invalid',gen_random_uuid())", [a, b]),
    ).rejects.toThrow('FORBIDDEN');
    await db.query("update profiles set role='admin' where id=$1", [a]);
    await expect(
      db.query("select adjust_credits($1,$2,-26,'test debit',gen_random_uuid())", [a, b]),
    ).rejects.toThrow('INSUFFICIENT_CREDITS');
    expect(await scalar('select balance from wallets where user_id=$1', [b])).toBe(25);
  });
  it('allows only an admin to manage another user role and prevents self-demotion', async () => {
    await expect(db.query("select set_user_role($1,$2,'admin')", [b, a])).rejects.toThrow(
      'FORBIDDEN',
    );
    await expect(db.query("select set_user_role($1,$1,'user')", [a])).rejects.toThrow(
      'SELF_ROLE_CHANGE_DENIED',
    );
    await db.query("select set_user_role($1,$2,'admin')", [a, b]);
    expect(await scalar('select role from profiles where id=$1', [b])).toBe('admin');
    await db.query("select set_user_role($1,$2,'user')", [a, b]);
  });
  it('settles a verified payment once and rejects amount mismatch', async () => {
    await db.query(
      "insert into payment_transactions(id,user_id,credits,amount_cents,currency,session_id) values($1,$2,100,1000,'usd','cs_test_1')",
      [job, b],
    );
    await expect(
      db.query("select settle_payment('evt_bad',$1,'cs_test_1','pi_test_1',100,'usd')", [job]),
    ).rejects.toThrow('PAYMENT_MISMATCH');
    await db.query("select settle_payment('evt_paid',$1,'cs_test_1','pi_test_1',1000,'usd')", [
      job,
    ]);
    await db.query("select settle_payment('evt_paid',$1,'cs_test_1','pi_test_1',1000,'usd')", [
      job,
    ]);
    await db.query(
      "select settle_payment('evt_paid_again',$1,'cs_test_1','pi_test_1',1000,'usd')",
      [job],
    );
    expect(await scalar('select balance from wallets where user_id=$1', [b])).toBe(125);
  });
  it('records cumulative refunds idempotently without overdrawing', async () => {
    await db.query("select record_refund('evt_refund_1','pi_test_1',500)");
    await db.query("select record_refund('evt_refund_1','pi_test_1',500)");
    expect(await scalar('select balance from wallets where user_id=$1', [b])).toBe(75);
    await db.query("select adjust_credits($1,$2,-70,'consume credits',gen_random_uuid())", [a, b]);
    await db.query("select record_refund('evt_refund_2','pi_test_1',1000)");
    expect(await scalar('select balance from wallets where user_id=$1', [b])).toBe(0);
    expect(
      await scalar("select credits_shortfall from payment_refunds where id='evt_refund_2'"),
    ).toBe(45);
  });
  it('fences file deletion against active jobs and deletion against new uploads', async () => {
    const f = '66666666-6666-4666-8666-666666666666';
    await db.query(
      "insert into uploaded_files(id,user_id,name,storage_path,mime_type,size_bytes,status,expires_at) values($1,$2,'second.pdf','a/second.pdf','application/pdf',100,'ready',now()+interval '1 day')",
      [f, a],
    );
    const j = await scalar(
      "select begin_analysis($1,'quotation','Active',array[$2::uuid],gen_random_uuid())",
      [a, f],
    );
    await expect(db.query('select prepare_file_deletion($1,$2)', [a, f])).rejects.toThrow(
      'ACTIVE_JOB_LIMIT',
    );
    await expect(db.query('select request_deletion($1)', [a])).rejects.toThrow('ACTIVE_JOB_LIMIT');
    await db.query("select fail_analysis($1,'TEST')", [j]);
    await db.query('select prepare_file_deletion($1,$2)', [a, f]);
    expect(await scalar('select status from uploaded_files where id=$1', [f])).toBe('deleting');
    await expect(
      db.query(
        "select begin_analysis($1,'quotation','Deleting file',array[$2::uuid],gen_random_uuid())",
        [a, f],
      ),
    ).rejects.toThrow('INVALID_FILES');
  });
  it('purges expired derived data and selects deletion retries without scanning every profile', async () => {
    await db.query("update analysis_results set created_at=now()-interval '100 days'");
    await db.query('select purge_expired_results()');
    expect(await scalar('select count(*)::int from analysis_results')).toBe(0);
    expect((await db.query('select * from expired_files()')).rows.length).toBeGreaterThan(0);
  });
  it('rate limits atomically and blocks new jobs during deletion', async () => {
    expect(await scalar("select take_rate_limit('test',1,60)")).toBe(true);
    expect(await scalar("select take_rate_limit('test',1,60)")).toBe(false);
    await db.query('select request_deletion($1)', [b]);
    await expect(
      db.query(
        "select begin_analysis($1,'quotation','Deleted',array[$2::uuid],gen_random_uuid())",
        [b, file],
      ),
    ).rejects.toThrow('CONSENT_REQUIRED');
  });
});
