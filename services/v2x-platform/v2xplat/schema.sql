CREATE TABLE IF NOT EXISTS tenant (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('OEM','MAP','TEST_FLEET')),
  status TEXT NOT NULL DEFAULT 'ACTIVE', created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS intersection (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, district TEXT NOT NULL,
  corridor TEXT, road_class TEXT NOT NULL, ctrl_mode TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0, quality TEXT NOT NULL DEFAULT 'X');

-- 授权对象：交警授权书 / 授权运营协议在平台中的执行形态（GR-1）
CREATE TABLE IF NOT EXISTS grant_obj (
  id TEXT PRIMARY KEY, doc_no TEXT NOT NULL, grantor TEXT NOT NULL,
  purpose TEXT NOT NULL, data_items TEXT NOT NULL,
  valid_from TEXT NOT NULL, valid_to TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS grant_scope (
  grant_id TEXT NOT NULL, version INTEGER NOT NULL, intersection_id TEXT NOT NULL,
  PRIMARY KEY (grant_id, version, intersection_id));

-- 对外提供门禁：授权路径状态（GR-2 / R-00）
CREATE TABLE IF NOT EXISTS auth_path (
  id INTEGER PRIMARY KEY CHECK(id=1),
  state TEXT NOT NULL CHECK(state IN ('UNCONFIRMED','OPERATOR_AUTHORIZED','PARTNER_AUTHORIZED','EXPIRED','REVOKED')),
  owner_doc_no TEXT, partner TEXT, agreement_no TEXT, agreement_valid_to TEXT,
  updated_by TEXT, reviewed_by TEXT, updated_at TEXT);

CREATE TABLE IF NOT EXISTS subscription (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, service_code TEXT NOT NULL,
  grant_id TEXT NOT NULL, env TEXT NOT NULL CHECK(env IN ('sandbox','preprod','prod')),
  state TEXT NOT NULL, valid_until TEXT, version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS scope_item (
  sub_id TEXT NOT NULL, intersection_id TEXT NOT NULL, source TEXT NOT NULL,
  PRIMARY KEY (sub_id, intersection_id));

-- 审计：哈希链，防篡改（AU-1）
CREATE TABLE IF NOT EXISTS audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, actor TEXT NOT NULL,
  action TEXT NOT NULL, obj TEXT NOT NULL, detail TEXT NOT NULL,
  prev_hash TEXT NOT NULL, hash TEXT NOT NULL);

-- 区域云注册表（DEC-16：起步区 + 主城区）
CREATE TABLE IF NOT EXISTS region (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, online INTEGER NOT NULL DEFAULT 1);

-- 配置快照：不可变，按区域云下发，全有或全无（CF-2）
CREATE TABLE IF NOT EXISTS snapshot (
  id TEXT PRIMARY KEY, version INTEGER NOT NULL, hash TEXT NOT NULL,
  prev_id TEXT, content TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('BUILT','PUSHING','ACTIVE','ROLLED_BACK','SUPERSEDED')),
  created_by TEXT NOT NULL, created_at TEXT NOT NULL, activated_at TEXT);

CREATE TABLE IF NOT EXISTS snapshot_ack (
  snapshot_id TEXT NOT NULL, region_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('PENDING','ACKED','FAILED')),
  acked_at TEXT, reason TEXT,
  PRIMARY KEY (snapshot_id, region_id));

