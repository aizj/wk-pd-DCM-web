/* 页面定义：按设计文档第 21 章信息架构。render 为空则渲染功能骨架页。 */

// ===== 复用片段 =====
async function gateBlock() {
  const g = (await api('/api/gate')).body, cl = (await api('/api/tenants/OEM01/gate-checklist')).body;
  return UI.card({
    title: '授权路径与门禁状态',
    ops: [UI.btn('置为已确认', "setGate('OPERATOR_AUTHORIZED')", {type: 'primary', size: 'sm'}),
          UI.btn('置回未确认', "confirmGate()", {size: 'sm'})],
    body: UI.desc([
      ['授权路径状态', stateTag(g.state)],
      ['依据文件', `<span class="mono">${esc(g.owner_doc_no || '—')}</span>`],
      ['合作机构 / 协议', `${esc(g.partner || '—')} / <span class="mono">${esc(g.agreement_no || '—')}</span>`],
      ['录入 / 复核', `${esc(g.updated_by || '—')} / ${esc(g.reviewed_by || '—')}`],
      ['更新时间', `<span class="mono">${esc((g.updated_at || '—').slice(0, 19).replace('T', ' '))}</span>`],
    ])}) + UI.card({
    title: `门禁检查项（租户 OEM01）`,
    ops: [cl.passed ? UI.tag('可对外提供', 'green') : UI.tag('尚不可对外提供', 'red')],
    flush: true,
    body: UI.table({
      columns: [{title: '检查项', key: 'item'}, {title: '状态', render: r => r.ok ? UI.status('通过', 'green') : UI.status('未满足', 'red')},
                {title: '责任方', key: 'owner'}, {title: '当前值', key: 'detail', cls: 'num'}],
      rows: cl.items})})
    + UI.alert('依据总体方案 DEC-08：向车企、图商提供数据（含免费）前须确认公共数据授权路径。未确认时订阅可进沙箱，不可进预生产与生产。');
}
async function setGate(state) {
  const r = await api('/api/gate', {method: 'PUT', body: JSON.stringify({
    state, reviewer: 'sec.zhao', owner_doc_no: state === 'UNCONFIRMED' ? null : '济数据局复〔2026〕7 号'})});
  UI.message(r.ok ? `门禁已置为 ${state}` : (r.body.error || '操作失败'), r.ok ? 'success' : 'error');
  reload();
}
function confirmGate() {
  UI.confirm({title: '置回未确认？', danger: true, okText: '确认置回',
    text: '置回后，所有车企与图商的订阅将无法迁移到预生产与生产环境，已在生产的订阅按流程需暂停。',
    onOk: () => setGate('UNCONFIRMED')});
}

async function subRows() {
  const ss = (await api('/api/subscriptions')).body, out = [];
  for (const s of ss) {
    const p = (await api(`/api/subscriptions/${s.id}/preview`)).body;
    out.push({...s, deliverable: p.deliverable, requested: p.requested, quality: p.by_quality,
              blockers: p.findings.filter(f => f.level === 'BLOCK').map(f => f.rule), findings: p.findings});
  }
  return out;
}
function subColumns(withOps) {
  const cols = [
    {title: '订阅编号', key: 'id', cls: 'num'},
    {title: '租户', key: 'tenant_id'},
    {title: '服务', key: 'service_code', cls: 'num'},
    {title: '状态', render: r => stateTag(r.state)},
    {title: '环境', render: r => UI.tag(r.env, r.env === 'prod' ? 'green' : (r.env === 'preprod' ? 'blue' : 'grey'))},
    {title: '可交付 / 请求', cls: 'num', render: r => `${r.deliverable} / ${r.requested}`},
    {title: '质量分布', cls: 'num', render: r => Object.entries(r.quality).map(([q, n]) => `${q}:${n}`).join(' ') || '—'},
    {title: '拦截规则', render: r => r.blockers.length ? r.blockers.map(b => UI.tag(b, 'red')).join(' ') : UI.tag('无', 'green')},
  ];
  if (withOps) cols.push({title: '操作', render: r =>
    UI.link('详情', `subDetail('${r.id}')`) + UI.link('进沙箱', `promote('${r.id}','SANDBOX')`) +
    UI.link('上生产', `promote('${r.id}','ACTIVE')`)});
  return cols;
}
async function subDetail(id) {
  const s = (await api(`/api/subscriptions/${id}`)).body;
  const p = (await api(`/api/subscriptions/${id}/preview`)).body;
  UI.drawer({title: `订阅详情 ${id}`, body:
    UI.desc([['租户', esc(s.tenant_id)], ['服务', `<span class="mono">${esc(s.service_code)}</span>`],
             ['状态', stateTag(s.state)], ['环境', esc(s.env)],
             ['授权', `<span class="mono">${esc(s.grant_id)}</span>`],
             ['有效期至', `<span class="mono">${esc(s.valid_until || '—')}</span>`],
             ['版本', `v${s.version}`],
             ['可交付', `${p.deliverable} / ${p.requested}`]])
    + `<h4 style="margin:18px 0 8px">规则校验</h4>`
    + UI.table({columns: [{title: '规则', key: 'rule', cls: 'num'},
        {title: '级别', render: r => UI.tag(r.level, r.level === 'BLOCK' ? 'red' : 'gold')},
        {title: '说明', key: 'message'}], rows: p.findings, empty: '全部通过'})
    + `<h4 style="margin:18px 0 8px">订阅路口（${s.intersections.length}）</h4>
       <div class="mono muted">${s.intersections.join('、')}</div>`});
}
async function promote(id, to) {
  const r = await api(`/api/subscriptions/${id}/transition`, {method: 'POST', body: JSON.stringify({to})});
  if (r.ok) { UI.message(`${id} 已迁移到 ${r.body.state}`); reload(); }
  else {
    UI.message('迁移被规则拦截', 'error');
    UI.drawer({title: `迁移被拦截 · ${id}`, body:
      UI.alert('规则在迁移前终检（CF-1.4），拦截同样写入审计（SUB_TRANSITION_DENIED）。', 'warn')
      + UI.table({columns: [{title: '规则', key: 'rule', cls: 'num'},
          {title: '级别', render: f => UI.tag(f.level, f.level === 'BLOCK' ? 'red' : 'gold')},
          {title: '说明', key: 'message'},
          {title: '对象', render: f => `<span class="mono">${esc((f.objects || []).join('、') || '—')}</span>`}],
        rows: r.body.findings})});
  }
}
async function act(url, method, body, msg) {
  const r = await api(url, {method, body: JSON.stringify(body)});
  UI.message(r.ok ? msg : (r.body.error || '操作失败'), r.ok ? 'success' : 'error');
  reload();
}

