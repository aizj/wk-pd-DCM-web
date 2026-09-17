/* 外壳：hash 路由、菜单渲染、全局状态 */
const H = {'Content-Type': 'application/json', 'X-Actor': 'ops.demo'};
const api = (p, o = {}) => fetch(p, {headers: H, ...o}).then(async r => ({ok: r.ok, body: await r.json()}));
let CATALOG = null, STATE = {page: {}};

const PERSONA_NAME = {ops: '运营控制台', oem: '车企门户', gov: '交警监管视图'};

function renderMenu(persona, active) {
  document.querySelectorAll('#persona button').forEach(b => b.classList.toggle('on', b.dataset.p === persona));
  const groups = {};
  PAGES.filter(p => p.persona === persona).forEach(p => (groups[p.group] ||= []).push(p));
  el('menu').innerHTML = Object.entries(groups).map(([g, ps]) =>
    `<div class="g">${esc(g)}</div>` + ps.map(p =>
      `<a href="#/${p.persona}/${p.id}" class="${p.id === active ? 'on' : ''}">
        <span>${esc(p.icon || '·')}</span>${esc(p.title)}<em>${p.modules[0] || ''}</em></a>`).join('')).join('');
}

async function refreshGateTag() {
  const g = (await api('/api/gate')).body;
  const t = el('gateTag');
  t.className = 'tag ' + (g.state === 'UNCONFIRMED' ? 'red' : 'green');
  t.textContent = '门禁 ' + (g.state === 'UNCONFIRMED' ? '未确认' : '已确认');
}

async function placeholder(page) {
  CATALOG ||= (await api('/api/catalog')).body;
  const mods = CATALOG.tree.flatMap(s => s.modules).filter(m => page.modules.includes(m.id));
  if (!mods.length) return UI.card({title: '开发中', body: UI.empty('本页尚未映射功能模块')});
  return UI.alert(`本页为<b>功能骨架</b>：下方功能点状态取自后端 <span class="mono">/api/catalog</span>，实现后自动更新，无需改页面。`)
    + mods.map(m => UI.card({
      title: `${m.id} ${m.name}`,
      ops: [UI.tag(`${m.done + m.partial}/${m.total} 已实现`, m.done ? 'green' : 'grey'),
            UI.tag(`计划 ${m.phase}`, 'blue'), UI.tag(`需求 ${m.req}`, 'grey')],
      flush: true,
      body: UI.table({
        columns: [{title: '功能点', key: 'id', cls: 'num'}, {title: '说明', key: 'desc'},
                  {title: '状态', render: r => stateTag(r.status)}],
        rows: m.points})})).join('');
}

async function route() {
  const [, persona = 'ops', id] = (location.hash || '#/ops/overview').slice(1).split('/');
  const list = PAGES.filter(p => p.persona === persona);
  const page = list.find(p => p.id === id) || list[0];
  STATE.page = {persona, id: page.id, p: 1};
  renderMenu(persona, page.id);
  el('crumb').innerHTML = `${PERSONA_NAME[persona]} / ${esc(page.group)} / <b>${esc(page.title)}</b>`
    + (page.modules.length ? `　<span class="mono muted">${page.modules.join(' · ')}</span>` : '');
  el('page').innerHTML = UI.card({title: page.title, body: UI.skeleton()});
  refreshGateTag();
  try {
    el('page').innerHTML = page.render ? await page.render() : await placeholder(page);
  } catch (e) {
    el('page').innerHTML = UI.card({title: '页面出错', body: `<pre class="mono">${esc(e.stack || e)}</pre>`});
  }
}
const reload = () => route();

document.querySelectorAll('#persona button').forEach(b =>
  b.onclick = () => { location.hash = `#/${b.dataset.p}/`; });
window.addEventListener('hashchange', route);
route();
