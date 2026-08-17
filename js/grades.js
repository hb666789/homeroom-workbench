/* ============================================================
 * grades.js — 成绩管理
 * 考试列表 / 新建编辑考试 / 成绩录入（自动算总分、平均、排名、班级平均）
 * ============================================================ */
const Grades = (function () {
  function render() {
    const exams = Store.listExams().slice().reverse(); // 按日期倒序
    const sel = App.state.selectedExam;
    let html = `
      <div class="page-head">
        <h2>成绩管理</h2>
        <button class="btn btn-primary" onclick="Grades.openExamForm()">+ 新建考试</button>
      </div>
      <div class="pane">
        <div class="list-panel card">
          <div class="list-title">考试列表</div>`;
    if (!exams.length) html += '<div class="empty small">暂无考试，点击右上角新建</div>';
    exams.forEach(e => {
      const active = e.id === sel;
      html += `<div class="list-item ${active ? 'active' : ''}" onclick="Grades.select('${e.id}')">
        <div>
          <strong>${esc(e.name)}</strong>
          <div class="muted small">${esc(e.date)} · ${esc(e.type)}</div>
        </div>
        <div class="list-ops">
          <button class="btn btn-xs" onclick="event.stopPropagation();Grades.openExamForm('${e.id}')">编辑</button>
          <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();Grades.delExam('${e.id}')">删除</button>
        </div>
      </div>`;
    });
    html += `</div>
      <div class="content-panel card">`;
    if (!sel || !Store.getExam(sel)) html += '<div class="empty">选择左侧考试开始录入成绩，或新建一场考试</div>';
    else html += scoreGridHtml(Store.getExam(sel));
    html += '</div></div>';
    App.setViewHtml(html);
  }

  function select(eid) {
    App.state.selectedExam = eid;
    render();
  }

  /* ---------- 考试编辑 ---------- */
  function openExamForm(eid) {
    const e = eid ? Store.getExam(eid) : null;
    const used = e ? e.subjects : Store.listSubjects().map(s => s.name);
    App.openModal(`
      <div class="modal-head">
        <h3>${e ? '编辑考试' : '新建考试'}</h3>
        <button class="modal-x" onclick="App.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>考试名称 *</label>
            <input id="f_ename" class="input" placeholder="如：2026年3月月考" value="${escA(e ? e.name : '')}"></div>
          <div class="field"><label>考试日期</label>
            <input id="f_edate" type="date" class="input" value="${escA(e ? e.date : today())}"></div>
          <div class="field"><label>考试类型</label>
            <select id="f_etype" class="select">
              ${['周测', '月考', '期中', '期末', '模拟', '其他'].map(t => `<option ${e && e.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select></div>
        </div>
        <div style="margin-top:14px">
          <label style="font-size:12.5px;color:#5a6072">考试科目（可勾选本次考试包含的科目）</label>
          <div style="margin-top:8px">
            ${Store.listSubjects().map((s, i) =>
              `<label class="chk"><input type="checkbox" id="esub_${i}" ${used.includes(s.name) ? 'checked' : ''}> ${esc(s.name)}（${s.full}分）</label>`
            ).join('')}
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="App.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="Grades.saveExam('${eid || ''}')">保存</button>
      </div>`);
  }

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function saveExam(eid) {
    const v = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const name = v('f_ename').trim();
    if (!name) return App.toast('请填写考试名称', 'error');
    const subs = Store.listSubjects()
      .map((s, i) => ({ name: s.name, checked: document.getElementById('esub_' + i) && document.getElementById('esub_' + i).checked }))
      .filter(x => x.checked)
      .map(x => x.name);
    if (!subs.length) return App.toast('请至少选择一个科目', 'error');
    const info = { name, date: v('f_edate') || today(), type: v('f_etype') || '月考', subjects: subs };
    if (eid) {
      Store.updateExam(eid, info);
      App.toast('已保存');
    } else {
      const ne = Store.addExam(info);
      App.state.selectedExam = ne.id;
      App.toast('已创建考试');
    }
    App.closeModal();
    render();
  }

  function delExam(eid) {
    const e = Store.getExam(eid);
    if (!e) return;
    if (confirm('确定删除考试「' + e.name + '」及其全部成绩记录吗？')) {
      Store.deleteExam(eid);
      if (App.state.selectedExam === eid) App.state.selectedExam = null;
      App.toast('已删除');
      render();
    }
  }

  /* ---------- 成绩录入表 ---------- */
  function scoreGridHtml(exam) {
    const eid = exam.id;
    const students = Store.listStudents().slice().sort((a, b) =>
      String(a.studentNo).localeCompare(String(b.studentNo), 'zh', { numeric: true }));
    const rm = {};
    Store.examRankings(eid).forEach(r => { rm[r.student.id] = r; });
    const avgs = Store.classAvg(eid);

    let html = `<div class="grid-head">
        <div>
          <h3>${esc(exam.name)}</h3>
          <div class="muted small">${esc(exam.date)} · ${esc(exam.type)}　满分：${exam.subjects.map(n => esc(n) + ' ' + Store.fullOf(n)).join('，')}</div>
        </div>
        <div class="muted small">直接修改单元格即可自动保存并重算总分 / 排名 / 班级平均</div>
      </div>
      <div class="table-scroll"><table class="table score-table">
        <thead><tr>
          <th>学号</th><th>姓名</th>`;

    exam.subjects.forEach(n => { html += `<th>${esc(n)}<span class="full">${Store.fullOf(n)}分</span></th>`; });
    html += `<th>总分</th><th>平均</th><th>排名</th></tr></thead>
      <tbody>`;

    students.forEach(s => {
      const r = rm[s.id];
      html += `<tr id="row_${s.id}"><td>${esc(s.studentNo) || '—'}</td><td class="stu-name">${esc(s.name)}</td>`;
      exam.subjects.forEach(n => {
        const v = Store.getScore(s.id, eid, n);
        const full = Store.fullOf(n);
        const low = v != null && v < full * 0.6;
        html += `<td><input type="number" class="score-input ${low ? 'low' : ''}" min="0" max="${full}"
          value="${v == null ? '' : v}" data-sid="${s.id}" data-sub="${escA(n)}"
          oninput="Grades.onScoreInput(event,'${eid}')"></td>`;
      });
      html += `<td class="cell-total" id="tot_${s.id}">${r ? r.total : ''}</td>
        <td id="avg_${s.id}">${r ? (r.total / r.count).toFixed(1) : ''}</td>
        <td id="rank_${s.id}">${r ? r.rank : ''}</td></tr>`;
    });

    html += `</tbody><tfoot><tr><td colspan="2">班级平均</td>`;
    exam.subjects.forEach(n => { html += `<td id="avg_${escA(n)}">${avgs[n] != null ? avgs[n] : '—'}</td>`; });
    html += `<td id="avg_overall">${avgs._overall != null ? avgs._overall : '—'}</td><td></td><td></td></tr></tfoot></table></div>`;
    return html;
  }

  /* 单元格输入：保存 + 局部刷新 */
  function onScoreInput(evt, eid) {
    const exam = Store.getExam(eid);
    if (!exam) return;
    const inp = evt.target;
    const sid = inp.dataset.sid, sub = inp.dataset.sub;
    const full = Store.fullOf(sub);

    let v = inp.value;
    if (v !== '') {
      v = Number(v);
      if (!isFinite(v)) v = '';
      else {
        if (v < 0) v = 0;
        if (v > full) v = full;
      }
    }
    inp.value = v;
    inp.classList.toggle('low', v !== '' && v < full * 0.6);
    Store.setScore(sid, eid, sub, v === '' ? null : v);

    const rankings = Store.examRankings(eid);
    const me = rankings.find(x => x.student.id === sid);
    const totEl = document.getElementById('tot_' + sid);
    const avgEl = document.getElementById('avg_' + sid);
    if (me) {
      if (totEl) totEl.textContent = me.total;
      if (avgEl) avgEl.textContent = (me.total / me.count).toFixed(1);
    } else {
      if (totEl) totEl.textContent = '';
      if (avgEl) avgEl.textContent = '';
    }
    rankings.forEach(r => {
      const el = document.getElementById('rank_' + r.student.id);
      if (el) el.textContent = r.rank;
    });

    const avgs = Store.classAvg(eid);
    exam.subjects.forEach(n => {
      const el = document.getElementById('avg_' + n);
      if (el) el.textContent = avgs[n] != null ? avgs[n] : '—';
    });
    const ao = document.getElementById('avg_overall');
    if (ao) ao.textContent = avgs._overall != null ? avgs._overall : '—';
  }

  return { render, select, openExamForm, saveExam, delExam, onScoreInput };
})();