// ===== 页面 =====
const PAGES = [
// ---------- 运营控制台 ----------
{persona: 'ops', group: '总览', id: 'overview', title: '服务全景', icon: '◎', modules: ['OP-1'], render: async () => {
  const [c, ints, snaps, subs] = await Promise.all([
    api('/api/catalog'), api('/api/intersections'), api('/api/snapshots'), subRows()]);
  const pub = ints.body.filter(i => i.published);
  const act = snaps.body.history.find(h => h.id === snaps.body.active);
  return UI.pageHead({title: '服务全景', desc: '平台运行状态总览。当前按附录 E 的 S4 情形运行：授权路径未确认、交管统一出口未接入，灯态由仿真源提供。',
      ops: [UI.btn('重置演示数据', "act('/api/demo/reset','POST',{},'已重置演示数据')"),
            UI.btn('生成并下发快照', "act('/api/snapshots','POST',{push:true},'已生成并下发快照')", {type: 'primary'})]})
    + UI.stats([
      {title: '已发布路口', value: pub.length, sub: `共 ${ints.body.length} 个`},
      {title: '订阅', value: subs.length, sub: `生产环境 ${subs.filter(s => s.env === 'prod').length}`},
      {title: '生效配置版本', value: act ? 'v' + act.version : '—', sub: act ? act.hash : '尚无生效快照'},
      {title: '功能实现', value: `${c.body.stats.done + c.body.stats.partial}`, sub: `共 ${c.body.stats.points} 个功能点`},
      {title: 'A 级路口', value: pub.filter(i => i.quality === 'A').length, sub: '绿波与闯红灯提醒资格'},
    ])
    + `<div class="grid2">${await gateBlock()}</div>`
    + UI.card({title: '订阅一览', flush: true, ops: [UI.btn('前往审核队列', "location.hash='#/ops/review'", {size: 'sm'})],
        body: UI.table({columns: subColumns(false), rows: subs, empty: '暂无订阅'})});
}},

{persona: 'ops', group: '准入与授权', id: 'grants', title: '授权管理', icon: '§', modules: ['GR-1'], render: async () => {
  const gr = (await api('/api/grants')).body;
  return UI.pageHead({title: '授权管理', desc: '交警授权书与授权运营协议在平台中的执行形态，白名单只增版本、可回溯，是所有订阅的范围上限（GR-1、R-01）。',
      ops: [UI.btn('重置演示数据', "act('/api/demo/reset','POST',{},'已重置演示数据')")]})
    + (gr.length ? gr.map(x => UI.card({
        title: x.doc_no, ops: [UI.tag(`v${x.version}`, 'blue'), UI.tag(`${x.whitelist.length} 个路口`, 'grey')],
        body: UI.desc([
          ['授权方', esc(x.grantor)], ['用途', esc(x.purpose)],
          ['数据项', `<span class="mono">${esc(x.data_items)}</span>`],
          ['有效期', `<span class="mono">${x.valid_from} 至 ${x.valid_to}</span>`],
          ['路口白名单', `<span class="mono muted">${x.whitelist.join('、')}</span>`]])})).join('')
      : UI.card({body: UI.empty('暂无授权', '点右上「重置演示数据」生成示例授权')}));
}},

{persona: 'ops', group: '准入与授权', id: 'gate', title: '对外提供门禁', icon: '⊘', modules: ['GR-2'], render: async () =>
  UI.pageHead({title: '对外提供门禁', desc: '控制平台能否向车企、图商提供数据。门禁未确认时，规则 R-00 会在订阅迁移前拦截。'}) + await gateBlock()},

{persona: 'ops', group: '准入与授权', id: 'tenants', title: '租户管理', icon: '☰', modules: ['TN-1', 'TN-3'], render: async () => {
  const ts = (await api('/api/tenants')).body;
  return UI.pageHead({title: '租户管理', desc: '车企、图商与示范车队的入驻与资质状态。'})
    + UI.card({flush: true, body: UI.table({
        columns: [{title: '租户编号', key: 'id', cls: 'num'}, {title: '名称', key: 'name'},
          {title: '类型', render: r => UI.tag({OEM: '车企', MAP: '图商', TEST_FLEET: '示范车队'}[r.kind] || r.kind, 'blue')},
          {title: '状态', render: r => UI.status(r.status === 'ACTIVE' ? '正常' : r.status, r.status === 'ACTIVE' ? 'green' : 'grey')},
          {title: '入驻时间', cls: 'num', render: r => esc((r.created_at || '').slice(0, 10))},
          {title: '操作', render: r => UI.link('门禁清单', `location.hash='#/oem/gate-status'`)}],
        rows: ts})});
}},

{persona: 'ops', group: '订阅与配置', id: 'review', title: '审核队列与订阅', icon: '✓', modules: ['SB-1', 'SB-3', 'SB-4'], render: async () => {
  const rows = await subRows();
  return UI.pageHead({title: '审核队列与订阅', desc: '订阅从草稿到生产的全过程。迁移前执行规则终检，拦截与通过都会写审计。',
      ops: [UI.btn('新建合规订阅', "act('/api/demo/subscription','POST',{kind:'ok'},'已建合规订阅')"),
            UI.btn('新建超范围订阅', "act('/api/demo/subscription','POST',{kind:'over'},'已建超范围订阅（用于演示 R-01）')")]})
    + UI.card({flush: true, body: UI.table({columns: subColumns(true), rows, empty: '暂无订阅'})});
}},

{persona: 'ops', group: '订阅与配置', id: 'release', title: '发布与灰度', icon: '⇪', modules: ['CF-2', 'CF-3'], render: async () => {
  const rs = (await api('/api/regions')).body, d = (await api('/api/snapshots')).body;
  return UI.pageHead({title: '发布与灰度', desc: '配置以不可变快照下发各区域云；全有或全无，任一确认失败即整版回滚。',
      ops: [UI.btn('生成并下发快照', "act('/api/snapshots','POST',{push:true},'已生成并下发快照')", {type: 'primary'})]})
    + UI.card({title: '区域云', flush: true, body: UI.table({
        columns: [{title: '区域云', key: 'id', cls: 'num'}, {title: '名称', key: 'name'},
          {title: '状态', render: r => r.online ? UI.status('在线', 'green') : UI.status('离线', 'red')},
          {title: '操作', render: r => UI.link(r.online ? '模拟离线' : '恢复在线', `toggleRegion('${r.id}',${r.online ? 0 : 1})`, r.online)}],
        rows: rs})})
    + UI.card({title: '配置快照', flush: true, body: UI.table({
        columns: [
          {title: '版本', cls: 'num', render: h => 'v' + h.version},
          {title: '快照编号', key: 'id', cls: 'num'},
          {title: '内容哈希', key: 'hash', cls: 'num'},
          {title: '状态', render: h => stateTag(h.state)},
          {title: '区域云确认', render: h => h.acks.map(a =>
              `<span class="tag ${TAGS[a.state]}">${a.region_id} ${a.state}</span>`).join(' ') || '—'},
          {title: '生成人', key: 'created_by'},
          {title: '生成时间', cls: 'num', render: h => esc((h.created_at || '').slice(11, 19))},
          {title: '操作', render: h =>
            (h.state === 'PUSHING' ? h.acks.filter(a => a.state === 'PENDING').map(a =>
              UI.link(`${a.region_id} 确认`, `ackSnap('${h.id}','${a.region_id}',true)`) +
              UI.link('确认失败', `ackSnap('${h.id}','${a.region_id}',false)`, true)).join('') : '') +
            (h.state === 'ACTIVE' ? UI.link('回滚', `confirmRollback('${h.id}')`, true) : '')}],
        rows: d.history, empty: '暂无快照'})})
    + UI.alert('回滚 = 重新激活上一版本；区域云在配置中心不可用时按本地最近一次生效快照继续运行。');
}},

{persona: 'ops', group: '订阅与配置', id: 'scene', title: '场景策略与下发', icon: '◈', modules: ['SC-1', 'SC-2', 'SC-3', 'SC-5'], render: async () => {
  const sc = (await api('/api/scenes')).body;
  const cat = {D: '数据算法参数', W: '平台计算预警参数', P: '下发策略'};
  const on = c => (c.policies.find(p => p.scope_type === 'city') || {}).action === 'ENABLE';
  return UI.pageHead({title: '场景策略与下发',
      desc: '平台侧配置三类：D 数据算法参数、W 平台计算预警参数、P 下发策略。车端算法阈值与 HMI 由车企负责，平台不配置。'})
    + UI.stats([{title: '场景总数', value: sc.length},
        {title: '全市启用', value: sc.filter(on).length, sub: `关闭 ${sc.filter(c => !on(c)).length}`},
        {title: '平台计算场景', value: sc.filter(c => c.compute === '平台').length, sub: '其余为车端计算'},
        {title: '可配参数', value: sc.reduce((a, c) => a + c.params.length, 0)}])
    + UI.card({title: '场景清单与全市策略', flush: true, body: UI.table({
        columns: [{title: '场景', render: c => `<b>${esc(c.code)}</b> ${esc(c.name)}`},
          {title: '服务等级', render: c => UI.tag(c.level, 'blue')},
          {title: '计算侧', render: c => UI.tag(c.compute, c.compute === '平台' ? 'gold' : 'grey')},
          {title: '质量门槛', render: c => stateTag(c.quality_req)},
          {title: '版本', render: c => UI.tag(c.phase, 'blue')},
          {title: '全市状态', render: c => on(c) ? UI.status('启用', 'green') : UI.status('关闭', 'grey')},
          {title: '参数', cls: 'num', render: c => c.params.length},
          {title: '操作', render: c => UI.link('参数与策略', `sceneDrawer('${c.code}')`)
            + UI.link(on(c) ? '全市关闭' : '全市启用', `toggleScene('${c.code}',${on(c) ? 0 : 1})`, on(c))}],
        rows: sc})})
    + UI.card({title: '参数护栏', flush: true, body: UI.table({
        columns: [{title: '场景', key: 'scene_code', cls: 'num'},
          {title: '参数', render: r => `${esc(r.label)} <span class="mono muted">${esc(r.key)}</span>`},
          {title: '类别', render: r => UI.tag(cat[r.category] || r.category, r.category === 'W' ? 'gold' : 'blue')},
          {title: '当前 / 默认', cls: 'num', render: r => `${esc(r.value)} / ${esc(r.dflt)}`},
          {title: '允许范围', cls: 'num', render: r => `${r.vmin} – ${r.vmax}`},
          {title: '只可收紧', render: r => r.only_tighten ? UI.tag('是（R-18）', 'red') : UI.tag('否', 'grey')},
          {title: '粒度', key: 'grain'}, {title: '审批', key: 'approval'}],
        rows: sc.flatMap(c => c.params), page: STATE.p || 1, size: 10, onPage: 'goPage'})})
    + UI.alert('R-17 参数须落在允许范围内；R-18 标记为只可收紧的参数不得向放宽方向修改；R-21 安全类预警只在边缘云直连计算。');
}},

{persona: 'ops', group: '运行监控', id: 'quality', title: '路口与质量', icon: '≡', modules: ['OP-1', 'OP-2'], render: async () => {
  const ints = (await api('/api/intersections')).body;
  const pub = ints.filter(i => i.published), byq = {};
  pub.forEach(i => byq[i.quality] = (byq[i.quality] || 0) + 1);
  const kw = (STATE.kw || '').trim();
  const rows = ints.filter(i => !kw || i.id.includes(kw) || i.name.includes(kw) || (i.corridor || '').includes(kw));
  return UI.pageHead({title: '路口与质量', desc: 'S4 情形下灯态来自仿真源，质量等级为演示值；接入统一出口后由质量评级模块实时产生。'})
    + UI.stats([{title: '路口总数', value: ints.length},
        {title: '已发布', value: pub.length, sub: `未发布 ${ints.length - pub.length}`},
        ...Object.entries(byq).map(([q, n]) => ({title: `${q} 级路口`, value: n}))])
    + UI.card({flush: true, body: UI.table({
        filters: [`<label>搜索</label><input type="search" placeholder="路口编号 / 名称 / 走廊" value="${esc(kw)}"
                   oninput="STATE.kw=this.value" onkeydown="if(event.key==='Enter')reload()">`,
                  UI.btn('查询', 'reload()', {type: 'primary', size: 'sm'}),
                  UI.btn('重置', "STATE.kw='';reload()", {size: 'sm'})],
        columns: [{title: '路口编号', key: 'id', cls: 'num'}, {title: '名称', key: 'name'},
          {title: '行政区', key: 'district'}, {title: '走廊', key: 'corridor'},
          {title: '道路等级', key: 'road_class'},
          {title: '控制模式', render: r => UI.tag(r.ctrl_mode, r.ctrl_mode === 'FIXED_TIME' ? 'blue' : 'grey')},
          {title: '质量', render: r => stateTag(r.quality)},
          {title: '发布', render: r => r.published ? UI.status('已发布', 'green') : UI.status('未发布', 'grey')}],
        rows, size: 10, page: STATE.p || 1, onPage: 'goPage'})});
}},

{persona: 'ops', group: '运行监控', id: 'suspend', title: '暂停指令', icon: '⏸', modules: ['OP-3'], render: async () => {
  const su = (await api('/api/suspensions')).body, act = su.filter(s => s.state === 'ACTIVE');
  const kinds = {SPECIAL_DUTY: '特勤', SECURITY: '安全事件', GRANT_SHRINK: '授权收缩', MAINTENANCE: '计划维护'};
  return UI.pageHead({title: '暂停指令', desc: '特勤、安全事件与授权收缩导致的暂停。对车企一律只显示原因码“维护”，指令内容不外露（F-14）。',
      ops: [UI.btn('下达暂停', 'suspendForm()', {type: 'danger'})]})
    + UI.stats([{title: '生效中', value: act.length, sub: act.length ? '相关路口已停止交付' : '全网正常交付'},
        {title: '历史指令', value: su.length},
        {title: '特勤类', value: su.filter(s => s.kind === 'SPECIAL_DUTY').length},
        {title: '对外原因码', value: '维护', sub: '统一口径，不区分类型'}])
    + UI.card({title: '指令列表', flush: true, body: UI.table({
        columns: [{title: '指令号', key: 'id', cls: 'num'},
          {title: '范围', render: s => `${UI.tag({city: '全市', district: '行政区', corridor: '走廊', intersection: '路口'}[s.scope_type] || s.scope_type, 'blue')} <span class="mono">${esc(s.scope_ref)}</span>`},
          {title: '类型', render: s => UI.tag(kinds[s.kind] || s.kind, s.kind === 'SPECIAL_DUTY' ? 'gold' : 'grey')},
          {title: '状态', render: s => s.state === 'ACTIVE' ? UI.status('生效中', 'red') : UI.status('已解除', 'green')},
          {title: '下达 / 解除', cls: 'num', render: s => `${esc((s.issued_at || '').slice(5, 16).replace('T', ' '))}${s.lifted_at ? ' → ' + esc(s.lifted_at.slice(5, 16).replace('T', ' ')) : ''}`},
          {title: '下达人', key: 'issued_by'},
          {title: '备注（内部）', render: s => `<span class="muted">${esc(s.note || '—')}</span>`},
          {title: '操作', render: s => s.state === 'ACTIVE' ? UI.link('解除', `liftSuspend('${s.id}')`) : '—'}],
        rows: su, empty: '暂无暂停指令'})})
    + UI.alert('暂停生效后，规则引擎 OP-3 在订阅预览与发布路由中直接剔除相关路口；解除后按下一灯周期边界恢复。');
}},
{persona: 'ops', group: '运行监控', id: 'tickets', title: '工单与派单', icon: '✉', modules: ['NT-4', 'OP-5'], render: async () => {
  const ts = (await api('/api/tickets')).body;
  const pri = {D1: 'red', D2: 'gold', D3: 'blue'};
  const kinds = {QUALITY: '质量降级', ANOMALY: '回执异常', DEVICE: '设备故障', DATA: '数据不一致'};
  const openN = ts.filter(t => t.state !== 'CLOSED').length;
  return UI.pageHead({title: '工单与派单', desc: '质量降级、回执异常与设备故障的处置闭环。D1 须 30 分钟内下线路口，D3 一个工作日内闭环。',
      ops: [UI.btn('手工建单', 'ticketForm()', {type: 'primary'})]})
    + UI.stats([{title: '未闭环', value: openN, sub: `已闭环 ${ts.length - openN}`},
        {title: 'D1 紧急', value: ts.filter(t => t.priority === 'D1').length, sub: 'SLA 0.5 小时'},
        {title: '自动建单', value: ts.filter(t => t.created_by === 'system').length, sub: '由回执异常触发'},
        {title: '工单总量', value: ts.length}])
    + UI.card({title: '工单列表', flush: true, body: UI.table({
        columns: [{title: '工单号', key: 'id', cls: 'num'},
          {title: '标题', render: t => `${esc(t.title)}${t.intersection_id ? ` <span class="mono muted">${esc(t.intersection_id)}</span>` : ''}`},
          {title: '类型', render: t => UI.tag(kinds[t.kind] || t.kind, 'grey')},
          {title: '优先级', render: t => UI.tag(t.priority, pri[t.priority] || 'grey')},
          {title: 'SLA', cls: 'num', render: t => `${t.sla_hours} h`},
          {title: '处置方', key: 'target'},
          {title: '状态', render: t => stateTag(t.state)},
          {title: '创建', cls: 'num', render: t => esc((t.created_at || '').slice(5, 16).replace('T', ' '))},
          {title: '操作', render: t => t.state === 'OPEN' ? UI.link('派单', `dispatchTicket('${t.id}')`)
            : (t.state === 'DISPATCHED' ? UI.link('闭环', `closeTicket('${t.id}')`) : '—')}],
        rows: ts, empty: '暂无工单', page: STATE.p || 1, size: 10, onPage: 'goPage'})})
    + UI.alert('回执异常（疑似 D1、验签失败、撤销后仍显示）由系统自动建单并按 D1/D2 定级，不依赖人工发现。');
}},
{persona: 'ops', group: '运行监控', id: 'duty', title: '值班与应急', icon: '⚑', modules: ['OP-6'], render: async () => {
  const d = (await api('/api/incidents')).body, inc = d.incidents;
  const LC = {P1: 'red', P2: 'gold', P3: 'blue'};
  const open = inc.filter(i => i.state !== 'CLOSED');
  return UI.pageHead({title: '值班与应急', desc: '事件单、处置动作台与通报时限。处置动作直接落到平台真实状态，不是演练按钮。',
      ops: [UI.btn('新建事件单', 'incidentForm()', {type: 'danger'})]})
    + UI.stats([{title: '未闭环事件', value: open.length},
        {title: '超通报时限', value: inc.filter(i => i.notify_late).length, sub: 'P1 一小时内须通报'},
        {title: '已闭环', value: inc.length - open.length, sub: '均附复盘'},
        {title: '今日值班', value: (d.roster[0] || {}).owner || '—', sub: (d.roster[0] || {}).shift || ''}])
    + UI.card({title: '值班表与升级联系人', flush: true, body: UI.table({
        columns: [{title: '日期', key: 'day', cls: 'num'}, {title: '班次', key: 'shift'},
          {title: '值班人', key: 'owner'}, {title: '升级联系人', key: 'escalate'},
          {title: '联系电话', render: r => `<span class="mono">${esc(r.phone)}</span>`}],
        rows: d.roster})})
    + UI.card({title: '事件单', flush: true, body: UI.table({
        columns: [{title: '事件号', key: 'id', cls: 'num'},
          {title: '级别', render: i => UI.tag(i.level, LC[i.level] || 'grey')},
          {title: '标题', render: i => `${esc(i.title)}<br><span class="muted">${esc(i.summary || '')}</span>`},
          {title: '状态', render: i => stateTag(i.state)},
          {title: '通报时限', render: i => i.state === 'CLOSED' || i.state === 'NOTIFIED'
            ? UI.status('已通报', 'green')
            : (i.notify_late ? UI.status('已超时', 'red') : UI.status(esc(i.notify_due.slice(11, 16)) + ' 前', 'gold'))},
          {title: '已执行处置', cls: 'num', render: i => i.actions.length},
          {title: '操作', render: i => i.state === 'CLOSED' ? UI.link('复盘', `incidentDrawer('${i.id}')`)
            : UI.link('处置台', `incidentDrawer('${i.id}')`)}],
        rows: inc, empty: '暂无事件单'})})
    + UI.alert('闭环前必须填写复盘（根因、影响面、改进项与责任人），否则不允许关闭事件单。');
}},

{persona: 'ops', group: '证据与合规', id: 'audit', title: '审计日志', icon: '⎘', modules: ['AU-1', 'AU-2'], render: async () => {
  const a = (await api('/api/audit')).body;
  const kw = (STATE.kw || '').trim();
  const rows = a.entries.filter(e => !kw || e.action.includes(kw) || e.actor.includes(kw) || e.obj.includes(kw));
  return UI.pageHead({title: '审计日志', desc: '每条记录链接上一条的哈希，任意一条被改动，链校验即失败（AU-1.2）。',
      ops: [a.verified ? UI.tag('链校验通过', 'green') : UI.tag('链校验失败', 'red')]})
    + UI.card({flush: true, body: UI.table({
        filters: [`<label>搜索</label><input type="search" placeholder="动作 / 操作人 / 对象" value="${esc(kw)}"
                   oninput="STATE.kw=this.value" onkeydown="if(event.key==='Enter')reload()">`,
                  UI.btn('查询', 'reload()', {type: 'primary', size: 'sm'}),
                  UI.btn('重置', "STATE.kw='';reload()", {size: 'sm'})],
        columns: [{title: '序号', key: 'seq', cls: 'num'},
          {title: '时间', cls: 'num', render: e => esc(e.ts.slice(0, 19).replace('T', ' '))},
          {title: '操作人', key: 'actor'},
          {title: '动作', render: e => UI.tag(e.action, e.action.includes('DENIED') ? 'red' :
              (e.action.includes('ROLLBACK') ? 'gold' : 'blue'))},
          {title: '对象', key: 'obj', cls: 'num'},
          {title: '详情', render: e => `<span class="mono muted">${esc(e.detail.slice(0, 80))}</span>`}],
        rows, size: 12, page: STATE.p || 1, onPage: 'goPage'})});
}},
{persona: 'ops', group: '证据与合规', id: 'retention', title: '留存与销毁', icon: '⌫', modules: ['AU-4'], render: async () => {
  const r = (await api('/api/retention')).body, ps = r.policies, cs = r.certificates;
  return UI.pageHead({title: '留存与销毁', desc: '按类别设定留存期，到期清理并出具销毁证明。审计日志留存不得少于 180 天。'})
    + UI.stats([{title: '策略类别', value: ps.length},
        {title: '在库记录', value: ps.reduce((a, p) => a + p.rows_total, 0)},
        {title: '已超期待清理', value: ps.reduce((a, p) => a + p.rows_expired, 0)},
        {title: '销毁证明', value: cs.length}])
    + UI.card({title: '留存策略', flush: true, body: UI.table({
        columns: [{title: '类别', render: p => `<span class="mono">${esc(p.category)}</span>`},
          {title: '留存天数', cls: 'num', render: p => `${p.days} 天`},
          {title: '法定 / 业务依据', render: p => `<span class="muted">${esc(p.basis)}</span>`},
          {title: '在库', cls: 'num', key: 'rows_total'},
          {title: '已超期', cls: 'num', render: p => p.rows_expired ? UI.tag(String(p.rows_expired), 'gold') : '0'},
          {title: '操作', render: p => UI.link('调整留存期', `retentionForm('${p.category}',${p.days})`)
            + UI.link('执行清理', `confirmPurge('${p.category}',${p.rows_expired})`, true)}],
        rows: ps})})
    + UI.card({title: '销毁证明', flush: true, body: UI.table({
        columns: [{title: '证明编号', key: 'cert_no', cls: 'num'},
          {title: '类别', render: c => `<span class="mono">${esc(c.category)}</span>`},
          {title: '销毁条数', cls: 'num', key: 'rows_removed'},
          {title: '执行人', key: 'operator'},
          {title: '时间', cls: 'num', render: c => esc((c.ts || '').slice(0, 19).replace('T', ' '))}],
        rows: cs, empty: '尚未执行过清理'})})
    + UI.alert('销毁证明与审计哈希链同源，可作为终止订阅后“数据已删除”的对外证据（AU-4.3）。');
}},
{persona: 'ops', group: '证据与合规', id: 'metering', title: '计量与结算', icon: '¥', modules: ['EV-2', 'EV-3', 'EV-4', 'EV-5'], render: async () => {
  const st = (await api('/api/receipts')).body, svc = (await api('/api/services')).body;
  const rows = Object.entries(st.by_status).map(([k, v]) => ({status: k, cnt: v}));
  return UI.pageHead({title: '计量与结算', desc: '计量口径以回执为准：合格数、校验通过数、显示数三者交叉校验，差异超 1% 触发对账工单。'})
    + UI.stats([{title: '合格数', value: st.qualified, sub: '平台判定可下发'},
        {title: '有效送达率', value: st.delivery_rate + '%', sub: '校验通过 / 合格'},
        {title: '显示率', value: st.display_rate + '%', sub: '实际显示 / 校验通过'},
        {title: '无法核验率', value: st.unverifiable_rate + '%', sub: '不计为成功'}])
    + UI.card({title: '回执状态分布', flush: true, body: UI.table({
        columns: [{title: '状态', render: r => stateTag(r.status)},
          {title: '口径说明', render: r => `<span class="muted">${esc({VALIDATED: '车端校验通过但未显示（如被更高优先级抑制）',
            PRESENTED: '实际向驾驶员显示', SUPPRESSED: '车端主动抑制，计入合格但不计显示',
            UNVERIFIABLE: '缺少最终状态，一律不计为成功'}[r.status] || '—')}</span>`},
          {title: '条数', cls: 'num', key: 'cnt'}],
        rows, empty: '尚无回执数据，可在车企视角“回执与计量”页模拟上报'})})
    + UI.card({title: '计费单元（待商务决策）', flush: true, body: UI.table({
        columns: [{title: '服务编码', key: 'code', cls: 'num'}, {title: '名称', key: 'name'},
          {title: '服务等级', render: s => UI.tag(s.level, 'blue')},
          {title: '计量单位', render: s => s.unit === '—' ? '<span class="muted">不单独计量</span>' : esc(s.unit)},
          {title: '版本', render: s => UI.tag(s.phase, 'blue')}],
        rows: svc})})
    + UI.alert('是否计费、单价与结算主体取决于公共数据授权运营路径的确定（DEC-08），当前一律按“待商务决策”登记，不影响服务开通。');
}},

{persona: 'ops', group: '平台管理', id: 'services', title: '服务与 ICD 版本', icon: '⚙', modules: ['AD-1', 'AD-2', 'AD-3', 'AD-4'], render: async () => {
  const d = (await api('/api/icds')).body, ic = d.icds, vs = d.versions;
  const C = {DRAFT: 'grey', REVIEW: 'gold', FROZEN: 'green', DEPRECATED: 'red'};
  const N = {DRAFT: '草稿', REVIEW: '评审中', FROZEN: '已冻结', DEPRECATED: '已废弃'};
  return UI.pageHead({title: '服务与 ICD 版本', desc: '接口控制文件的状态决定订阅能走到哪个环境：R-16 要求预生产与生产所用服务版本绑定的 ICD 必须已冻结。',
      ops: [UI.btn('上传新版本', 'icdForm()', {type: 'primary'})]})
    + UI.stats([{title: 'ICD 版本', value: ic.length},
        {title: '已冻结', value: ic.filter(i => i.state === 'FROZEN').length, sub: '可用于预生产与生产'},
        {title: '评审中', value: ic.filter(i => i.state === 'REVIEW').length, sub: '仅沙箱可用并标注'},
        {title: '车企确认', value: ic.reduce((a, i) => a + i.acks.length, 0)}])
    + UI.card({title: 'ICD 版本', flush: true, body: UI.table({
        columns: [{title: '编号', render: i => `<span class="mono">${esc(i.id)}</span>`},
          {title: '标题', key: 'title'},
          {title: '定义形式', render: i => `${esc(i.spec_kind)} <span class="mono muted">${esc(i.spec_ref)}</span>`},
          {title: '状态', render: i => UI.tag(N[i.state] || i.state, C[i.state] || 'grey')},
          {title: '绑定服务', cls: 'num', render: i => i.services.length},
          {title: '车企确认', render: i => i.acks.length ? UI.tag(`${i.acks.length} 家`, 'green') : UI.tag('未确认', 'grey')},
          {title: '冻结时间', cls: 'num', render: i => esc((i.frozen_at || '—').slice(0, 10))},
          {title: '操作', render: i => UI.link('详情', `icdDrawer('${i.id}')`)
            + (i.state === 'DRAFT' ? UI.link('提交评审', `icdState('${i.id}','REVIEW')`) : '')
            + (i.state === 'REVIEW' ? UI.link('冻结', `freezeForm('${i.id}')`) : '')
            + (i.state === 'FROZEN' ? UI.link('废弃', `icdState('${i.id}','DEPRECATED')`, true) : '')}],
        rows: ic})})
    + UI.card({title: '服务版本绑定', flush: true, body: UI.table({
        columns: [{title: '服务编码', render: v => `<span class="mono">${esc(v.service_code)}</span>`},
          {title: '服务版本', cls: 'num', key: 'version'},
          {title: '绑定 ICD', render: v => `<span class="mono">${esc(v.icd_id)}</span>`},
          {title: 'ICD 状态', render: v => UI.tag(N[v.icd_state] || v.icd_state, C[v.icd_state] || 'grey')},
          {title: '版本状态', render: v => UI.tag({PREVIEW: '预览', RELEASED: '已发布', DEPRECATED: '已废弃'}[v.state] || v.state,
            v.state === 'RELEASED' ? 'green' : 'grey')},
          {title: '发布时间', cls: 'num', render: v => esc((v.released_at || '—').slice(0, 10))}],
        rows: vs, page: STATE.p || 1, size: 10, onPage: 'goPage'})})
    + UI.alert('冻结后不可修改内容，只能废弃并新开版本号；未冻结的 ICD 不能绑定到已发布的服务版本。');
}},
{persona: 'ops', group: '平台管理', id: 'modeb', title: '模式 B 接入管理', icon: '⇄', modules: ['MB-1', 'MB-2', 'MB-3', 'MB-4', 'MB-5']},
{persona: 'ops', group: '平台管理', id: 'funcmap', title: '功能地图', icon: '▦', modules: [], render: async () => {
  const c = (await api('/api/catalog')).body, s = c.stats;
  return UI.pageHead({title: '功能地图', desc: '17 个子系统、69 个模块、284 个功能点的实现进度，由代码中的实现登记表自动统计。'})
    + UI.stats([{title: '子系统', value: s.subsystems}, {title: '功能模块', value: s.modules},
        {title: '功能点', value: s.points}, {title: '已实现', value: s.done, sub: `部分实现 ${s.partial}`},
        {title: 'P0 功能点', value: s.p0_points}])
    + UI.card({flush: true, body: UI.table({
        columns: [{title: '子系统', render: r => `<b>${r.id}</b> ${esc(r.name)}`},
          {title: '职责', render: r => `<span class="muted">${esc(r.duty)}</span>`},
          {title: '部署', key: 'deploy'}, {title: '版本', render: r => UI.tag(r.phase, 'blue')},
          {title: '模块', cls: 'num', render: r => r.modules.length},
          {title: '功能点', cls: 'num', render: r => `${r.done + r.partial} / ${r.total}`},
          {title: '进度', render: r => {
            const d = Math.round(100 * r.done / (r.total || 1)), p = Math.round(100 * r.partial / (r.total || 1));
            return `<span style="display:inline-block;width:110px;height:8px;background:var(--split);border-radius:4px;position:relative">
              <i style="position:absolute;height:8px;width:${d}%;background:var(--success);border-radius:4px"></i>
              <i style="position:absolute;left:${d}%;height:8px;width:${p}%;background:var(--warning)"></i></span>`}},
          {title: '操作', render: r => UI.link('查看模块', `subsysDrawer('${r.id}')`)}],
        rows: c.tree})});
}},

// ---------- 车企门户 ----------
{persona: 'oem', group: '概览', id: 'home', title: '首页与待办', icon: '⌂', modules: ['NT-1'], render: async () => {
  const cl = (await api('/api/tenants/OEM01/gate-checklist')).body, rows = await subRows();
  const todo = cl.items.filter(i => !i.ok);
  return UI.pageHead({title: '首页', desc: '当前租户：示例车企 A（OEM01）'})
    + (todo.length ? UI.alert(`<b>上线还差 ${todo.length} 项：</b>` + todo.map(i => `${esc(i.item)}（${esc(i.owner)}）`).join('　·　'), 'warn')
                   : UI.alert('门禁全部通过，可申请迁移到生产环境。'))
    + UI.stats([{title: '我的订阅', value: rows.length},
        {title: '可交付路口', value: rows.reduce((a, r) => a + r.deliverable, 0)},
        {title: '生产环境订阅', value: rows.filter(r => r.env === 'prod').length},
        {title: '待处理事项', value: todo.length}])
    + UI.card({title: '上线检查项', flush: true, body: UI.table({
        columns: [{title: '检查项', key: 'item'},
          {title: '状态', render: r => r.ok ? UI.status('通过', 'green') : UI.status('未满足', 'red')},
          {title: '责任方', key: 'owner'}, {title: '当前值', key: 'detail', cls: 'num'}],
        rows: cl.items})})
    + UI.card({title: '我的订阅', flush: true, body: UI.table({columns: subColumns(true), rows, empty: '暂无订阅'})});
}},
{persona: 'oem', group: '概览', id: 'gate-status', title: '门禁清单', icon: '⊘', modules: ['GR-2'], render: async () =>
  UI.pageHead({title: '门禁清单', desc: '平台向车企提供数据前需满足的条件，以及各项的责任方。'}) + await gateBlock()},
{persona: 'oem', group: '发现', id: 'catalog', title: '服务目录', icon: '☷', modules: ['CT-1', 'CT-3'], render: async () => {
  const svc = (await api('/api/services')).body;
  return UI.pageHead({title: '服务目录', desc: '可订阅的交付单元。每项服务标注服务等级、最低质量要求、通道与车端最低能力。'})
    + UI.stats([{title: '可订阅服务', value: svc.length},
        {title: 'P0 首批', value: svc.filter(s => s.phase === 'P0').length, sub: '随平台首发'},
        {title: '需 PC5 或 Uu-B', value: svc.filter(s => /PC5|Uu-B/.test(s.channel)).length},
        {title: '免费基础服务', value: svc.filter(s => s.level === 'S0' || s.level === '—').length, sub: 'S0 与随附服务'}])
    + UI.card({title: '服务清单', flush: true, body: UI.table({
        columns: [{title: '服务编码', render: s => `<span class="mono">${esc(s.code)}</span>`},
          {title: '名称', key: 'name'},
          {title: '服务等级', render: s => s.level === '—' ? '<span class="muted">随附</span>' : UI.tag(s.level, s.level === 'S2' ? 'gold' : 'blue')},
          {title: '最低质量', render: s => s.quality_min === 'X' ? '<span class="muted">不适用</span>' : stateTag(s.quality_min)},
          {title: '通道', key: 'channel'},
          {title: '车端最低能力', render: s => `<span class="muted">${esc(s.min_capability)}</span>`},
          {title: '计量单位', render: s => s.unit === '—' ? '<span class="muted">—</span>' : esc(s.unit)},
          {title: '可订阅版本', render: s => UI.tag(s.phase, 'blue')}],
        rows: svc})})
    + UI.alert('订阅前请先提交车型能力画像：服务等级上限由画像推导，S2 需 PC5 或实测达标的 Uu-B，不可自助开通。');
}},
{persona: 'oem', group: '发现', id: 'coverage', title: '覆盖地图', icon: '⊞', modules: ['CT-2']},
{persona: 'oem', group: '接入', id: 'profile', title: '车型能力画像', icon: '⚇', modules: ['TN-2'], render: async () => {
  const ps = (await api('/api/profiles')).body;
  return UI.pageHead({title: '车型能力画像', desc: '按车型申报能力，平台推导展示档位 V1–V6、匹配上限 M1–M3 与服务等级上限。V1–V6 为本项目内部 Profile，非行业标准。',
      ops: [UI.btn('提交画像', 'profileForm()', {type: 'primary'})]})
    + UI.stats([{title: '已备案车型', value: ps.length},
        {title: '支持 PC5', value: ps.filter(p => p.pc5).length, sub: '可申请 S2'},
        {title: '车道级匹配 M3', value: ps.filter(p => p.match_max === 'M3').length},
        {title: '受限档位 V5/V6', value: ps.filter(p => ['V5', 'V6'].includes(p.display_tier)).length, sub: '小屏或不支持 OTA'}])
    + UI.card({title: '画像列表', flush: true, body: UI.table({
        columns: [{title: '画像编号', render: p => `<span class="mono">${esc(p.id)}</span>`},
          {title: '车型 / 年款', render: p => `${esc(p.model)} · ${esc(p.year)}`},
          {title: 'T-BOX', key: 'tbox'},
          {title: 'PC5', render: p => p.pc5 ? UI.tag('支持', 'green') : UI.tag('不支持', 'grey')},
          {title: '定位', key: 'positioning'},
          {title: '导航 / HUD', render: p => `${esc(p.nav)} / ${esc(p.hud)}`},
          {title: '展示档位', render: p => UI.tag(p.display_tier, ['V5', 'V6'].includes(p.display_tier) ? 'gold' : 'blue')},
          {title: '匹配上限', render: p => UI.tag(p.match_max, 'blue')},
          {title: '等级上限', render: p => UI.tag(p.level_max, p.level_max === 'S2' ? 'gold' : 'blue')},
          {title: '版本', cls: 'num', render: p => 'v' + p.version}],
        rows: ps, empty: '尚未提交车型能力画像'})})
    + UI.alert('画像变更会重新推导服务等级上限；若新画像低于在用订阅的等级，平台将提示降级而非直接中断已生效订阅。');
}},
{persona: 'oem', group: '接入', id: 'credentials', title: '凭证与环境', icon: '⚿', modules: ['CR-1', 'CR-2'], render: async () => {
  const d = (await api('/api/certs')).body, envs = (await api('/api/envs/OEM01')).body;
  const cs = d.certs.filter(c => c.tenant_id === 'OEM01'), ips = d.ips.filter(i => i.tenant_id === 'OEM01');
  const CC = {ISSUED: 'green', ROTATING: 'gold', EXPIRED: 'grey', REVOKED: 'red'};
  const CN = {ISSUED: '生效中', ROTATING: '轮换并行', EXPIRED: '已过期', REVOKED: '已吊销'};
  const EN = {sandbox: '沙箱', preprod: '预生产', prod: '生产'};
  return UI.pageHead({title: '凭证与环境', desc: '证书分环境签发。进入生产须持有有效生产证书并完成出口 IP 白名单审批（R-09）。',
      ops: [UI.btn('提交 CSR 签发', 'certForm()', {type: 'primary'}), UI.btn('申请出口 IP', 'ipForm()')]})
    + UI.stats([{title: '生效中证书', value: cs.filter(c => c.state === 'ISSUED').length},
        {title: '30 天内到期', value: cs.filter(c => c.warn).length, sub: '到期前 30 / 7 天提醒'},
        {title: '出口 IP', value: ips.filter(i => i.state === 'ACTIVE').length, sub: `待审批 ${ips.filter(i => i.state === 'PENDING').length}`},
        {title: '已就绪环境', value: envs.filter(e => e.ready).length, sub: `共 ${envs.length} 个环境`}])
    + UI.card({title: '环境开通状态', flush: true, body: UI.table({
        columns: [{title: '环境', render: e => UI.tag(EN[e.env] || e.env, e.env === 'prod' ? 'green' : 'blue')},
          {title: '开通', render: e => e.opened ? UI.status('已开通', 'green') : UI.status('未开通', 'grey')},
          {title: '证书', render: e => e.cert ? `<span class="mono">${esc(e.cert)}</span>（剩余 ${e.cert_days_left} 天）`
            : '<span class="muted">无有效证书</span>'},
          {title: '出口 IP', cls: 'num', render: e => e.ip_active},
          {title: '连接配额', cls: 'num', render: e => `${e.conn_used} / ${e.conn_max}`},
          {title: '消息配额', cls: 'num', render: e => (e.msg_quota / 10000).toFixed(0) + ' 万/日'},
          {title: '就绪', render: e => e.ready ? UI.status('可承接订阅', 'green') : UI.status('未就绪', 'gold')},
          {title: '操作', render: e => e.opened ? '—' : UI.link('申请开通', `openEnv('${e.env}')`)}],
        rows: envs})})
    + UI.card({title: '证书', flush: true, body: UI.table({
        columns: [{title: '证书编号', render: c => `<span class="mono">${esc(c.id)}</span>`},
          {title: '环境', render: c => UI.tag(EN[c.env] || c.env, 'blue')},
          {title: 'CN', render: c => `<span class="mono">${esc(c.cn)}</span>`},
          {title: '指纹', render: c => `<span class="mono muted">${esc(c.fingerprint.slice(0, 16))}…</span>`},
          {title: '状态', render: c => UI.tag(CN[c.state] || c.state, CC[c.state] || 'grey')},
          {title: '到期', cls: 'num', render: c => `${esc(c.not_after)}${c.warn ? ' ' + UI.tag(`剩 ${c.days_left} 天`, 'gold') : ''}`},
          {title: '操作', render: c => ['ISSUED', 'ROTATING'].includes(c.state)
            ? UI.link('轮换', `certForm('${c.id}','${c.env}')`) + UI.link('吊销', `confirmRevoke('${c.id}')`, true) : '—'}],
        rows: cs, empty: '尚未签发证书'})})
    + UI.card({title: '出口 IP 白名单', flush: true, body: UI.table({
        columns: [{title: '申请号', key: 'id', cls: 'num'},
          {title: '环境', render: i => UI.tag(EN[i.env] || i.env, 'blue')},
          {title: 'IP / CIDR', render: i => `<span class="mono">${esc(i.cidr)}</span>`},
          {title: '用途', key: 'purpose'},
          {title: '状态', render: i => i.state === 'ACTIVE' ? UI.status('已生效', 'green')
            : (i.state === 'PENDING' ? UI.status('待运营审批', 'gold') : UI.status('已移除', 'grey'))},
          {title: '申请 / 审批', render: i => `${esc(i.applied_by)} / ${esc(i.approved_by || '—')}`}],
        rows: ips, empty: '尚未申请出口 IP'})})
    + UI.alert('网络准入变更须双人复核，申请人不得自审；证书轮换有并行期，新旧证书在并行期内都可用，避免换证断连。');
}},
{persona: 'oem', group: '订阅', id: 'subscriptions', title: '我的订阅', icon: '≣', modules: ['SB-1', 'SB-5'], render: async () => {
  const rows = await subRows();
  return UI.pageHead({title: '我的订阅', desc: '订阅范围、可交付路口与规则校验结果。'})
    + UI.card({flush: true, body: UI.table({columns: subColumns(true), rows, empty: '暂无订阅'})});
}},
{persona: 'oem', group: '订阅', id: 'editor', title: '订阅编辑器', icon: '✎', modules: ['SB-2', 'CF-4']},
{persona: 'oem', group: '订阅', id: 'scene-sub', title: '场景订阅与预警配置', icon: '◈', modules: ['SC-5'], render: async () => {
  const subs = (await api('/api/subscriptions')).body.filter(s => s.tenant_id === 'OEM01');
  if (!subs.length) return UI.pageHead({title: '场景订阅与预警配置'}) + UI.card({body: UI.empty('暂无订阅', '请先在“我的订阅”中创建订阅')});
  const sid = STATE.sid || subs[0].id;
  const sc = (await api(`/api/subscriptions/${sid}/scenes`)).body;
  const onN = sc.filter(c => c.enabled && c.deliverable).length;
  return UI.pageHead({title: '场景订阅与预警配置',
      desc: `订阅 ${sid}：可在平台已启用的范围内逐场景收紧，不能开启平台未启用或资格不可达的场景（R-17）。`,
      ops: subs.map(s => UI.btn(s.id, `pickSub('${s.id}')`, {size: 'sm', type: s.id === sid ? 'primary' : ''}))})
    + UI.stats([{title: '已开启场景', value: onN, sub: `共 ${sc.length} 个场景`},
        {title: '范围内可交付路口', value: Math.max(...sc.map(c => c.deliverable), 0), sub: `请求 ${sc[0] ? sc[0].requested : 0} 个`},
        {title: '平台计算场景', value: sc.filter(c => c.compute === '平台').length, sub: '其余由车端本地计算'},
        {title: '不可开启', value: sc.filter(c => !c.deliverable).length, sub: '平台未启用或资格不可达'}])
    + UI.card({title: '场景开关与过滤', flush: true, body: UI.table({
        columns: [{title: '场景', render: c => `<b>${esc(c.scene)}</b> ${esc(c.name)}`},
          {title: '等级', render: c => UI.tag(c.level, 'blue')},
          {title: '计算侧', render: c => UI.tag(c.compute, c.compute === '平台' ? 'gold' : 'grey')},
          {title: '质量门槛', render: c => stateTag(c.quality_req)},
          {title: '可交付 / 请求', cls: 'num', render: c => `${c.deliverable} / ${c.requested}`},
          {title: '最低等级过滤', render: c => c.min_level ? UI.tag(c.min_level, 'blue') : '<span class="muted">不过滤</span>'},
          {title: '提示距离', cls: 'num', render: c => c.ahead_m ? c.ahead_m + ' m' : '—'},
          {title: '状态', render: c => !c.deliverable ? UI.status('不可开启', 'grey')
            : (c.enabled ? UI.status('已开启', 'green') : UI.status('已关闭', 'grey'))},
          {title: '操作', render: c => c.deliverable
            ? UI.link(c.enabled ? '关闭' : '开启', `toggleSubScene('${sid}','${c.scene}',${c.enabled ? 0 : 1})`, c.enabled)
            : '—'}],
        rows: sc})})
    + UI.alert('车端算法阈值与 HMI 表现由车企自行配置，平台不下发车端参数；此处只决定“是否向本订阅交付该场景，以及交付时的收紧条件”。');
}},
{persona: 'oem', group: '联调', id: 'sandbox', title: '联调工具', icon: '⚒', modules: ['DT-1', 'DT-2', 'DT-3', 'DT-4'], render: async () => {
  const d = (await api('/api/sandbox?tenant=OEM01')).body, rep = d.report;
  const subs = (await api('/api/subscriptions')).body.filter(s => s.tenant_id === 'OEM01');
  const live = subs.filter(s => ['ACTIVE', 'PREPROD', 'SANDBOX'].includes(s.state));
  const sid = STATE.sid || (live[0] || subs[0] || {}).id;
  const diag = sid ? (await api(`/api/subscriptions/${sid}/diagnose?scene=${STATE.scene || 'SPAT'}`)).body : null;
  const RC = {PASS: 'green', FAIL: 'red', NA: 'grey', 未执行: 'grey'};
  return UI.pageHead({title: '联调工具', desc: '故障注入落到平台真实状态，沙箱观察到的降级行为与生产一致；准出报告据此生成。',
      ops: [UI.btn('注入故障', 'faultForm()', {type: 'primary'}), UI.btn('登记用例结果', 'runForm()')]})
    + (diag ? UI.card({
        title: `订阅调试器 · 为什么没收到（${sid}）`,
        ops: [diag.blocking_rule ? UI.tag(diag.verdict, 'red') : UI.tag(diag.verdict, 'green'),
              ...subs.map(s2 => UI.btn(s2.id.slice(0, 11), `pickSub('${s2.id}')`,
                {size: 'sm', type: s2.id === sid ? 'primary' : ''})),
              UI.btn('SPAT', "setScene('SPAT')", {size: 'sm', type: (STATE.scene || 'SPAT') === 'SPAT' ? 'primary' : ''}),
              UI.btn('绿波', "setScene('GLOSA')", {size: 'sm', type: STATE.scene === 'GLOSA' ? 'primary' : ''}),
              UI.btn('起步提醒', "setScene('GREEN_START')", {size: 'sm', type: STATE.scene === 'GREEN_START' ? 'primary' : ''})],
        flush: true,
        body: UI.table({
          columns: [{title: '判定项', render: c => `<b>${esc(c.check)}</b>`},
            {title: '结果', render: c => c.ok ? UI.status('通过', 'green') : UI.status('未通过', 'red')},
            {title: '依据', render: c => esc(c.detail)},
            {title: '规则', render: c => c.rule ? UI.tag(c.rule, 'red') : '—'},
            {title: '下一步', render: c => `<span class="muted">${esc(c.action || '—')}</span>`}],
          rows: diag.checks})}) + UI.alert(`诊断路口 <span class="mono">${esc(diag.intersection_id || '—')}</span>，追踪号 <span class="mono">${esc(diag.trace_id || '—')}</span>。五项判定按顺序短路，先解决最上面一条。`)
      : UI.card({body: UI.empty('暂无订阅，无法诊断')}))
    + UI.card({title: '故障注入', flush: true, body: UI.table({
        columns: [{title: '注入号', key: 'id', cls: 'num'},
          {title: '类型', render: r => UI.tag((d.faults[r.kind] || [r.kind])[0], 'gold')},
          {title: '对象', render: r => `<span class="mono">${esc(r.target)}</span>`},
          {title: '观察到', render: r => `<span class="muted">${esc(r.observed || '')}</span>`},
          {title: '状态', render: r => r.state === 'RUNNING' ? UI.status('进行中', 'gold') : UI.status('已结束', 'green')},
          {title: '操作', render: r => r.state === 'RUNNING' ? UI.link('结束并恢复现场', `finishFault('${r.id}')`) : '—'}],
        rows: d.runs, empty: '尚未注入故障'})})
    + UI.card({title: '联调用例与准出', ops: [rep.passed ? UI.tag('可准出', 'green') : UI.tag('尚不可准出', 'red')], flush: true,
        body: UI.table({
          columns: [{title: '用例', render: c => `<span class="mono">${esc(c.id)}</span> ${esc(c.name)}`},
            {title: '阶段', render: c => UI.tag(c.phase === 'sandbox' ? '沙箱' : '预生产', 'blue')},
            {title: '期望结果', render: c => `<span class="muted">${esc(c.expect)}</span>`},
            {title: '必过', render: c => c.mandatory ? UI.tag('必过', 'red') : UI.tag('可选', 'grey')},
            {title: '结果', render: c => UI.tag(c.result, RC[c.result] || 'grey')
              + (c.defect_level ? ' ' + UI.tag(c.defect_level, 'red') : '')},
            {title: 'ICD', render: c => c.icd_id ? `<span class="mono">${esc(c.icd_id)}</span>` : '—'}],
          rows: rep.items})})
    + UI.alert(esc(rep.note) + (rep.blocking_cases.length ? `　当前阻塞用例：${rep.blocking_cases.join('、')}` : ''));
}},
{persona: 'oem', group: '联调', id: 'mapping', title: '映射与路口包', icon: '⊕', modules: ['AD-4']},
{persona: 'oem', group: '运营', id: 'sla', title: '质量与 SLA', icon: '◷', modules: ['OP-1'], render: async () => {
  const rows = await subRows(), mine = rows.filter(r => r.tenant_id === 'OEM01');
  const st = (await api('/api/receipts')).body;
  const ints = (await api('/api/intersections')).body;
  const inScope = new Set(mine.flatMap(r => r.findings ? [] : []));
  const byq = ints.reduce((a, i) => (a[i.quality] = (a[i.quality] || 0) + 1, a), {});
  return UI.pageHead({title: '质量与 SLA', desc: '按合格数口径统计：平台判定可下发的消息为分母，车端回执为分子。质量等级实时影响场景资格。'})
    + UI.stats([{title: '有效送达率', value: st.delivery_rate + '%', sub: '目标 ≥ 99%'},
        {title: '显示率', value: st.display_rate + '%', sub: '车端实际显示'},
        {title: '无法核验率', value: st.unverifiable_rate + '%', sub: '目标 ≤ 1%'},
        {title: '可交付路口', value: mine.reduce((a, r) => a + r.deliverable, 0), sub: `请求 ${mine.reduce((a, r) => a + r.requested, 0)}`}])
    + UI.card({title: '我的订阅质量', flush: true, body: UI.table({
        columns: [{title: '订阅', key: 'id', cls: 'num'}, {title: '服务', key: 'service_code'},
          {title: '状态', render: r => stateTag(r.state)},
          {title: '可交付 / 请求', cls: 'num', render: r => `${r.deliverable} / ${r.requested}`},
          {title: '质量分布', render: r => Object.entries(r.quality).map(([q, n]) => UI.tag(`${q} 级 ${n}`, q === 'A' ? 'green' : (q === 'B' ? 'blue' : 'gold'))).join(' ') || '—'},
          {title: '当前拦截', render: r => r.blockers.length ? r.blockers.map(b => UI.tag(b, 'red')).join(' ') : UI.tag('无', 'green')},
          {title: '操作', render: r => UI.link('诊断为什么没收到', `gotoDiag('${r.id}')`)}],
        rows: mine, empty: '暂无订阅'})})
    + UI.card({title: '全市路口质量分布', flush: true, body: UI.table({
        columns: [{title: '质量等级', render: r => stateTag(r[0])},
          {title: '含义', render: r => `<span class="muted">${esc({A: '可用于绿波、闯红灯风险提醒等 A 级门槛场景',
            B: '可用于绿灯即将结束等 B 级门槛场景', C: '仅可用于灯态、读秒与拥堵等 C 级门槛场景',
            X: '不可用于任何对外场景'}[r[0]] || '')}</span>`},
          {title: '路口数', cls: 'num', render: r => r[1]}],
        rows: Object.entries(byq).sort()})})
    + UI.alert('质量等级由平台按实时指标判定，场景资格随之自动生效或撤销，不需要提交变更单（R-05）。');
}},
{persona: 'oem', group: '运营', id: 'receipts', title: '回执与计量', icon: '⇤', modules: ['EV-1', 'EV-2'], render: async () => {
  const st = (await api('/api/receipts')).body;
  return UI.pageHead({title: '回执与计量', desc: '按小时聚合上报，默认抽样 1%，异常即时回传。回执不得包含 VIN、车牌、账号与位置轨迹，含禁止字段的批次整批拒收。',
      ops: [UI.btn('模拟上报一批回执', 'mockReceipts()', {type: 'primary'}),
            UI.btn('模拟异常回传', 'mockAnomaly()')]})
    + UI.stats([{title: '合格数', value: st.qualified},
        {title: '有效送达率', value: st.delivery_rate + '%'},
        {title: '显示率', value: st.display_rate + '%'},
        {title: '无法核验率', value: st.unverifiable_rate + '%', sub: '不计为成功'}])
    + UI.card({title: '状态分布', flush: true, body: UI.table({
        columns: [{title: '状态', render: r => stateTag(r[0])}, {title: '条数', cls: 'num', render: r => r[1]}],
        rows: Object.entries(st.by_status), empty: '尚无回执'})})
    + UI.card({title: '异常回传', flush: true, body: UI.table({
        columns: [{title: '时间', cls: 'num', render: a => esc((a.ts || '').slice(0, 19).replace('T', ' '))},
          {title: '订阅', key: 'sub_id', cls: 'num'},
          {title: '类型', render: a => UI.tag(a.kind, a.kind === 'SUSPECT_D1' ? 'red' : 'gold')},
          {title: '说明', render: a => `<span class="muted">${esc(a.detail)}</span>`}],
        rows: st.anomalies, empty: '暂无异常回传'})})
    + UI.alert('异常回传会在平台侧自动建工单：疑似 D1 按 D1 定级（30 分钟内下线相关路口），其余按 D2 处置。');
}},
{persona: 'oem', group: '运营', id: 'tickets', title: '工单与反馈', icon: '✉', modules: ['NT-2'], render: async () => {
  const ts = (await api('/api/tickets')).body.filter(t => t.kind !== 'DEVICE');
  const pri = {D1: 'red', D2: 'gold', D3: 'blue'};
  return UI.pageHead({title: '工单与反馈', desc: '提交问题单时关联订阅、路口与追踪号，平台按 D1–D3 定级处置。疑似安全类问题走 D1 快速通道。',
      ops: [UI.btn('提交问题单', 'oemTicketForm()', {type: 'primary'}),
            UI.btn('D1 快速通道', "oemTicketForm('D1')", {type: 'danger'})]})
    + UI.stats([{title: '我的工单', value: ts.length},
        {title: '处理中', value: ts.filter(t => t.state !== 'CLOSED').length},
        {title: 'D1 紧急', value: ts.filter(t => t.priority === 'D1').length, sub: '30 分钟内下线相关路口'},
        {title: '已闭环', value: ts.filter(t => t.state === 'CLOSED').length}])
    + UI.card({title: '工单', flush: true, body: UI.table({
        columns: [{title: '工单号', key: 'id', cls: 'num'}, {title: '标题', key: 'title'},
          {title: '关联', render: t => `${t.sub_id ? `<span class="mono">${esc(t.sub_id)}</span> ` : ''}${t.intersection_id ? `<span class="mono muted">${esc(t.intersection_id)}</span>` : ''}` || '—'},
          {title: '优先级', render: t => UI.tag(t.priority, pri[t.priority] || 'grey')},
          {title: '状态', render: t => stateTag(t.state)},
          {title: '处置结论', render: t => `<span class="muted">${esc(t.conclusion || '处理中')}</span>`},
          {title: '提交时间', cls: 'num', render: t => esc((t.created_at || '').slice(5, 16).replace('T', ' '))}],
        rows: ts, empty: '暂无工单'})})
    + UI.alert('D1 定义为可能造成误导或安全影响的问题（如读秒与实际相位不一致），提交后平台按最高优先级处置并可能直接下线相关路口。');
}},
{persona: 'oem', group: '合规', id: 'compliance', title: '协议与数据流向', icon: '⚖', modules: ['GR-3', 'GR-4']},
{persona: 'oem', group: '合规', id: 'modeb', title: '模式 B 开通与监控', icon: '⇄', modules: ['MB-1', 'MB-5']},

// ---------- 交警监管 ----------
{persona: 'gov', group: '监管', id: 'grants', title: '授权执行', icon: '§', modules: ['GV-1'], render: async () => {
  const gr = (await api('/api/grants')).body, rows = await subRows();
  return UI.pageHead({title: '授权执行', desc: '授权范围、被谁订阅、用在哪些路口。交警视图只读。'})
    + UI.stats([{title: '授权文件', value: gr.length},
        {title: '白名单路口', value: gr.reduce((a, g) => a + g.whitelist.length, 0)},
        {title: '订阅方', value: new Set(rows.map(r => r.tenant_id)).size},
        {title: '生产环境订阅', value: rows.filter(r => r.env === 'prod').length}])
    + UI.card({title: '授权文件', flush: true, body: UI.table({
        columns: [{title: '文号', key: 'doc_no'}, {title: '授权方', key: 'grantor'},
          {title: '用途', key: 'purpose'}, {title: '有效期', cls: 'num', render: g => `${g.valid_from} ~ ${g.valid_to}`},
          {title: '版本', cls: 'num', render: g => 'v' + g.version},
          {title: '白名单路口', cls: 'num', render: g => g.whitelist.length}],
        rows: gr, empty: '暂无授权'})})
    + UI.card({title: '订阅使用情况', flush: true, body: UI.table({
        columns: [{title: '租户', key: 'tenant_id'}, {title: '服务', key: 'service_code', cls: 'num'},
          {title: '状态', render: r => stateTag(r.state)}, {title: '环境', key: 'env'},
          {title: '可交付路口', cls: 'num', render: r => r.deliverable}],
        rows, empty: '暂无订阅'})})
    + UI.alert('暂停指令经约定保密渠道下达，指令内容不在车企侧展示（F-14）。');
}},
{persona: 'gov', group: '监管', id: 'suspend', title: '暂停与成效', icon: '⏸', modules: ['GV-2', 'OP-3'], render: async () => {
  const su = (await api('/api/suspensions')).body, st = (await api('/api/receipts')).body;
  const act = su.filter(s => s.state === 'ACTIVE');
  return UI.pageHead({title: '暂停与成效', desc: '交警可直接下达暂停指令；服务成效以回执口径统计，不含任何车辆标识。',
      ops: [UI.btn('下达暂停', 'suspendForm()', {type: 'danger'})]})
    + UI.stats([{title: '生效中的暂停', value: act.length},
        {title: '本月指令', value: su.length},
        {title: '有效送达率', value: st.delivery_rate + '%', sub: '服务成效口径'},
        {title: '显示率', value: st.display_rate + '%'}])
    + UI.card({title: '暂停指令', flush: true, body: UI.table({
        columns: [{title: '指令号', key: 'id', cls: 'num'},
          {title: '范围', render: s => `${esc(s.scope_type)} <span class="mono">${esc(s.scope_ref)}</span>`},
          {title: '类型', key: 'kind'},
          {title: '状态', render: s => s.state === 'ACTIVE' ? UI.status('生效中', 'red') : UI.status('已解除', 'green')},
          {title: '下达时间', cls: 'num', render: s => esc((s.issued_at || '').slice(0, 16).replace('T', ' '))},
          {title: '操作', render: s => s.state === 'ACTIVE' ? UI.link('解除', `liftSuspend('${s.id}')`) : '—'}],
        rows: su, empty: '暂无暂停指令'})})
    + UI.alert('暂停在 ≤ 5 分钟内于全部区域云生效；车企侧只看到原因码“维护”，看不到指令范围与类型。');
}},
];