-- CT-1 服务目录
CREATE TABLE IF NOT EXISTS service_def (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, level TEXT NOT NULL, quality_min TEXT NOT NULL,
  channel TEXT NOT NULL, min_capability TEXT NOT NULL, unit TEXT NOT NULL, phase TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE');

-- TN-2 车型能力画像
CREATE TABLE IF NOT EXISTS vehicle_profile (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, model TEXT NOT NULL, year TEXT NOT NULL,
  tbox TEXT NOT NULL, pc5 INTEGER NOT NULL DEFAULT 0, positioning TEXT NOT NULL,
  nav TEXT NOT NULL, hud TEXT NOT NULL, lane_cam INTEGER NOT NULL DEFAULT 0,
  display_tier TEXT NOT NULL, match_max TEXT NOT NULL, level_max TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);

-- SC 场景、配置项、启用策略、租户场景订阅
CREATE TABLE IF NOT EXISTS scene (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, level TEXT NOT NULL,
  compute TEXT NOT NULL, quality_req TEXT NOT NULL, phase TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scene_param (
  scene_code TEXT NOT NULL, key TEXT NOT NULL, label TEXT NOT NULL, category TEXT NOT NULL,
  value TEXT NOT NULL, dflt TEXT NOT NULL, vmin REAL, vmax REAL, only_tighten INTEGER NOT NULL DEFAULT 0,
  direction TEXT NOT NULL DEFAULT 'down', grain TEXT NOT NULL, approval TEXT NOT NULL,
  PRIMARY KEY (scene_code, key));
CREATE TABLE IF NOT EXISTS scene_policy (
  id TEXT PRIMARY KEY, scene_code TEXT NOT NULL, scope_type TEXT NOT NULL, scope_ref TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('ENABLE','DISABLE')), time_rule TEXT,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sub_scene (
  sub_id TEXT NOT NULL, scene_code TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
  min_level TEXT, ahead_m INTEGER, PRIMARY KEY (sub_id, scene_code));

-- OP-3 暂停指令
CREATE TABLE IF NOT EXISTS suspend_order (
  id TEXT PRIMARY KEY, scope_type TEXT NOT NULL, scope_ref TEXT NOT NULL, kind TEXT NOT NULL,
  note TEXT, state TEXT NOT NULL CHECK(state IN ('ACTIVE','LIFTED')),
  issued_by TEXT NOT NULL, issued_at TEXT NOT NULL, lifted_at TEXT);

-- NT-4 工单与派单
CREATE TABLE IF NOT EXISTS ticket (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, target TEXT NOT NULL,
  intersection_id TEXT, sub_id TEXT, priority TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('OPEN','DISPATCHED','RESOLVED','CLOSED')),
  sla_hours INTEGER NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
  closed_at TEXT, conclusion TEXT);

-- EV-1 回执
CREATE TABLE IF NOT EXISTS receipt_agg (
  sub_id TEXT NOT NULL, hour TEXT NOT NULL, intersection_id TEXT NOT NULL,
  status TEXT NOT NULL, reason_code TEXT, cnt INTEGER NOT NULL,
  PRIMARY KEY (sub_id, hour, intersection_id, status, reason_code));
CREATE TABLE IF NOT EXISTS receipt_anomaly (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sub_id TEXT NOT NULL, kind TEXT NOT NULL,
  detail TEXT NOT NULL, ts TEXT NOT NULL, handled INTEGER NOT NULL DEFAULT 0);

-- AU-4 留存与销毁
CREATE TABLE IF NOT EXISTS retention_policy (
  category TEXT PRIMARY KEY, days INTEGER NOT NULL, basis TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS purge_log (
  id TEXT PRIMARY KEY, category TEXT NOT NULL, rows_removed INTEGER NOT NULL,
  cert_no TEXT NOT NULL, ts TEXT NOT NULL, operator TEXT NOT NULL);

-- CR-1 证书生命周期
CREATE TABLE IF NOT EXISTS cert (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, env TEXT NOT NULL CHECK(env IN ('sandbox','preprod','prod')),
  cn TEXT NOT NULL, serial TEXT NOT NULL, fingerprint TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('ISSUED','ROTATING','EXPIRED','REVOKED')),
  issued_at TEXT NOT NULL, not_after TEXT NOT NULL, revoked_at TEXT, revoke_reason TEXT,
  replaces TEXT, issued_by TEXT NOT NULL);
-- CR-2 出口 IP 白名单与环境开通
CREATE TABLE IF NOT EXISTS ip_allow (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, env TEXT NOT NULL, cidr TEXT NOT NULL,
  purpose TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('PENDING','ACTIVE','REMOVED')),
  applied_by TEXT NOT NULL, applied_at TEXT NOT NULL, approved_by TEXT, approved_at TEXT);
CREATE TABLE IF NOT EXISTS env_quota (
  tenant_id TEXT NOT NULL, env TEXT NOT NULL, conn_max INTEGER NOT NULL, conn_used INTEGER NOT NULL DEFAULT 0,
  msg_quota INTEGER NOT NULL, opened INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, env));

-- AD-1 / AD-2 服务版本与 ICD
CREATE TABLE IF NOT EXISTS icd (
  id TEXT PRIMARY KEY, version TEXT NOT NULL, title TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('DRAFT','REVIEW','FROZEN','DEPRECATED')),
  spec_kind TEXT NOT NULL, spec_ref TEXT NOT NULL, changes TEXT, compat TEXT,
  created_at TEXT NOT NULL, frozen_at TEXT, frozen_by TEXT);
CREATE TABLE IF NOT EXISTS icd_ack (
  icd_id TEXT NOT NULL, tenant_id TEXT NOT NULL, acked_by TEXT NOT NULL, acked_at TEXT NOT NULL,
  PRIMARY KEY (icd_id, tenant_id));
CREATE TABLE IF NOT EXISTS service_version (
  service_code TEXT NOT NULL, version TEXT NOT NULL, icd_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('PREVIEW','RELEASED','DEPRECATED')),
  released_at TEXT, sunset_at TEXT, PRIMARY KEY (service_code, version));

-- DT-1 / DT-3 联调：故障注入与用例
CREATE TABLE IF NOT EXISTS fault_run (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, kind TEXT NOT NULL, target TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('RUNNING','FINISHED')), started_at TEXT NOT NULL, ended_at TEXT,
  observed TEXT);
CREATE TABLE IF NOT EXISTS testcase (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, phase TEXT NOT NULL, expect TEXT NOT NULL, mandatory INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS test_run (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, case_id TEXT NOT NULL, icd_id TEXT,
  result TEXT NOT NULL CHECK(result IN ('PASS','FAIL','NA')), defect_level TEXT, note TEXT,
  run_by TEXT NOT NULL, run_at TEXT NOT NULL);

-- OP-6 值班与应急
CREATE TABLE IF NOT EXISTS duty_roster (
  id TEXT PRIMARY KEY, day TEXT NOT NULL, shift TEXT NOT NULL, owner TEXT NOT NULL,
  escalate TEXT NOT NULL, phone TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS incident (
  id TEXT PRIMARY KEY, level TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('OPEN','HANDLING','NOTIFIED','CLOSED')),
  actions TEXT, notify_due TEXT, review TEXT,
  opened_by TEXT NOT NULL, opened_at TEXT NOT NULL, closed_at TEXT);
