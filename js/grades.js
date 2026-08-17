/* ============================================================
 * grades.js — 成绩管理
 * 考试列表 / 成绩录入（自动算总分、排名、班级平均）
 * 试卷题目（添加 + 批量导入）/ 逐题正确率与错误率统计
 * ============================================================ */
const Grades = (function () {
  function val(id) {
    const e = document.getElementById(id);
    return e ? e.value : '';
  }
  function truncate(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function render() {
    const exams = Store.listExams().slice().reverse(); // 按日期倒序
    const sel = App.state.selectedExam;
    let html = `
      <div class="page-head">
        <h2>成绩管理 <span class="muted small">${esc(Store.className())}</span></h2>
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
    if (!sel || !Store.getExam(sel)) html += '<div class="empty">选择左侧考试开始录入成绩 / 导入试卷，或新建一场考试</div>';
    else html += contentHtml(Store.getExam(sel));
    html += '</div></div>';
    App.setViewHtml(html);

    if (sel && Store.getExam(sel)) {
      const exam = Store.getExam(sel);
      if (App.state.gradeTab === 'stats') renderStatsCharts(exam);
    }
  }

  function select(eid) {
    App.state.selectedExam = eid;
    App.state.gradeTab = 'scores';
    render();
  }
  function setTab(t) {
    App.state.gradeTab = t;
    render();
  }

  function contentHtml(exam) {
    const tab = App.state.gradeTab;
    let html = `<div class="sub-tabs">
      <button class="tab ${tab === 'scores' ? 'active' : ''}" onclick="Grades.setTab('scores')">成绩录入</button>
      <button class="tab ${tab === 'paper' ? 'active' : ''}" onclick="Grades.setTab('paper')">试卷题目</button>
      <button class="tab ${tab === 'stats' ? 'active' : ''}" onclick="Grades.setTab('stats')">逐题统计</button>
    </div>
    <div id="gradeTabBody">`;
    if (tab === 'scores') html += scoreGridHtml(exam);
    else if (tab === 'paper') html += paperHtml(exam);
    else if (tab === 'stats') html += statsHtml(exam);
    html += '</div>';
    return html;
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
    const name = val('f_ename').trim();
    if (!name) return App.toast('请填写考试名称', 'error');
    const subs = Store.listSubjects()
      .map((s, i) => ({ name: s.name, checked: document.getElementById('esub_' + i) && document.getElementById('esub_' + i).checked }))
      .filter(x => x.checked)
      .map(x => x.name);
    if (!subs.length) return App.toast('请至少选择一个科目', 'error');
    const info = { name, date: val('f_edate') || today(), type: val('f_etype') || '月考', subjects: subs };
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
    if (confirm('确定删除考试「' + e.name + '」及其全部成绩、试卷题目记录吗？')) {
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

  /* ---------- 试卷题目 ---------- */
  const Q_TYPES = ['选择', '填空', '判断', '解答', '阅读', '写作', '实验', '其他'];

  function paperHtml(exam) {
    const qs = Store.getQuestions(exam.id);
    const subs = exam.subjects;
    let html = `<div class="grid-head">
        <h3>试卷题目（${qs.length} 题）</h3>
        <button class="btn btn-xs btn-danger" onclick="Grades.clearQuestions('${exam.id}')">清空全部题目</button>
      </div>
      <div class="paper-add">
        <div class="form-row">
          <select id="pq_subject" class="select" style="width:110px">${subs.map(n => `<option>${esc(n)}</option>`).join('')}</select>
          <select id="pq_type" class="select" style="width:96px">${Q_TYPES.map(t => `<option>${t}</option>`).join('')}</select>
          <input id="pq_title" class="input" style="flex:1;min-width:200px" placeholder="题目内容（题干）">
          <input id="pq_score" type="number" class="input" style="width:76px" placeholder="分值" min="0">
          <button class="btn btn-primary" onclick="Grades.addQuestion('${exam.id}')">添加题目</button>
        </div>
        <div class="field" style="margin-top:10px">
          <label class="muted small">批量导入：每行一条，格式「科目|题型|分值|题干」<br>例如：<code>数学|解答|12|已知函数 f(x)=x³-3x，求 f(x) 的单调区间</code>　（也可简写「科目|题干」）</label>
          <textarea id="pq_bulk" class="input" rows="3" placeholder="数学|解答|12|题目内容……&#10;语文|选择|3|题目内容……"></textarea>
          <div style="margin-top:6px">
            <button class="btn btn-xs" onclick="Grades.importQuestions('${exam.id}')">导入题目</button>
            <span class="muted small">（追加到现有题目；科目若不在本次考试科目中，自动归入第一个科目）</span>
          </div>
        </div>
      </div>`;
    if (!qs.length) {
      html += '<div class="empty small">暂无题目，请在上方添加或批量导入</div>';
    } else {
      html += `<div class="table-scroll"><table class="table">
        <thead><tr><th>#</th><th>科目</th><th>题型</th><th>分值</th><th>题干</th><th style="width:70px">操作</th></tr></thead><tbody>`;
      qs.forEach((q, i) => {
        html += `<tr><td>${i + 1}</td><td>${esc(q.subject)}</td><td>${esc(q.type)}</td><td>${q.score}</td>
          <td title="${escA(q.title)}">${esc(truncate(q.title, 42))}</td>
          <td><button class="btn btn-xs btn-danger" onclick="Grades.delQuestion('${exam.id}','${q.id}')">删除</button></td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    return html;
  }

  function addQuestion(eid) {
    const title = val('pq_title').trim();
    if (!title) return App.toast('请填写题目内容', 'error');
    const exam = Store.getExam(eid);
    const subject = val('pq_subject') || (exam && exam.subjects[0]) || '';
    const type = val('pq_type') || '其他';
    const score = Number(val('pq_score')) || 0;
    Store.addQuestion(eid, { subject, type, title, score });
    App.toast('已添加题目');
    render();
  }

  function importQuestions(eid) {
    const exam = Store.getExam(eid);
    if (!exam) return;
    const lines = val('pq_bulk').split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) return App.toast('请先粘贴题目内容', 'error');
    const subs = exam.subjects;
    let added = 0, skipped = 0;
    lines.forEach(line => {
      const parts = line.split('|').map(x => x.trim());
      const subject = subs.includes(parts[0]) ? parts[0] : (subs[0] || '');
      let type = '其他', score = 0, si = 1;
      if (parts.length >= 3 && Q_TYPES.includes(parts[1]) && !isNaN(Number(parts[2]))) {
        type = parts[1]; score = Number(parts[2]); si = 3;
      } else if (parts.length >= 2 && Q_TYPES.includes(parts[1])) {
        type = parts[1]; si = 2;
      }
      const title = parts.slice(si).join('|');
      if (!title) { skipped++; return; }
      Store.addQuestion(eid, { subject, type, title, score });
      added++;
    });
    App.toast('导入完成：新增 ' + added + ' 题' + (skipped ? '，跳过 ' + skipped + ' 行（格式不符）' : ''));
    render();
  }

  function delQuestion(eid, qid) {
    Store.deleteQuestion(eid, qid);
    App.toast('已删除题目');
    render();
  }
  function clearQuestions(eid) {
    if (!confirm('确定清空该考试的全部题目与逐题统计记录吗？')) return;
    Store.clearQuestions(eid);
    App.toast('已清空');
    render();
  }

  /* ---------- 逐题统计 ---------- */
  function setStatSubject(eid, v) {
    App.state.statSubject = v;
    render();
  }

  function statsHtml(exam) {
    const qs = Store.getQuestions(exam.id);
    if (!qs.length) return '<div class="empty">该考试还没有题目，请先到「试卷题目」页签添加或批量导入题目</div>';
    const subs = Array.from(new Set(qs.map(q => q.subject)));
    const filter = App.state.statSubject && subs.includes(App.state.statSubject) ? App.state.statSubject : '';
    const list = filter ? qs.filter(q => q.subject === filter) : qs;
    const students = Store.listStudents();

    let html = `<div class="grid-head">
        <h3>逐题统计（${list.length} 题${filter ? ' · ' + esc(filter) : ''}）</h3>
        <select class="select" style="width:160px" onchange="Grades.setStatSubject('${exam.id}', this.value)">
          <option value="">全部科目</option>
          ${subs.map(s => `<option value="${escA(s)}" ${s === filter ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </div>
      <p class="muted small" style="margin-bottom:12px">点击单元格循环切换：<b>未答</b> → <span style="color:#1a9d55">✓ 正确</span> → <span style="color:#e5484d">✗ 错误</span> → <b>未答</b></p>
      <div class="chart-box" style="margin-bottom:14px"><h4>每题正确率 / 错误率（%）</h4><div id="statBar"></div></div>
      <div class="chart-box" style="margin-bottom:14px"><h4>总体统计（所选题目汇总）</h4><div id="statPie"></div></div>
      <div class="table-scroll"><table class="table q-table">
        <thead><tr><th style="min-width:88px">学生</th>`;
    list.forEach((q, i) => {
      const st = Store.qStats(exam.id, q.id);
      const rateCls = st.rightRate >= 70 ? 'q-rate-good' : st.rightRate < 50 ? 'q-rate-bad' : '';
      html += `<th class="q-th"><div title="${escA(q.title)}">Q${i + 1}<div class="muted small">${esc(q.subject)} ${q.score}分</div></div>
        <div class="${rateCls}" id="qrate_${q.id}">${st.rightRate}%</div>
        <div class="muted small">对${st.right}/错${st.wrong}/未${st.none}</div></th>`;
    });
    html += `</tr></thead><tbody>`;
    if (!students.length) {
      html += '<tr><td colspan="' + (list.length + 1) + '" class="empty small">暂无学生</td></tr>';
    }
    students.forEach(s => {
      html += `<tr><td class="stu-name">${esc(s.name)}</td>`;
      list.forEach(q => {
        const v = Store.getQResult(exam.id, q.id, s.id);
        const cls = v === 1 ? 'q-ok' : v === 0 ? 'q-no' : 'q-none';
        const txt = v === 1 ? '✓' : v === 0 ? '✗' : '';
        html += `<td><button class="qcell ${cls}" data-eid="${exam.id}" data-qid="${q.id}" data-sid="${s.id}"
          onclick="Grades.toggleQ(event)" title="${escA(q.title)}">${txt}</button></td>`;
      });
      html += `</tr>`;
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderStatsCharts(exam) {
    const qs = Store.getQuestions(exam.id);
    const subs = Array.from(new Set(qs.map(q => q.subject)));
    const filter = App.state.statSubject && subs.includes(App.state.statSubject) ? App.state.statSubject : '';
    const list = filter ? qs.filter(q => q.subject === filter) : qs;
    const C = Charts.COLORS;

    const barEl = document.getElementById('statBar');
    if (barEl) {
      Charts.barChart(barEl, {
        labels: list.map((q, i) => 'Q' + (i + 1)),
        series: [
          { name: '正确率', color: '#59a14f', values: list.map(q => Store.qStats(exam.id, q.id).rightRate) },
          { name: '错误率', color: '#e15759', values: list.map(q => Store.qStats(exam.id, q.id).wrongRate) }
        ],
        yMax: 100
      });
    }
    const pieEl = document.getElementById('statPie');
    if (pieEl) {
      let right = 0, wrong = 0, none = 0;
      list.forEach(q => {
        const st = Store.qStats(exam.id, q.id);
        right += st.right; wrong += st.wrong; none += st.none;
      });
      Charts.pieChart(pieEl, {
        items: [
          { label: '正确', value: right, color: '#59a14f' },
          { label: '错误', value: wrong, color: '#e15759' },
          { label: '未答', value: none, color: '#c9cede' }
        ]
      });
    }
  }

  function toggleQ(evt) {
    const btn = evt.target;
    const eid = btn.dataset.eid, qid = btn.dataset.qid, sid = btn.dataset.sid;
    const cur = Store.getQResult(eid, qid, sid);
    const next = cur === null ? 1 : cur === 1 ? 0 : null;
    Store.setQResult(eid, qid, sid, next);
    btn.className = 'qcell ' + (next === 1 ? 'q-ok' : next === 0 ? 'q-no' : 'q-none');
    btn.textContent = next === 1 ? '✓' : next === 0 ? '✗' : '';
    const st = Store.qStats(eid, qid);
    const rateEl = document.getElementById('qrate_' + qid);
    if (rateEl) {
      rateEl.textContent = st.rightRate + '%';
      rateEl.className = st.rightRate >= 70 ? 'q-rate-good' : st.rightRate < 50 ? 'q-rate-bad' : '';
    }
    const exam = Store.getExam(eid);
    if (exam) renderStatsCharts(exam);
  }

  return { render, select, setTab, openExamForm, saveExam, delExam, onScoreInput, addQuestion, importQuestions, delQuestion, clearQuestions, setStatSubject, toggleQ };
})();