// ===== 交互 =====
function goPage(p) { STATE.p = p; reload(); }
async function subsysDrawer(id) {
  CATALOG ||= (await api('/api/catalog')).body;
  const s = CATALOG.tree.find(x => x.id === id);
  UI.drawer({title: `${s.id} ${s.name}`, body:
    UI.desc([['职责', esc(s.duty)], ['主要用户', esc(s.users)], ['部署', esc(s.deploy)],
             ['起始版本', UI.tag(s.phase, 'blue')], ['进度', `${s.done + s.partial} / ${s.total}`]])
    + s.modules.map(m => `<h4 style="margin:16px 0 6px">${m.id} ${esc(m.name)}
        ${UI.tag(`${m.done + m.partial}/${m.total}`, m.done ? 'green' : 'grey')} ${UI.tag(m.phase, 'blue')}</h4>`
      + UI.table({columns: [{title: '功能点', key: 'id', cls: 'num'}, {title: '说明', key: 'desc'},
          {title: '状态', render: p => stateTag(p.status)}], rows: m.points})).join('')});
}
async function toggleRegion(id, online) {
  await api('/api/regions/' + id, {method: 'PUT', body: JSON.stringify({online: !!online})});
  UI.message(online ? '区域云已恢复在线' : '已模拟区域云离线'); reload();
}
async function ackSnap(sid, rid, ok) {
  await api(`/api/snapshots/${sid}/ack`, {method: 'POST',
    body: JSON.stringify({region_id: rid, ok, reason: ok ? null : '代理校验哈希失败'})});
  UI.message(ok ? `${rid} 已确认生效` : `${rid} 确认失败，已整版回滚`, ok ? 'success' : 'error'); reload();
}
function confirmRollback(sid) {
  UI.confirm({title: '回滚该配置版本？', danger: true, okText: '确认回滚',
    text: '回滚将重新激活上一版本快照，当前版本置为 ROLLED_BACK，操作写入审计。',
    onOk: async () => {
      const r = await api(`/api/snapshots/${sid}/rollback`, {method: 'POST', body: JSON.stringify({why: '运营手工回滚'})});
      UI.message(`已回滚，恢复到 ${r.body.restored || '无上一版本'}`); reload();
    }});
}

