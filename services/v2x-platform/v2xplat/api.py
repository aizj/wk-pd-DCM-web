"""HTTP API：标准库实现，零依赖。演示用，生产按 G.5 技术选型重写。"""
import json, os, re, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from . import (db, service, registry, config_plane, scenes, ops_center, receipts, retention,
               catalog_svc, profiles, credentials, icd, debug, duty, sandbox)

STATIC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
ROUTES = []


def route(method: str, pattern: str):
    rx = re.compile("^" + re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", pattern) + "$")
    def deco(fn):
        ROUTES.append((method, rx, fn))
        return fn
    return deco


def actor(h) -> str:
    return h.headers.get("X-Actor", "anonymous")


@route("GET", "/api/intersections")
def list_intersections(h, body, **kw):
    return 200, db.q("SELECT * FROM intersection ORDER BY id")


@route("GET", "/api/tenants")
def list_tenants(h, body, **kw):
    return 200, db.q("SELECT * FROM tenant ORDER BY id")


@route("GET", "/api/grants")
def list_grants(h, body, **kw):
    rows = db.q("SELECT * FROM grant_obj ORDER BY created_at")
    for r in rows:
        r["whitelist"] = [x["intersection_id"] for x in db.q(
            "SELECT intersection_id FROM grant_scope WHERE grant_id=? AND version=?", r["id"], r["version"])]
    return 200, rows


@route("POST", "/api/grants")
def create_grant(h, body, **kw):
    gid = service.create_grant(actor(h), body["doc_no"], body["grantor"], body["purpose"],
                               body["data_items"], body["valid_from"], body["valid_to"],
                               body.get("intersections", []))
    return 201, {"id": gid}


@route("PUT", "/api/grants/{gid}/whitelist")
def put_whitelist(h, body, gid=None):
    return 200, service.set_whitelist(actor(h), gid, body["intersections"])


@route("POST", "/api/grants/{gid}/shrink-impact")
def shrink(h, body, gid=None):
    return 200, service.shrink_impact(gid, body.get("keep", []))


@route("GET", "/api/gate")
def get_gate(h, body, **kw):
    return 200, service.get_gate()


@route("PUT", "/api/gate")
def put_gate(h, body, **kw):
    return 200, service.set_gate(actor(h), body["reviewer"], body["state"],
                                 body.get("owner_doc_no"), body.get("partner"),
                                 body.get("agreement_no"), body.get("agreement_valid_to"))


@route("GET", "/api/tenants/{tid}/gate-checklist")
def checklist(h, body, tid=None):
    return 200, service.gate_checklist(tid)


@route("POST", "/api/subscriptions")
def create_sub(h, body, **kw):
    s = service.create_subscription(actor(h), body["tenant_id"], body["service_code"],
                                    body["grant_id"], body.get("intersections", []),
                                    body.get("valid_until"))
    return 201, s


@route("GET", "/api/subscriptions")
def list_subs(h, body, **kw):
    return 200, db.q("SELECT * FROM subscription ORDER BY created_at")


@route("GET", "/api/subscriptions/{sid}")
def get_sub(h, body, sid=None):
    return 200, service.get_subscription(sid)


@route("GET", "/api/subscriptions/{sid}/preview")
def preview(h, body, sid=None):
    return 200, service.preview(sid)


@route("POST", "/api/subscriptions/{sid}/transition")
def transition(h, body, sid=None):
    try:
        return 200, service.transition(actor(h), sid, body["to"])
    except service.Denied as e:
        return 409, {"error": "BLOCKED", "findings": e.findings}


@route("GET", "/api/audit")
def audit(h, body, **kw):
    return 200, {"verified": db.audit_verify(),
                 "entries": db.q("SELECT * FROM audit_log ORDER BY seq DESC LIMIT 100")}


@route("POST", "/api/demo/reset")
def demo_reset(h, body, **kw):
    """重置演示数据：清库、造路口与租户、建一条授权。供控制台演示用。"""
    from . import seed
    db.init(reset=True)
    seed.run()
    catalog_svc.seed()
    scenes.seed()
    retention.seed()
    icd.seed()
    sandbox.seed()
    duty.seed()
    ints = [r["id"] for r in db.q("SELECT id FROM intersection WHERE published=1 ORDER BY id LIMIT 10")]
    gid = service.create_grant(actor(h), "济公交管〔2026〕18 号", "济南市公安局交警支队",
                               "数据上车信息服务", "灯态,剩余时间,控制模式,管控事件",
                               "2026-10-01", "2027-09-30", ints)
    return 200, {"grant_id": gid, "intersections": len(ints)}


@route("POST", "/api/demo/subscription")
def demo_sub(h, body, **kw):
    """按“合规 / 超范围”两种模板建订阅，方便在界面上看规则效果。"""
    g = db.q1("SELECT id FROM grant_obj ORDER BY created_at DESC LIMIT 1")
    if not g:
        return 400, {"error": "先重置演示数据"}
    n = 12 if body.get("kind") == "over" else 10
    ints = [r["id"] for r in db.q("SELECT id FROM intersection WHERE published=1 ORDER BY id LIMIT ?", n)]
    s = service.create_subscription(actor(h), body.get("tenant_id", "OEM01"), "V2X.SPAT",
                                    g["id"], ints, body.get("valid_until", "2027-12-31"))
    return 201, s


@route("GET", "/api/catalog")
def catalog(h, body, **kw):
    """全部功能结构 + 实现状态（17 子系统 / 69 模块 / 284 功能点）。"""
    return 200, {"stats": registry.stats(), "tree": registry.tree()}


@route("POST", "/api/call/{point_id}")
def call_point(h, body, point_id=None):
    """按功能点编号调用：已实现的走实现，未实现的返回计划版本与说明。"""
    try:
        return 200, {"point": point_id, "result": registry.call(point_id, **body)}
    except Exception as e:
        from .base import NotImplementedYet
        if isinstance(e, NotImplementedYet):
            return 501, {"point": point_id, "error": str(e)}
        return 400, {"point": point_id, "error": f"{type(e).__name__}: {e}"}


@route("GET", "/api/regions")
def regions(h, body, **kw):
    return 200, config_plane.regions()


@route("PUT", "/api/regions/{rid}")
def set_region(h, body, rid=None):
    config_plane.set_region_online(rid, bool(body.get("online", True)))
    return 200, config_plane.regions()


@route("GET", "/api/snapshots")
def snapshots(h, body, **kw):
    act = config_plane.active()
    return 200, {"active": act.get("id"), "history": config_plane.history()}


@route("POST", "/api/snapshots")
def build_push(h, body, **kw):
    snap = config_plane.build(actor(h))
    if body.get("push", True):
        return 201, config_plane.push(actor(h), snap["id"])
    return 201, config_plane.status(snap["id"])


@route("POST", "/api/snapshots/{sid}/ack")
def ack(h, body, sid=None):
    return 200, config_plane.ack(body["region_id"], sid, bool(body.get("ok", True)), body.get("reason"))


@route("POST", "/api/snapshots/{sid}/rollback")
def rollback(h, body, sid=None):
    return 200, config_plane.rollback(actor(h), sid, body.get("why", "手工回滚"))


# ---- CT 服务目录 ----
@route("GET", "/api/services")
def services(h, body, **kw):
    return 200, catalog_svc.services()


# ---- TN 车型能力画像 ----
@route("GET", "/api/profiles")
def list_profiles(h, body, **kw):
    return 200, profiles.listing()


@route("POST", "/api/profiles")
def create_profile(h, body, **kw):
    return 201, profiles.create(actor(h), body["tenant_id"], body["model"], body["year"], **body.get("caps", {}))


# ---- SC 场景策略与参数 ----
@route("GET", "/api/scenes")
def list_scenes(h, body, **kw):
    return 200, scenes.scenes()


@route("PUT", "/api/scenes/{code}/params/{key}")
def set_param(h, body, code=None, key=None):
    try:
        return 200, scenes.set_param(actor(h), code, key, str(body["value"]))
    except scenes.ParamError as e:
        return 409, {"error": str(e), "rule": e.rule}


@route("POST", "/api/scenes/{code}/policies")
def set_policy(h, body, code=None):
    try:
        return 201, scenes.set_policy(actor(h), code, body["scope_type"], body["scope_ref"],
                                      body["action"], body.get("time_rule"))
    except scenes.ParamError as e:
        return 409, {"error": str(e), "rule": e.rule}


@route("GET", "/api/subscriptions/{sid}/scenes")
def sub_scenes(h, body, sid=None):
    return 200, scenes.sub_scenes(sid)


@route("PUT", "/api/subscriptions/{sid}/scenes/{code}")
def set_sub_scene(h, body, sid=None, code=None):
    try:
        return 200, scenes.set_sub_scene(actor(h), sid, code, bool(body.get("enabled", True)),
                                         body.get("min_level"), body.get("ahead_m"))
    except scenes.ParamError as e:
        return 409, {"error": str(e), "rule": e.rule}


# ---- OP-3 暂停指令 ----
@route("GET", "/api/suspensions")
def suspensions(h, body, **kw):
    return 200, ops_center.suspensions()


@route("POST", "/api/suspensions")
def issue_suspend(h, body, **kw):
    return 201, ops_center.issue_suspend(actor(h), body["scope_type"], body["scope_ref"],
                                         body.get("kind", "SPECIAL_DUTY"), body.get("note"))


@route("POST", "/api/suspensions/{sid}/lift")
def lift_suspend(h, body, sid=None):
    return 200, ops_center.lift_suspend(actor(h), sid)


# ---- NT-4 工单 ----
@route("GET", "/api/tickets")
def tickets(h, body, **kw):
    return 200, ops_center.tickets()


@route("POST", "/api/tickets")
def create_ticket(h, body, **kw):
    return 201, ops_center.create_ticket(actor(h), body.get("kind", "QUALITY"), body["title"],
                                         body["target"], body.get("priority", "D3"),
                                         body.get("intersection_id"), body.get("sub_id"))


@route("POST", "/api/tickets/{tid}/dispatch")
def dispatch_ticket(h, body, tid=None):
    return 200, ops_center.dispatch(actor(h), tid)


@route("POST", "/api/tickets/{tid}/close")
def close_ticket(h, body, tid=None):
    return 200, ops_center.close_ticket(actor(h), tid, body.get("conclusion", "已处置"))


# ---- EV-1 回执 ----
@route("GET", "/api/receipts")
def receipt_stats(h, body, **kw):
    return 200, receipts.stats()


@route("POST", "/api/receipts")
def ingest_receipts(h, body, **kw):
    try:
        return 200, receipts.ingest(actor(h), body["sub_id"], body["hour"], body["rows"])
    except receipts.Rejected as e:
        return 422, {"error": str(e)}


@route("POST", "/api/receipts/anomaly")
def receipt_anomaly(h, body, **kw):
    return 201, receipts.anomaly(actor(h), body["sub_id"], body["kind"], body.get("detail", ""))


# ---- AU-4 留存与销毁 ----
@route("GET", "/api/retention")
def retention_view(h, body, **kw):
    return 200, {"policies": retention.policies(), "certificates": retention.certificates()}


@route("PUT", "/api/retention/{cat}")
def set_retention(h, body, cat=None):
    return 200, retention.set_policy(actor(h), cat, int(body["days"]))


@route("POST", "/api/retention/{cat}/purge")
def purge(h, body, cat=None):
    return 200, retention.purge(actor(h), cat)


# ---- CR 凭证与环境 ----
@route("GET", "/api/certs")
def list_certs(h, body, **kw):
    return 200, {"certs": credentials.certs(), "expiring": credentials.expiring(),
                 "ips": credentials.ip_list()}


@route("POST", "/api/certs")
def issue_cert(h, body, **kw):
    try:
        return 201, credentials.issue(actor(h), body["tenant_id"], body["env"], body["csr"], body.get("replaces"))
    except credentials.CertError as e:
        return 422, {"error": str(e), "rule": e.rule}


@route("POST", "/api/certs/{cid}/revoke")
def revoke_cert(h, body, cid=None):
    return 200, credentials.revoke(actor(h), cid, body.get("reason", "未说明"))


@route("GET", "/api/envs/{tid}")
def env_status(h, body, tid=None):
    return 200, credentials.env_status(tid)


@route("POST", "/api/envs/{tid}/{env}/open")
def open_env(h, body, tid=None, env=None):
    try:
        return 200, credentials.open_env(actor(h), tid, env)
    except credentials.CertError as e:
        return 409, {"error": str(e), "rule": e.rule}


@route("POST", "/api/ip-allow")
def apply_ip(h, body, **kw):
    try:
        return 201, credentials.request_ip(actor(h), body["tenant_id"], body["env"], body["cidr"], body.get("purpose", ""))
    except credentials.CertError as e:
        return 422, {"error": str(e), "rule": e.rule}


@route("POST", "/api/ip-allow/{rid}/approve")
def approve_ip(h, body, rid=None):
    try:
        return 200, credentials.approve_ip(actor(h), rid)
    except credentials.CertError as e:
        return 409, {"error": str(e), "rule": e.rule}


# ---- AD ICD 与服务版本 ----
@route("GET", "/api/icds")
def list_icds(h, body, **kw):
    return 200, {"icds": icd.icds(), "versions": icd.service_versions()}


@route("POST", "/api/icds")
def upload_icd(h, body, **kw):
    try:
        return 201, icd.upload(actor(h), body["version"], body["title"], body.get("spec_kind", "OpenAPI"),
                               body.get("spec_ref", ""), body.get("changes", ""))
    except icd.IcdError as e:
        return 409, {"error": str(e), "rule": e.rule}


@route("PUT", "/api/icds/{iid}/state")
def set_icd_state(h, body, iid=None):
    try:
        return 200, icd.set_state(actor(h), iid, body["state"], body.get("compat"))
    except icd.IcdError as e:
        return 409, {"error": str(e), "rule": e.rule}


@route("POST", "/api/icds/{iid}/ack")
def ack_icd(h, body, iid=None):
    try:
        return 200, icd.ack(actor(h), iid, body.get("tenant_id", "OEM01"))
    except icd.IcdError as e:
        return 409, {"error": str(e), "rule": e.rule}


# ---- DT-2 订阅调试器 ----
@route("GET", "/api/subscriptions/{sid}/diagnose")
def diagnose(h, body, sid=None):
    q = h.query
    return 200, debug.diagnose(sid, q.get("intersection"), q.get("scene", "SPAT"))


# ---- DT-1 / DT-3 沙箱与准出 ----
@route("GET", "/api/sandbox")
def sandbox_view(h, body, **kw):
    tid = h.query.get("tenant", "OEM01")
    return 200, {"faults": sandbox.FAULTS, "runs": sandbox.runs(), "cases": sandbox.cases(),
                 "report": sandbox.report(tid, h.query.get("phase", "sandbox"))}


@route("POST", "/api/sandbox/faults")
def inject_fault(h, body, **kw):
    return 201, sandbox.inject(actor(h), body.get("tenant_id", "OEM01"), body["kind"], body["target"])


@route("POST", "/api/sandbox/faults/{fid}/finish")
def finish_fault(h, body, fid=None):
    return 200, sandbox.finish(actor(h), fid)


@route("POST", "/api/sandbox/runs")
def record_run(h, body, **kw):
    return 201, sandbox.record(actor(h), body.get("tenant_id", "OEM01"), body["case_id"], body["result"],
                               body.get("icd_id"), body.get("defect_level"), body.get("note", ""))


# ---- OP-6 值班与应急 ----
@route("GET", "/api/incidents")
def list_incidents(h, body, **kw):
    return 200, {"roster": duty.roster(), "incidents": duty.incidents(), "actions": duty.ACTIONS}


@route("POST", "/api/incidents")
def open_incident(h, body, **kw):
    return 201, duty.open_incident(actor(h), body.get("level", "P2"), body["title"], body.get("summary", ""))


@route("POST", "/api/incidents/{iid}/act")
def incident_act(h, body, iid=None):
    return 200, duty.act(actor(h), iid, body["action"], body["target"])


@route("POST", "/api/incidents/{iid}/notify")
def incident_notify(h, body, iid=None):
    return 200, duty.notify(actor(h), iid, body.get("channel", "短信"), body.get("text", ""))


@route("POST", "/api/incidents/{iid}/close")
def incident_close(h, body, iid=None):
    try:
        return 200, duty.close(actor(h), iid, body.get("review", ""))
    except ValueError as e:
        return 422, {"error": str(e)}


class Handler(BaseHTTPRequestHandler):
    server_version = "v2xplat/0.1"

    def log_message(self, fmt, *args):
        pass

    def _send(self, code, payload):
        data = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    CT = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8"}

    def _static(self, path):
        name = "index.html" if path in ("/", "") else path.lstrip("/")
        full = os.path.join(STATIC, os.path.basename(name))
        if not os.path.exists(full):
            return self._send(404, {"error": "not found"})
        data = open(full, "rb").read()
        self.send_response(200)
        self.send_header("Content-Type", self.CT.get(os.path.splitext(full)[1], "text/plain; charset=utf-8"))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _handle(self, method):
        path, _, qs = self.path.partition("?")
        self.query = {k: v[0] for k, v in urllib.parse.parse_qs(qs).items()}
        if not path.startswith("/api/"):
            return self._static(path)
        body = {}
        n = int(self.headers.get("Content-Length") or 0)
        if n:
            body = json.loads(self.rfile.read(n) or b"{}")
        for m, rx, fn in ROUTES:
            if m != method:
                continue
            mt = rx.match(path)
            if mt:
                try:
                    code, payload = fn(self, body, **mt.groupdict())
                except KeyError as e:
                    code, payload = 404, {"error": f"not found: {e}"}
                except ValueError as e:
                    code, payload = 400, {"error": str(e)}
                return self._send(code, payload)
        self._send(404, {"error": "no route"})

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")

    def do_PUT(self):
        self._handle("PUT")


def serve(port: int = 8787):
    db.init()
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"v2xplat listening on http://127.0.0.1:{port}")
    srv.serve_forever()
