/* 极简 UI kit：对齐 Ant Design 的 B 端组件语义，零依赖。 */
const esc = s => String(s ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const el = id => document.getElementById(id);

const UI = {
  pageHead: ({title, desc, ops = []}) => `<div class="pagehead"><div>
      <h1>${esc(title)}</h1>${desc ? `<p>${desc}</p>` : ''}</div>
      ${ops.length ? `<div class="ops">${ops.join('')}</div>` : ''}</div>`,

  card: ({title, ops = [], body, flush}) => `<section class="card">
      ${title ? `<div class="hd"><h2>${esc(title)}</h2>${ops.length ? `<div class="ops">${ops.join('')}</div>` : ''}</div>` : ''}
      <div class="bd${flush ? ' flush' : ''}">${body}</div></section>`,

  btn: (text, onclick, {type = '', size = '', disabled = false} = {}) =>
    `<button class="btn ${type} ${size}" ${disabled ? 'disabled' : ''} onclick="${esc(onclick)}">${esc(text)}</button>`,

  tag: (text, color = 'grey') => `<span class="tag ${color}">${esc(text)}</span>`,
  status: (text, color = 'grey') => `<span><i class="dot ${color}"></i>${esc(text)}</span>`,
  link: (text, onclick, danger) => `<a class="linkbtn ${danger ? 'danger' : ''}" onclick="${esc(onclick)}">${esc(text)}</a>`,

  stats: items => `<div class="stats">${items.map(i => `<div class="stat">
      <div class="t">${esc(i.title)}</div><div class="v">${i.value}</div>
      ${i.sub ? `<div class="s">${i.sub}</div>` : ''}</div>`).join('')}</div>`,

  desc: rows => `<dl class="desc">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`,

  empty: (text = '暂无数据', hint = '') =>
    `<div class="empty"><i>○</i>${esc(text)}${hint ? `<div class="muted" style="margin-top:6px">${hint}</div>` : ''}</div>`,

  skeleton: (n = 4) => `<div class="bd">${Array(n).fill('<div class="skeleton"></div>').join('')}</div>`,

  alert: (text, type = 'info') => `<div class="alert ${type}">${text}</div>`,

  /* 表格：支持筛选、搜索、分页。columns: [{title, key, render?, cls?}] */
  table: ({columns, rows, empty, filters = [], page = 1, size = 0, onPage}) => {
    const total = rows.length;
    const pageRows = size ? rows.slice((page - 1) * size, page * size) : rows;
    const head = `<tr>${columns.map(c => `<th class="${c.cls || ''}">${esc(c.title)}</th>`).join('')}</tr>`;
    const body = pageRows.map(r => `<tr>${columns.map(c =>
      `<td class="${c.cls || ''}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('');
    const pager = size && total > size ? `<div class="pager">共 ${total} 条
        ${UI.btn('上一页', `${onPage}(${page - 1})`, {size: 'sm', disabled: page <= 1})}
        <span>${page} / ${Math.ceil(total / size)}</span>
        ${UI.btn('下一页', `${onPage}(${page + 1})`, {size: 'sm', disabled: page >= Math.ceil(total / size)})}</div>` : '';
    return (filters.length ? `<div class="filter">${filters.join('')}</div>` : '')
      + (total ? `<div class="tablewrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>${pager}`
               : UI.empty(empty || '暂无数据'));
  },

  drawer: ({title, body}) => {
    UI.closeOverlay();
    document.body.insertAdjacentHTML('beforeend',
      `<div class="mask" id="overlay" onclick="if(event.target.id==='overlay')UI.closeOverlay()">
         <div class="drawer"><div class="hd"><h3>${esc(title)}</h3>
           <div class="ops" style="margin-left:auto">${UI.btn('关闭', 'UI.closeOverlay()', {size: 'sm'})}</div></div>
         <div class="bd">${body}</div></div></div>`);
  },

  confirm: ({title, text, okText = '确定', danger = false, onOk}) => {
    UI.closeOverlay();
    window.__confirmOk = onOk;
    document.body.insertAdjacentHTML('beforeend',
      `<div class="mask" id="overlay" style="align-items:center;justify-content:center"
            onclick="if(event.target.id==='overlay')UI.closeOverlay()">
         <div class="modal"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="ops">
           ${UI.btn('取消', 'UI.closeOverlay()')}
           ${UI.btn(okText, 'UI.okConfirm()', {type: danger ? 'danger' : 'primary'})}</div></div></div>`);
  },
  okConfirm() { const f = window.__confirmOk; UI.closeOverlay(); f && f(); },
  closeOverlay() { const o = el('overlay'); if (o) o.remove(); },

  message(text, type = 'success') {
    const icon = {success: '✓', error: '✕', info: 'ℹ'}[type] || 'ℹ';
    const color = {success: 'var(--success)', error: 'var(--error)', info: 'var(--primary)'}[type];
    document.querySelectorAll('.message').forEach(m => m.remove());
    document.body.insertAdjacentHTML('beforeend',
      `<div class="message"><span style="color:${color}">${icon}</span>${esc(text)}</div>`);
    clearTimeout(window._msg);
    window._msg = setTimeout(() => document.querySelectorAll('.message').forEach(m => m.remove()), 3000);
  },
};

/* 常用状态映射 */
const TAGS = {
  ACTIVE: 'green', CANARY: 'blue', PREPROD: 'blue', SANDBOX: 'gold', VERIFIED: 'gold',
  DRAFT: 'grey', SUBMITTED: 'gold', REVIEW: 'gold', REJECTED: 'red', SUSPENDED: 'red', TERMINATED: 'grey',
  BUILT: 'grey', PUSHING: 'gold', ROLLED_BACK: 'red', SUPERSEDED: 'grey',
  ACKED: 'green', PENDING: 'gold', FAILED: 'red',
  DONE: 'green', PARTIAL: 'gold', TODO: 'grey',
  OPERATOR_AUTHORIZED: 'green', PARTNER_AUTHORIZED: 'green', UNCONFIRMED: 'red', EXPIRED: 'red', REVOKED: 'red',
  A: 'green', B: 'blue', C: 'gold', X: 'red',
};
const stateTag = s => UI.tag(s, TAGS[s] || 'grey');