// ===== 第二批交互：场景、暂停、工单、留存、画像、回执 =====
const val = id => (el(id) || {}).value;
const formRow = (label, inner, hint) =>
  `<div style="margin-bottom:14px"><label style="display:block;margin-bottom:6px;font-weight:500">${esc(label)}</label>
   ${inner}${hint ? `<div class="muted" style="margin-top:4px;font-size:12px">${esc(hint)}</div>` : ''}</div>`;
const sel = (id, opts, v) => `<select id="${id}" style="width:100%">${opts.map(([k, t]) =>
  `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
const inp = (id, v = '', ph = '') => `<input type="text" id="${id}" value="${esc(v)}" placeholder="${esc(ph)}" style="width:100%">`;
const submitBar = onOk => `<div class="ops" style="margin-top:20px">${UI.btn('取消', 'UI.closeOverlay()')}
  ${UI.btn('提交', onOk, {type: 'primary'})}</div>`;

// ---- SC 场景 ----
async function sceneDrawer(code) {
  const c = (await api('/api/scenes')).body.find(x => x.code === code);
  const cat = {D: '数据算法参数', W: '平台计算预警参数', P: '下发策略'};
  UI.drawer({title: `${c.code} ${c.name}`, body:
    UI.desc([['服务等级', UI.tag(c.level, 'blue')], ['计算侧', UI.tag(c.compute, c.compute === '平台' ? 'gold' : 'grey')],
             ['质量门槛', stateTag(c.quality_req)], ['可订阅版本', UI.tag(c.phase, 'blue')]])
    + '<h4 style="margin:18px 0 8px">参数</h4>'
    + UI.table({columns: [
        {title: '参数', render: r => `${esc(r.label)}<br><span class="mono muted">${esc(r.key)}</span>`},
        {title: '类别', render: r => UI.tag(cat[r.category] || r.category, r.category === 'W' ? 'gold' : 'blue')},
        {title: '当前值', cls: 'num', key: 'value'},
        {title: '范围', cls: 'num', render: r => `${r.vmin} – ${r.vmax}`},
        {title: '约束', render: r => r.only_tighten ? UI.tag(`只可收紧（${r.direction === 'up' ? '只增' : '只减'}）`, 'red') : '<span class="muted">可双向</span>'},
        {title: '操作', render: r => UI.link('调整', `paramForm('${c.code}','${r.key}','${esc(r.label)}',${r.vmin},${r.vmax},'${r.value}')`)}],
      rows: c.params, empty: '本场景无平台侧可配参数'})
    + '<h4 style="margin:18px 0 8px">生效策略</h4>'
    + UI.table({columns: [
        {title: '范围', render: r => `${esc(r.scope_type)} ${esc(r.scope_ref)}`},
        {title: '动作', render: r => r.action === 'ENABLE' ? UI.tag('启用', 'green') : UI.tag('关闭', 'grey')},
        {title: '时段规则', render: r => esc(r.time_rule || '全时段')},
        {title: '下达人', key: 'created_by'}],
      rows: c.policies, empty: '无策略，按默认关闭'})});
}
function paramForm(code, key, label, vmin, vmax, cur) {
  UI.drawer({title: `调整参数 · ${label}`, body:
    UI.alert(`允许范围 ${vmin} – ${vmax}；越界由 R-17 拦截，标记为只可收紧的参数由 R-18 拦截放宽方向的修改。`)
    + formRow('参数键', `<span class="mono">${esc(code)}.${esc(key)}</span>`)
    + formRow('新值', inp('pv', cur), `当前值 ${cur}`)
    + submitBar(`saveParam('${code}','${key}')`)});
}
async function saveParam(code, key) {
  const r = await api(`/api/scenes/${code}/params/${key}`, {method: 'PUT', body: JSON.stringify({value: val('pv')})});
  UI.message(r.ok ? '参数已更新，变更写入审计' : `${r.body.rule || ''} ${r.body.error || '修改失败'}`, r.ok ? 'success' : 'error');
  if (r.ok) { UI.closeOverlay(); reload(); }
}
async function toggleScene(code, on) {
  const go = async () => {
    const r = await api(`/api/scenes/${code}/policies`, {method: 'POST',
      body: JSON.stringify({scope_type: 'city', scope_ref: 'ALL', action: on ? 'ENABLE' : 'DISABLE'})});
    UI.message(r.ok ? `${code} 已全市${on ? '启用' : '关闭'}` : (r.body.error || '操作失败'), r.ok ? 'success' : 'error');
    reload();
  };
  if (on) return go();
  UI.confirm({title: `全市关闭 ${code}？`, danger: true, okText: '确认关闭',
    text: '关闭后所有订阅将不再收到该场景的下发；已在生产的车辆按下一灯周期边界停止提示。', onOk: go});
}

// ---- OP-3 暂停 ----
function suspendForm() {
  UI.drawer({title: '下达暂停指令', body:
    UI.alert('对车企一律只显示原因码“维护”，指令类型与备注不对外展示（F-14）。')
    + formRow('范围类型', sel('ss', [['intersection', '路口'], ['corridor', '走廊'], ['district', '行政区'], ['city', '全市']], 'intersection'))
    + formRow('范围标识', inp('sr', '370102-0001', '路口编号 / 走廊名 / 行政区名；全市填 ALL'))
    + formRow('类型（内部）', sel('sk', [['SPECIAL_DUTY', '特勤'], ['SECURITY', '安全事件'], ['GRANT_SHRINK', '授权收缩'], ['MAINTENANCE', '计划维护']], 'SPECIAL_DUTY'))
    + formRow('备注（内部）', inp('sn', '', '仅平台与交警可见'))
    + submitBar('saveSuspend()')});
}
async function saveSuspend() {
  const r = await api('/api/suspensions', {method: 'POST', body: JSON.stringify({
    scope_type: val('ss'), scope_ref: val('sr'), kind: val('sk'), note: val('sn') || null})});
  UI.message(r.ok ? `暂停指令 ${r.body.id} 已下达` : (r.body.error || '下达失败'), r.ok ? 'success' : 'error');
  UI.closeOverlay(); reload();
}
function liftSuspend(id) {
  UI.confirm({title: '解除该暂停指令？', okText: '确认解除',
    text: '解除后相关路口在下一灯周期边界恢复交付，操作写入审计。',
    onOk: async () => { await api(`/api/suspensions/${id}/lift`, {method: 'POST', body: '{}'});
      UI.message('已解除'); reload(); }});
}

// ---- NT-4 工单 ----
function ticketForm() {
  UI.drawer({title: '手工建单', body:
    formRow('类型', sel('tk', [['QUALITY', '质量降级'], ['DEVICE', '设备故障'], ['DATA', '数据不一致'], ['ANOMALY', '回执异常']], 'QUALITY'))
    + formRow('标题', inp('tt', '', '例如：泺源大街路口读秒跳变'))
    + formRow('处置方', inp('tg', '运维一组'))
    + formRow('优先级', sel('tp', [['D1', 'D1 · 30 分钟内下线'], ['D2', 'D2 · 3 个工作日'], ['D3', 'D3 · 1 个工作日']], 'D3'))
    + formRow('关联路口', inp('ti', '', '可留空'))
    + submitBar('saveTicket()')});
}
async function saveTicket() {
  if (!val('tt')) return UI.message('请填写标题', 'error');
  const r = await api('/api/tickets', {method: 'POST', body: JSON.stringify({
    kind: val('tk'), title: val('tt'), target: val('tg'), priority: val('tp'), intersection_id: val('ti') || null})});
  UI.message(r.ok ? `工单 ${r.body.id} 已创建` : '创建失败', r.ok ? 'success' : 'error');
  UI.closeOverlay(); reload();
}
async function dispatchTicket(id) {
  await api(`/api/tickets/${id}/dispatch`, {method: 'POST', body: '{}'});
  UI.message('已派单，SLA 开始计时'); reload();
}
function closeTicket(id) {
  UI.drawer({title: `闭环工单 ${id}`, body:
    formRow('处置结论', inp('tc', '已处置', '写入审计，作为 SLA 达成证据'))
    + submitBar(`saveClose('${id}')`)});
}
async function saveClose(id) {
  await api(`/api/tickets/${id}/close`, {method: 'POST', body: JSON.stringify({conclusion: val('tc')})});
  UI.message('工单已闭环'); UI.closeOverlay(); reload();
}

// ---- AU-4 留存 ----
function retentionForm(cat, days) {
  UI.drawer({title: `调整留存期 · ${cat}`, body:
    UI.alert('审计日志留存不得少于 180 天（《网络安全法》第二十一条），低于下限将被拒绝。')
    + formRow('留存天数', inp('rd', String(days)))
    + submitBar(`saveRetention('${cat}')`)});
}
async function saveRetention(cat) {
  const r = await api('/api/retention/' + cat, {method: 'PUT', body: JSON.stringify({days: Number(val('rd'))})});
  UI.message(r.ok ? '留存期已更新' : (r.body.error || '不满足法定下限'), r.ok ? 'success' : 'error');
  if (r.ok) { UI.closeOverlay(); reload(); }
}
function confirmPurge(cat, n) {
  UI.confirm({title: `清理 ${cat} 的超期数据？`, danger: true, okText: '执行清理',
    text: `本次将删除 ${n} 条已超过留存期的记录，不可恢复；系统将出具销毁证明并写入审计。`,
    onOk: async () => { const r = await api(`/api/retention/${cat}/purge`, {method: 'POST', body: '{}'});
      UI.message(`已销毁 ${r.body.removed} 条，证明编号 ${r.body.cert_no}`); reload(); }});
}

// ---- TN-2 画像 ----
function profileForm() {
  UI.drawer({title: '提交车型能力画像', body:
    UI.alert('展示档位与服务等级上限由平台按申报能力推导，不可自行指定。')
    + formRow('车型', inp('pm', '', '例如：A5 EV'))
    + formRow('年款', inp('py', '2027'))
    + formRow('T-BOX', sel('pt', [['4G', '4G'], ['5G', '5G'], ['5G+PC5', '5G + PC5']], '5G'))
    + formRow('PC5 直连', sel('pp', [['0', '不支持'], ['1', '支持']], '0'), '支持 PC5 方可申请 S2')
    + formRow('定位', sel('pg', [['GNSS', 'GNSS'], ['RTK', 'RTK 车道级']], 'GNSS'))
    + formRow('导航', sel('pn', [['NONE', '无导航'], ['SD', 'SD 道路级'], ['LANE', '车道级']], 'SD'))
    + formRow('HUD', sel('ph', [['NONE', '无'], ['W', 'W-HUD'], ['AR', 'AR-HUD']], 'NONE'))
    + formRow('车道级摄像头', sel('pc', [['0', '无'], ['1', '有']], '0'))
    + formRow('支持 OTA', sel('po', [['1', '支持'], ['0', '不支持']], '1'), '不支持 OTA 的车型落到 V6 受限档位')
    + submitBar('saveProfile()')});
}
async function saveProfile() {
  if (!val('pm')) return UI.message('请填写车型', 'error');
  const r = await api('/api/profiles', {method: 'POST', body: JSON.stringify({
    tenant_id: 'OEM01', model: val('pm'), year: val('py'), caps: {
      tbox: val('pt'), pc5: val('pp') === '1', positioning: val('pg'), nav: val('pn'),
      hud: val('ph'), lane_cam: val('pc') === '1', ota: val('po') === '1'}})});
  UI.message(r.ok ? `画像已提交：档位 ${r.body.display_tier}，匹配上限 ${r.body.match_max}，等级上限 ${r.body.level_max}` : '提交失败',
    r.ok ? 'success' : 'error');
  UI.closeOverlay(); reload();
}

// ---- SC-5 订阅场景 ----
function pickSub(id) { STATE.sid = id; reload(); }
async function toggleSubScene(sid, code, on) {
  const r = await api(`/api/subscriptions/${sid}/scenes/${code}`, {method: 'PUT', body: JSON.stringify({enabled: !!on})});
  UI.message(r.ok ? `${code} 已${on ? '开启' : '关闭'}` : `${r.body.rule || ''} ${r.body.error || '操作失败'}`,
    r.ok ? 'success' : 'error');
  reload();
}

// ---- EV-1 回执 ----
async function mockReceipts() {
  const subs = (await api('/api/subscriptions')).body;
  if (!subs.length) return UI.message('请先创建订阅', 'error');
  const sid = subs[0].id;
  const ints = (await api(`/api/subscriptions/${sid}`)).body.intersections || [];
  const iid = (typeof ints[0] === 'string' ? ints[0] : (ints[0] || {}).id) || '370102-0001';
  const hour = new Date().toISOString().slice(0, 13).replace(/[-T]/g, '');
  const rows = [{intersection_id: iid, status: 'PRESENTED', cnt: 820},
                {intersection_id: iid, status: 'VALIDATED', cnt: 130},
                {intersection_id: iid, status: 'SUPPRESSED', reason_code: 'HIGHER_PRIORITY', cnt: 30},
                {intersection_id: iid, status: 'UNVERIFIABLE', reason_code: 'NO_FINAL_STATE', cnt: 20}];
  const r = await api('/api/receipts', {method: 'POST', body: JSON.stringify({sub_id: sid, hour, rows})});
  UI.message(r.ok ? `已上报 ${rows.length} 条聚合回执` : (r.body.error || '上报失败'), r.ok ? 'success' : 'error');
  reload();
}
async function mockAnomaly() {
  const subs = (await api('/api/subscriptions')).body;
  if (!subs.length) return UI.message('请先创建订阅', 'error');
  const r = await api('/api/receipts/anomaly', {method: 'POST', body: JSON.stringify({
    sub_id: subs[0].id, kind: 'SUSPECT_D1', detail: '绿灯读秒与实际相位不一致，疑似 D1'})});
  UI.message(`异常已回传，自动建单 ${r.body.ticket}`); reload();
}

// ===== 第三批交互：ICD、应急、凭证、联调 =====
// ---- AD ICD ----
async function icdDrawer(id) {
  const d = (await api('/api/icds')).body, i = d.icds.find(x => x.id === id);
  UI.drawer({title: `${i.id} ${i.title}`, body:
    UI.desc([['状态', stateTag(i.state)], ['定义形式', esc(i.spec_kind)],
             ['文件位置', `<span class="mono">${esc(i.spec_ref)}</span>`],
             ['变更点', esc(i.changes || '—')], ['兼容性说明', esc(i.compat || '—')],
             ['冻结', `${esc((i.frozen_at || '—').slice(0, 19).replace('T', ' '))} ${esc(i.frozen_by || '')}`]])
    + '<h4 style="margin:18px 0 8px">绑定服务</h4>'
    + (i.services.length ? i.services.map(s => UI.tag(s, 'blue')).join(' ') : UI.empty('未绑定服务'))
    + '<h4 style="margin:18px 0 8px">车企确认记录</h4>'
    + UI.table({columns: [{title: '租户', key: 'tenant_id'}, {title: '确认人', key: 'acked_by'},
        {title: '时间', cls: 'num', render: a => esc(a.acked_at.slice(0, 19).replace('T', ' '))}],
      rows: i.acks, empty: '尚无车企确认'})
    + (i.state === 'FROZEN' ? `<div class="ops" style="margin-top:16px">${UI.btn('代车企登记确认', `ackIcd('${i.id}')`, {type: 'primary'})}</div>` : '')});
}
function icdForm() {
  UI.drawer({title: '上传 ICD 新版本', body:
    UI.alert('新版本以草稿创建；冻结前需经评审并填写兼容性说明。已冻结版本不可覆盖，只能新开版本号。')
    + formRow('版本号', inp('iv', '', '例如 1.2'))
    + formRow('标题', inp('it', '数据上车接口控制文件 V1.2'))
    + formRow('定义形式', sel('ik', [['OpenAPI', 'OpenAPI'], ['AsyncAPI', 'AsyncAPI'], ['PDF', '文档']], 'OpenAPI'))
    + formRow('文件位置', inp('ir', 'icd/v1.2/openapi.yaml'))
    + formRow('变更点', inp('ic', '', '本版新增或修改了什么'))
    + submitBar('saveIcd()')});
}
async function saveIcd() {
  if (!val('iv')) return UI.message('请填写版本号', 'error');
  const r = await api('/api/icds', {method: 'POST', body: JSON.stringify({
    version: val('iv'), title: val('it'), spec_kind: val('ik'), spec_ref: val('ir'), changes: val('ic')})});
  UI.message(r.ok ? `${r.body.id} 已创建（草稿）` : (r.body.error || '创建失败'), r.ok ? 'success' : 'error');
  if (r.ok) { UI.closeOverlay(); reload(); }
}
function freezeForm(id) {
  UI.drawer({title: `冻结 ${id}`, body:
    UI.alert('冻结后内容不可再改，预生产与生产订阅只能使用已冻结版本（R-16）。')
    + formRow('与上一版本的差异与兼容性说明', inp('ifc', '', '例如：新增字段可选，旧客户端可忽略'))
    + submitBar(`doFreeze('${id}')`)});
}
async function doFreeze(id) {
  if (!val('ifc')) return UI.message('请填写兼容性说明', 'error');
  const r = await api(`/api/icds/${id}/state`, {method: 'PUT', body: JSON.stringify({state: 'FROZEN', compat: val('ifc')})});
  UI.message(r.ok ? `${id} 已冻结` : (r.body.error || '冻结失败'), r.ok ? 'success' : 'error');
  if (r.ok) { UI.closeOverlay(); reload(); }
}
async function icdState(id, state) {
  const go = async () => {
    const r = await api(`/api/icds/${id}/state`, {method: 'PUT', body: JSON.stringify({state})});
    UI.message(r.ok ? '状态已更新' : (r.body.error || '操作失败'), r.ok ? 'success' : 'error');
    reload();
  };
  if (state !== 'DEPRECATED') return go();
  UI.confirm({title: `废弃 ${id}？`, danger: true, okText: '确认废弃',
    text: '废弃后不能再绑定到新的服务版本；已在生产使用该版本的订阅需先迁移到新版本。', onOk: go});
}
async function ackIcd(id) {
  const r = await api(`/api/icds/${id}/ack`, {method: 'POST', body: JSON.stringify({tenant_id: 'OEM01'})});
  UI.message(r.ok ? '已登记车企确认' : (r.body.error || '登记失败'), r.ok ? 'success' : 'error');
  UI.closeOverlay(); reload();
}

// ---- OP-6 应急 ----
function incidentForm() {
  UI.drawer({title: '新建事件单', body:
    UI.alert('级别决定对外通报时限：P1 一小时，P2 四小时，P3 一个工作日。')
    + formRow('级别', sel('nl', [['P1', 'P1 · 影响安全或大范围服务'], ['P2', 'P2 · 影响部分服务'], ['P3', 'P3 · 局部或可观察']], 'P2'))
    + formRow('标题', inp('nt', '', '例如：泺源大街 3 个路口断流'))
    + formRow('情况说明', inp('ns', '', '现象、影响范围、已知原因'))
    + submitBar('saveIncident()')});
}
async function saveIncident() {
  if (!val('nt')) return UI.message('请填写标题', 'error');
  const r = await api('/api/incidents', {method: 'POST', body: JSON.stringify({
    level: val('nl'), title: val('nt'), summary: val('ns')})});
  UI.message(r.ok ? `事件单 ${r.body.id} 已建立` : '创建失败', r.ok ? 'success' : 'error');
  UI.closeOverlay(); reload();
}
async function incidentDrawer(id) {
  const d = (await api('/api/incidents')).body, i = d.incidents.find(x => x.id === id);
  const opts = Object.entries(d.actions);
  UI.drawer({title: `${i.id} ${i.title}`, body:
    UI.desc([['级别', UI.tag(i.level, i.level === 'P1' ? 'red' : 'gold')], ['状态', stateTag(i.state)],
             ['情况说明', esc(i.summary || '—')],
             ['通报时限', esc(i.notify_due.slice(0, 19).replace('T', ' ')) + (i.notify_late ? ' ' + UI.tag('已超时', 'red') : '')],
             ['复盘', esc(i.review || '—')]])
    + '<h4 style="margin:18px 0 8px">已执行处置</h4>'
    + UI.table({columns: [{title: '动作', render: a => esc(a.name)},
        {title: '对象', render: a => `<span class="mono">${esc(a.target)}</span>`},
        {title: '结果', render: a => esc(a.result)},
        {title: '执行', render: a => `${esc(a.by)} ${esc(a.at.slice(11, 19))}`}],
      rows: i.actions, empty: '尚未执行处置动作'})
    + (i.state === 'CLOSED' ? '' :
      '<h4 style="margin:18px 0 8px">处置动作台</h4>'
      + formRow('动作', sel('ia', opts, 'SUSPEND'))
      + formRow('对象', inp('it2', '', '路口编号 / 快照号 / 证书号 / 租户号'))
      + `<div class="ops">${UI.btn('执行', `doAct('${i.id}')`, {type: 'danger'})}
         ${UI.btn('登记通报', `doNotify('${i.id}')`)}
         ${UI.btn('填写复盘并闭环', `closeIncident('${i.id}')`, {type: 'primary'})}</div>`)});
}
async function doAct(id) {
  if (!val('it2')) return UI.message('请填写处置对象', 'error');
  const r = await api(`/api/incidents/${id}/act`, {method: 'POST', body: JSON.stringify({
    action: val('ia'), target: val('it2')})});
  UI.message(r.ok ? '处置已执行并记入事件单' : (r.body.error || '执行失败'), r.ok ? 'success' : 'error');
  if (r.ok) { UI.closeOverlay(); reload(); }
}
async function doNotify(id) {
  const r = await api(`/api/incidents/${id}/notify`, {method: 'POST', body: JSON.stringify({
    channel: '短信 + 邮件', text: '已按预案处置，服务影响范围与恢复时间另行通报'})});
  UI.message(r.body.on_time ? '通报已登记，在时限内' : '通报已登记，但已超过时限', r.body.on_time ? 'success' : 'error');
  UI.closeOverlay(); reload();
}
function closeIncident(id) {
  UI.drawer({title: `闭环 ${id}`, body:
    UI.alert('复盘是闭环的前置条件，须包含根因、影响面、改进项与责任人。')
    + formRow('复盘', inp('ir2', '', '根因：…；影响：…；改进：…；责任人：…'))
    + submitBar(`doClose('${id}')`)});
}
async function doClose(id) {
  const r = await api(`/api/incidents/${id}/close`, {method: 'POST', body: JSON.stringify({review: val('ir2')})});
  UI.message(r.ok ? '事件已闭环' : (r.body.error || '闭环失败'), r.ok ? 'success' : 'error');
  if (r.ok) { UI.closeOverlay(); reload(); }
}

// ---- CR 凭证与环境 ----
const SAMPLE_CSR = '-----BEGIN CERTIFICATE REQUEST-----\nCN=oem01.v2x.jinan\n'
  + 'MIIByjCCATMCAQAwgYkxCzAJBgNVBAYTAkNOMRAwDgYDVQQIDAdTaGFuZG9uZzEQ\n'.repeat(3)
  + '-----END CERTIFICATE REQUEST-----';
function certForm(replaces, env) {
  UI.drawer({title: replaces ? `轮换证书（替换 ${replaces}）` : '提交 CSR 签发证书', body:
    UI.alert(replaces ? '轮换期间新旧证书并行可用，确认新证书生效后再停用旧证书，避免换证断连。'
                      : '平台只接收 CSR，私钥始终保留在车企侧，不上传、不托管。')
    + formRow('环境', sel('ce', [['sandbox', '沙箱'], ['preprod', '预生产'], ['prod', '生产']], env || 'sandbox'))
    + formRow('CSR（PEM）', `<textarea id="cs" style="width:100%;height:120px;font-family:var(--mono,monospace);font-size:12px;padding:8px;border:1px solid var(--border);border-radius:var(--radius)">${esc(SAMPLE_CSR)}</textarea>`,
              '示例已预填，可直接提交演示')
    + submitBar(`saveCert(${replaces ? `'${replaces}'` : 'null'})`)});
}
async function saveCert(replaces) {
  const r = await api('/api/certs', {method: 'POST', body: JSON.stringify({
    tenant_id: 'OEM01', env: val('ce'), csr: val('cs'), replaces})});
  UI.message(r.ok ? `已签发 ${r.body.id}，有效期至 ${r.body.not_after}` : (r.body.error || '签发失败'),
    r.ok ? 'success' : 'error');
  if (r.ok) { UI.closeOverlay(); reload(); }
}
function confirmRevoke(id) {
  UI.confirm({title: `吊销证书 ${id}？`, danger: true, okText: '确认吊销',
    text: '吊销立即生效，使用该证书的连接会中断；若该环境没有其他有效证书，相关订阅将不满足 R-09。',
    onOk: async () => { await api(`/api/certs/${id}/revoke`, {method: 'POST', body: JSON.stringify({reason: '密钥泄露'})});
      UI.message('证书已吊销'); reload(); }});
}
function ipForm() {
  UI.drawer({title: '申请出口 IP 白名单', body:
    UI.alert('网络准入变更须双人复核：申请人不得自审，由平台运营审批后生效。')
    + formRow('环境', sel('ie', [['sandbox', '沙箱'], ['preprod', '预生产'], ['prod', '生产']], 'prod'))
    + formRow('出口 IP / CIDR', inp('ic2', '203.0.113.8/32'))
    + formRow('用途', inp('ip2', '生产环境车云出口'))
    + submitBar('saveIp()')});
}
async function saveIp() {
  const r = await api('/api/ip-allow', {method: 'POST', body: JSON.stringify({
    tenant_id: 'OEM01', env: val('ie'), cidr: val('ic2'), purpose: val('ip2')})});
  UI.message(r.ok ? `${r.body.id} 已提交，等待运营审批` : (r.body.error || '提交失败'), r.ok ? 'success' : 'error');
  if (r.ok) { UI.closeOverlay(); reload(); }
}
async function openEnv(env) {
  const r = await api(`/api/envs/OEM01/${env}/open`, {method: 'POST', body: '{}'});
  UI.message(r.ok ? `${env} 环境已开通` : `${r.body.rule || ''} ${r.body.error || '开通失败'}`, r.ok ? 'success' : 'error');
  reload();
}

// ---- DT 联调 ----
function setScene(s) { STATE.scene = s; reload(); }
function gotoDiag(sid) { STATE.sid = sid; location.hash = '#/oem/sandbox'; }
async function faultForm() {
  const d = (await api('/api/sandbox?tenant=OEM01')).body;
  const opts = Object.entries(d.faults).map(([k, v]) => [k, `${v[0]} · ${v[1]}`]);
  UI.drawer({title: '注入故障', body:
    UI.alert('故障注入会改变平台真实状态（发布位、质量等级、证书、暂停指令），结束时自动恢复现场。')
    + formRow('故障类型', sel('fk', opts, 'QUALITY_DEGRADE'))
    + formRow('对象', inp('ft', '370102-0001', '路口编号；证书过期类填证书编号'))
    + submitBar('saveFault()')});
}
async function saveFault() {
  const r = await api('/api/sandbox/faults', {method: 'POST', body: JSON.stringify({
    tenant_id: 'OEM01', kind: val('fk'), target: val('ft')})});
  UI.message(r.ok ? `已注入：${r.body.observed}` : (r.body.error || '注入失败'), r.ok ? 'success' : 'error');
  UI.closeOverlay(); reload();
}
async function finishFault(id) {
  await api(`/api/sandbox/faults/${id}/finish`, {method: 'POST', body: '{}'});
  UI.message('注入已结束，现场已恢复'); reload();
}
async function runForm() {
  const d = (await api('/api/sandbox?tenant=OEM01')).body;
  UI.drawer({title: '登记用例执行结果', body:
    formRow('用例', sel('rc', d.cases.map(c => [c.id, `${c.id} ${c.name}`]), d.cases[0].id))
    + formRow('结果', sel('rr', [['PASS', '通过'], ['FAIL', '失败'], ['NA', '不适用']], 'PASS'))
    + formRow('缺陷等级（失败时必填）', sel('rd', [['', '无'], ['D1', 'D1'], ['D2', 'D2'], ['D3', 'D3'], ['D4', 'D4']], ''))
    + formRow('绑定 ICD 版本', sel('ri', (await api('/api/icds')).body.icds.map(i => [i.id, `${i.id} ${i.state}`]), 'ICD-1.0'))
    + formRow('备注', inp('rn', ''))
    + submitBar('saveRun()')});
}
async function saveRun() {
  const r = await api('/api/sandbox/runs', {method: 'POST', body: JSON.stringify({
    tenant_id: 'OEM01', case_id: val('rc'), result: val('rr'),
    defect_level: val('rd') || null, icd_id: val('ri'), note: val('rn')})});
  UI.message(r.ok ? '已登记' : (r.body.error || '登记失败'), r.ok ? 'success' : 'error');
  if (r.ok) { UI.closeOverlay(); reload(); }
}

// ---- NT-2 车企工单 ----
async function oemTicketForm(priority) {
  const subs = (await api('/api/subscriptions')).body.filter(s => s.tenant_id === 'OEM01');
  UI.drawer({title: priority === 'D1' ? 'D1 快速通道' : '提交问题单', body:
    (priority === 'D1' ? UI.alert('D1 用于可能造成误导或安全影响的问题，平台按最高优先级处置，必要时直接下线相关路口。', 'warn') : '')
    + formRow('关联订阅', sel('ot', subs.map(s => [s.id, `${s.id} ${s.service_code}`]), (subs[0] || {}).id))
    + formRow('标题', inp('oT', '', '例如：读秒与实际相位不一致'))
    + formRow('关联路口', inp('oi', '370102-0001', '可留空'))
    + formRow('优先级', sel('op', [['D1', 'D1 · 安全影响'], ['D2', 'D2 · 功能受损'], ['D3', 'D3 · 一般问题']], priority || 'D3'))
    + submitBar('saveOemTicket()')});
}
async function saveOemTicket() {
  if (!val('oT')) return UI.message('请填写标题', 'error');
  const r = await api('/api/tickets', {method: 'POST', body: JSON.stringify({
    kind: 'QUALITY', title: val('oT'), target: '平台数据运营', priority: val('op'),
    intersection_id: val('oi') || null, sub_id: val('ot')})});
  UI.message(r.ok ? `问题单 ${r.body.id} 已提交` : '提交失败', r.ok ? 'success' : 'error');
  UI.closeOverlay(); reload();
}
