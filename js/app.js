/* ============================================================
 * app.js — 应用外壳
 * 导航 / 总览（可交互模块 + 饼图百分比）/ 设置 / 弹窗 / 提示
 * ============================================================ */

/* ---------- 通用工具 ---------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escA(s) {
  return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const App = (function () {
  const state = {
    view: 'dashboard',
    selectedExam: null,
    studentsQuery: '',
    analysisExam: '',
    analysisStudent: '',
    dashDetail: null,      // 总览：当前展开的模块
    stuSel: {},            // 学生批量选择 {sid:true}
    gradeTab: 'scores',    // 成绩页子页签 scores|paper|stats
    statSubject: ''        // 逐题统计的科目筛选
  };
  let throttleTimer = null;

  /* ---------- 初始化 ---------- */
  function init() {
    Store.load();
    const firstRun = !Store.hasData() && !localStorage.getItem('homeroom_workbench_firstrun_done');
    document.querySelectorAll('#nav .nav-item').forEach(b => {
      b.addEventListener('click', () => {
        state.view = b.dataset.view;
        renderView();
      });
    });
    renderView();
    if (firstRun) showWelcome();
    window.addEventListener('resize', debounce(renderView, 300));
  }

  function debounce(fn, ms) {
    let tm;
    return function () { clearTimeout(tm); tm = setTimeout(fn, ms); };
  }

  function throttleRender() {
    clearTimeout(throttleTimer);
    throttleTimer = setTimeout(renderView, 250);
  }

  /* ---------- 视图 ---------- */
  function setViewHtml(html) {
    document.getElementById('view').innerHTML = html;
  }

  function resetClassState() {
    state.selectedExam = null;
    state.analysisExam = '';
    state.analysisStudent = '';
    state.studentsQuery = '';
    state.stuSel = {};
    state.dashDetail = null;
    state.gradeTab = 'scores';
    state.statSubject = '';
  }

  function switchClass(id) {
    if (!Store.setCurrentClass(id)) return;
    resetClassState();
    renderView();
    toast('已切换到「' + Store.className() + '」');
  }

  function renderView() {
    document.querySelectorAll('#nav .nav-item').forEach(b =>
      b.classList.toggle('active', b.dataset.view === state.view));
    const sel = document.getElementById('classSelect');
    if (sel) {
      sel.innerHTML = Store.listClasses().map(c =>
        `<option value="${c.id}" ${c.id === Store.currentClassId() ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    }
    if (state.view === 'dashboard') Dashboard.render();
    else if (state.view === 'students') Students.render();
    else if (state.view === 'grades') Grades.render();
    else if (state.view === 'analysis') Analysis.render();
    else if (state.view === 'settings') Settings.render();
  }

  /* ---------- 弹窗 / 提示 ---------- */
  function openModal(html, cls) {
    document.getElementById('modal-root').innerHTML =
      `<div class="modal-mask" id="modal" onclick="if(event.target===this)App.closeModal()"><div class="modal ${cls || ''}">${html}</div></div>`;
  }
  function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

  function toast(msg, type) {
    const root = document.getElementById('toast-root');
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'error' ? 'error' : 'ok');
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 2600);
  }

  function openStudentDetail(sid) { Students.openDetail(sid); }

  /* ---------- 欢迎引导 ---------- */
  function showWelcome() {
    localStorage.setItem('homeroom_workbench_firstrun_done', '1');
    openModal(`
      <div class="modal-head"><h3>欢迎使用班主任工作台 🎉</h3></div>
      <div class="modal-body">
        <p>这是一个为高中班主任设计的班级管理工具：</p>
        <ul class="intro">
          <li><b>多班级管理</b>：支持多个班级，左侧一键切换</li>
          <li>为每位学生独立建档：基本信息、学科情况、生活情况、成长记录</li>
          <li>成绩管理：历次考试成绩、试卷题目与逐题正确率/错误率统计</li>
          <li>数据可视化：趋势图、雷达图、饼图（百分比）一应俱全</li>
        </ul>
        <p class="muted small">所有数据仅保存在当前浏览器（localStorage），可在「设置」中导出 JSON 备份。</p>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="App.loadDemo()">载入示例数据体验</button>
        <button class="btn btn-primary" onclick="App.closeModal()">空白开始</button>
      </div>`);
  }

  function loadDemo() {
    Store.seedDemo();
    closeModal();
    resetClassState();
    renderView();
    toast('已载入示例数据');
  }

  /* ============================================================
   * 总览
   * ============================================================ */
  function distBins(ranks, fullSum) {
    const bins = { '优秀 (≥85%)': 0, '良好 (70–85%)': 0, '及格 (60–70%)': 0, '不及格 (<60%)': 0 };
    ranks.forEach(r => {
      const p = r.total / fullSum;
      if (p >= 0.85) bins['优秀 (≥85%)']++;
      else if (p >= 0.7) bins['良好 (70–85%)']++;
      else if (p >= 0.6) bins['及格 (60–70%)']++;
      else bins['不及格 (<60%)']++;
    });
    return Object.keys(bins).map(k => ({ label: k, count: bins[k] }));
  }

  function statCard(key, ico, label, value, sub) {
    const active = state.dashDetail === key;
    return `<div class="stat-card clickable ${active ? 'active' : ''}" onclick="App.Dashboard.card('${key}')">
      <div class="stat-ico">${ico}</div>
      <div style="flex:1;min-width:0">
        <div class="stat-val">${esc(value)}</div>
        <div class="stat-label">${esc(label)}${sub ? '<span class="stat-sub"> · ' + esc(sub) + '</span>' : ''}</div>
      </div>
      <span class="stat-more">${active ? '▾' : '▸'}</span>
    </div>`;
  }

  function chips(list) {
    return list.length
      ? list.map(s => `<span class="chip" onclick="App.openStudentDetail('${s.id}')">${esc(s.name)}</span>`).join('')
      : '<span class="muted small">无</span>';
  }

  const Dashboard = {
    card(key) {
      state.dashDetail = state.dashDetail === key ? null : key;
      Dashboard.render();
    },
    render() {
      const students = Store.listStudents();
      const exams = Store.listExams();
      const lastExam = exams[exams.length - 1] || null;
      const avgs = lastExam ? Store.classAvg(lastExam.id) : null;
      const males = students.filter(s => s.gender === '男');
      const females = students.filter(s => s.gender === '女');
      const ranks = lastExam ? Store.examRankings(lastExam.id) : [];
      const fullSum = lastExam ? Store.examFullSum(lastExam) : 0;
      const pass = ranks.filter(r => r.total >= fullSum * 0.6).length;
      const good = ranks.filter(r => r.total >= fullSum * 0.85).length;
      const passRate = ranks.length ? Math.round(pass / ranks.length * 1000) / 10 : 0;
      const goodRate = ranks.length ? Math.round(good / ranks.length * 1000) / 10 : 0;
      const avgRate = avgs && avgs._overall != null && fullSum ? Math.round(avgs._overall / fullSum * 1000) / 10 : 0;
      const dd = state.dashDetail;
      const C = Charts.COLORS;

      let html = `<div class="page-head"><h2>总览 <span class="muted small">${esc(Store.className())}</span></h2></div>
        <div class="stat-grid">
          ${statCard('students', '👥', '学生人数', students.length, `男 ${males.length} · 女 ${females.length}`)}
          ${statCard('males', '👦', '男生', males.length, '点击查看名单')}
          ${statCard('females', '👧', '女生', females.length, '点击查看名单')}
          ${statCard('exams', '📝', '考试次数', exams.length, '点击查看明细')}
          ${statCard('latest', '📅', '最近考试', lastExam ? esc(lastExam.name) : '—', lastExam ? esc(lastExam.date) : '')}
          ${statCard('avg', '🎯', '最近平均分', avgs && avgs._overall != null ? avgs._overall : '—', fullSum ? `满分率 ${avgRate}%` : '')}
          ${statCard('dist', '✅', '及格率', passRate + '%', ranks.length ? `及格 ${pass}/${ranks.length}` : '')}
          ${statCard('dist', '⭐', '优秀率', goodRate + '%', ranks.length ? `优秀 ${good}/${ranks.length}` : '')}
        </div>`;

      if (!students.length) {
        html += `<div class="card empty">暂无学生数据。请先在「学生管理」中建档，或在「设置」中一键载入示例数据体验全部功能。</div>`;
        App.setViewHtml(html);
        return;
      }
      if (!exams.length) {
        html += `<div class="card empty">暂无考试数据。请先在「成绩管理」新建考试并录入成绩，即可在这里看到可视化分析。</div>`;
        App.setViewHtml(html);
        return;
      }

      /* ----- 点击模块后展开的详情面板 ----- */
      if (dd) {
        let detail = '';
        if (dd === 'students' || dd === 'males' || dd === 'females') {
          detail = `<div class="detail-grid">
            <div class="chart-box"><h4>性别比例</h4><div id="ddPie"></div></div>
            <div class="chart-box"><h4>${dd === 'males' ? '男生名单' : dd === 'females' ? '女生名单' : '男女生名单'}</h4>
              <div class="name-lists">
                <div><div class="muted small" style="margin-bottom:6px">男生（${males.length}）</div><div class="name-chips">${chips(males)}</div></div>
                <div><div class="muted small" style="margin-bottom:6px">女生（${females.length}）</div><div class="name-chips">${chips(females)}</div></div>
              </div>
            </div>
          </div>`;
        } else if (dd === 'exams') {
          detail = examsDetail(exams);
        } else if (dd === 'latest') {
          detail = latestDetail(lastExam, ranks);
        } else if (dd === 'avg') {
          detail = avgDetail(lastExam, avgs);
        } else if (dd === 'dist') {
          const bins = distBins(ranks, fullSum);
          detail = `<div class="detail-grid">
            <div class="chart-box"><h4>总分分布（百分比）</h4><div id="ddDistPie"></div></div>
            <div class="chart-box"><h4>各档人数</h4>
              <table class="table"><thead><tr><th>档位</th><th>人数</th><th>占比</th></tr></thead><tbody>
                ${bins.map(b => `<tr><td>${b.label}</td><td>${b.count}</td><td>${ranks.length ? Math.round(b.count / ranks.length * 1000) / 10 + '%' : '—'}</td></tr>`).join('')}
              </tbody></table>
            </div>
          </div>`;
        }
        if (detail) html += `<div class="card dash-detail">${detail}</div>`;
      }

      /* ----- 图表区 ----- */
      html += `<div class="card chart-grid">
        <div class="chart-box span-all"><h4>班级平均分趋势（全部科目）</h4><div id="dashTrend"></div></div>
        <div class="chart-box"><h4>最近考试各科平均分（占满分百分比）</h4><div id="dashBar"></div></div>
        <div class="chart-box"><h4>性别比例</h4><div id="dashPieGender"></div></div>
        <div class="chart-box"><h4>最近考试总分分布</h4><div id="dashPieDist"></div></div>
        <div class="chart-box"><h4>最近考试前十名</h4><div id="dashTop"></div></div>
      </div>`;

      const weak = ranks.filter(r => r.total < fullSum * 0.6);
      if (weak.length) {
        html += `<div class="card"><h4>⚠️ 需要关注（最近考试总分低于满分 60%）</h4>
          <div class="name-chips">${weak.map(r => `<span class="chip chip-warn" onclick="App.openStudentDetail('${r.student.id}')">${esc(r.student.name)}（${r.total}分）</span>`).join('')}</div></div>`;
      }

      App.setViewHtml(html);

      /* 趋势 */
      const lastN = exams.slice(-6);
      Charts.lineChart(document.getElementById('dashTrend'), {
        labels: lastN.map(e => e.name),
        series: Store.listSubjects().map((sub, si) => ({
          name: sub.name,
          color: C[si % C.length],
          values: lastN.map(e => {
            const a = Store.classAvg(e.id);
            return a[sub.name] != null ? a[sub.name] : null;
          })
        }))
      });
      /* 平均分柱状图（百分比标注） */
      Charts.barChart(document.getElementById('dashBar'), {
        labels: lastExam.subjects,
        series: [{ name: '班级平均', color: C[1], values: lastExam.subjects.map(n => avgs[n] != null ? avgs[n] : null) }],
        yMax: Math.max.apply(null, lastExam.subjects.map(n => Store.fullOf(n))),
        showPercent: true
      });
      /* 性别饼图 */
      Charts.pieChart(document.getElementById('dashPieGender'), {
        items: [
          { label: '男生', value: males.length, color: C[0] },
          { label: '女生', value: females.length, color: C[3] }
        ]
      });
      /* 总分分布饼图 */
      const bins = distBins(ranks, fullSum);
      Charts.pieChart(document.getElementById('dashPieDist'), {
        items: bins.map((b, i) => ({ label: b.label, value: b.count, color: [C[2], C[1], C[6], C[3]][i] }))
      });
      /* 前十名 */
      const top = ranks.slice(0, 10);
      document.getElementById('dashTop').innerHTML = top.length
        ? `<ol class="rank-list">${top.map(r => `<li><span>${esc(r.student.name)}</span><b>${r.total}分</b></li>`).join('')}</ol>`
        : '<div class="chart-empty">暂无成绩</div>';

      /* 详情面板内图表 */
      if (dd === 'students' || dd === 'males' || dd === 'females') {
        Charts.pieChart(document.getElementById('ddPie'), {
          items: [
            { label: '男生', value: males.length, color: C[0] },
            { label: '女生', value: females.length, color: C[3] }
          ]
        });
      }
      if (dd === 'dist') {
        Charts.pieChart(document.getElementById('ddDistPie'), {
          items: bins.map((b, i) => ({ label: b.label, value: b.count, color: [C[2], C[1], C[6], C[3]][i] }))
        });
      }
    }
  };

  function examsDetail(exams) {
    let rows = exams.map(e => {
      const av = Store.classAvg(e.id);
      const rs = Store.examRankings(e.id);
      const fs = Store.examFullSum(e);
      const pass = rs.filter(r => r.total >= fs * 0.6).length;
      const good = rs.filter(r => r.total >= fs * 0.85).length;
      return `<tr>
        <td>${esc(e.name)}</td><td>${esc(e.date)}</td><td>${esc(e.type)}</td>
        <td>${rs.length}</td>
        <td>${av._overall != null ? av._overall : '—'}</td>
        <td>${rs.length ? Math.round(pass / rs.length * 1000) / 10 + '%' : '—'}</td>
        <td>${rs.length ? Math.round(good / rs.length * 1000) / 10 + '%' : '—'}</td>
      </tr>`;
    }).join('');
    if (!exams.length) rows = '<tr><td colspan="7" class="empty small">暂无考试</td></tr>';
    return `<h4>历次考试明细</h4>
      <div class="table-scroll"><table class="table">
        <thead><tr><th>考试</th><th>日期</th><th>类型</th><th>参考人数</th><th>平均分</th><th>及格率</th><th>优秀率</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  }

  function latestDetail(lastExam, ranks) {
    if (!lastExam) return '<h4>最近考试</h4><div class="muted">暂无考试数据</div>';
    const top = ranks.slice(0, 5);
    const bottom = ranks.slice(-5).reverse();
    return `<h4>最近考试：${esc(lastExam.name)}（${esc(lastExam.date)} · ${esc(lastExam.type)}）</h4>
      <div class="detail-grid">
        <div>
          <div class="muted small" style="margin-bottom:6px">前五名</div>
          <ol class="rank-list">${top.map(r => `<li><span>${esc(r.student.name)}</span><b>${r.total}分</b></li>`).join('') || '<div class="muted small">暂无</div>'}</ol>
        </div>
        <div>
          <div class="muted small" style="margin-bottom:6px">后五名（需关注）</div>
          <ol class="rank-list">${bottom.map(r => `<li><span>${esc(r.student.name)}</span><b>${r.total}分</b></li>`).join('') || '<div class="muted small">暂无</div>'}</ol>
        </div>
      </div>`;
  }

  function avgDetail(lastExam, avgs) {
    if (!lastExam) return '<h4>各科平均分</h4><div class="muted">暂无考试数据</div>';
    const rows = lastExam.subjects.map(n => {
      const a = avgs[n];
      const f = Store.fullOf(n);
      const pct = a != null && f ? Math.round(a / f * 1000) / 10 : 0;
      return `<tr>
        <td>${esc(n)}</td><td>${a != null ? a : '—'}</td><td>${f}</td>
        <td style="min-width:160px"><div class="pbar"><div class="pbar-fill" style="width:${Math.min(100, pct)}%"></div></div></td>
        <td>${a != null ? pct + '%' : '—'}</td>
      </tr>`;
    }).join('');
    return `<h4>各科平均分与满分占比</h4>
      <div class="table-scroll"><table class="table">
        <thead><tr><th>科目</th><th>平均分</th><th>满分</th><th>占比</th><th>百分比</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  }

  /* ============================================================
   * 设置
   * ============================================================ */
  const Settings = {
    render() {
      let html = `<div class="page-head"><h2>设置</h2></div>`;

      /* 班级管理 */
      html += `<div class="card">
        <h3>班级管理</h3>
        <p class="muted small" style="margin-bottom:12px">可维护多个班级，通过左侧「当前班级」下拉框快速切换；每个班级拥有独立的学生、考试与成绩数据。</p>
        <div id="classRows">
          ${Store.listClasses().map((c, i) => `
            <div class="form-row class-row">
              <input class="input class-name" id="cls_n_${i}" value="${escA(c.name)}" style="max-width:220px">
              <button class="btn btn-xs ${Store.currentClassId() === c.id ? 'btn-primary' : ''}" onclick="App.Settings.switchClass('${c.id}')">${Store.currentClassId() === c.id ? '当前' : '切换'}</button>
              <button class="btn btn-xs" onclick="App.Settings.renameClass('${c.id}',${i})">保存名称</button>
              <button class="btn btn-xs btn-danger" onclick="App.Settings.delClass('${c.id}')">删除</button>
              <span class="muted small">学生 ${c.students.length} 人 · 考试 ${c.exams.length} 次</span>
            </div>`).join('')}
        </div>
        <button class="btn" onclick="App.Settings.addClass()">+ 新建班级</button>
      </div>`;

      /* 科目管理 */
      html += `<div class="card">
        <h3>科目管理（全局）</h3>
        <p class="muted small" style="margin-bottom:12px">满分用于成绩校验与图表刻度。修改科目名不影响历史成绩（按原科目名保存）；每个班级的考试可单独勾选科目；学生档案支持添加自定义学科。</p>
        <div id="subjRows">
          ${Store.listSubjects().map((s, i) => `
            <div class="form-row subj-row">
              <input class="input subj-name" id="subj_n_${i}" value="${escA(s.name)}">
              <span class="muted small">满分</span>
              <input type="number" class="input subj-full" id="subj_f_${i}" min="1" max="300" value="${s.full}">
              <button class="btn btn-xs btn-danger" onclick="App.Settings.delSubjRow(this)">删除</button>
            </div>`).join('')}
        </div>
        <div class="btn-row">
          <button class="btn" onclick="App.Settings.addSubjRow()">+ 添加科目</button>
          <button class="btn btn-primary" onclick="App.Settings.saveSubjects()">保存科目设置</button>
        </div>
      </div>`;

      /* 数据管理 */
      html += `<div class="card">
        <h3>数据管理</h3>
        <div class="btn-row">
          <button class="btn" onclick="App.Settings.exportData()">⬇ 导出数据（JSON 备份）</button>
          <label class="btn">⬆ 导入数据
            <input type="file" accept=".json,application/json" style="display:none" onchange="App.Settings.importData(event)">
          </label>
          <button class="btn" onclick="App.Settings.loadDemo()">载入示例数据</button>
          <button class="btn btn-danger" onclick="App.Settings.clearData()">清空全部数据</button>
        </div>
        <p class="muted small" style="margin-top:10px">所有数据保存在当前浏览器的 localStorage 中，请定期导出备份；换电脑或清缓存前务必先导出。</p>
      </div>`;

      App.setViewHtml(html);
    },

    addClass() {
      App.openModal(`
        <div class="modal-head"><h3>新建班级</h3><button class="modal-x" onclick="App.closeModal()">×</button></div>
        <div class="modal-body">
          <div class="field"><label>班级名称 *</label><input id="f_clsname" class="input" placeholder="如：高二(3)班"></div>
        </div>
        <div class="modal-foot">
          <button class="btn" onclick="App.closeModal()">取消</button>
          <button class="btn btn-primary" onclick="App.Settings.saveNewClass()">创建</button>
        </div>`);
      setTimeout(() => { const el = document.getElementById('f_clsname'); if (el) el.focus(); }, 60);
    },
    saveNewClass() {
      const el = document.getElementById('f_clsname');
      const name = el ? el.value.trim() : '';
      if (!name) return App.toast('请填写班级名称', 'error');
      Store.addClass(name);
      App.closeModal();
      App.resetClassState();
      App.renderView();
      App.toast('已创建并切换到「' + name + '」');
    },
    switchClass(id) {
      if (!Store.setCurrentClass(id)) return;
      App.resetClassState();
      App.renderView();
      App.toast('已切换到「' + Store.className() + '」');
    },
    renameClass(id, i) {
      const el = document.getElementById('cls_n_' + i);
      const name = el ? el.value.trim() : '';
      if (!name) return App.toast('班级名称不能为空', 'error');
      Store.renameClass(id, name);
      App.toast('班级名称已保存');
      App.renderView();
    },
    delClass(id) {
      const c = Store.getClass(id);
      if (!c) return;
      if (Store.listClasses().length <= 1) return App.toast('至少保留一个班级', 'error');
      if (!confirm('确定删除班级「' + c.name + '」吗？该班级的全部学生、考试、成绩数据将被删除！')) return;
      Store.deleteClass(id);
      App.resetClassState();
      App.toast('已删除班级');
      App.renderView();
    },

    addSubjRow() {
      const box = document.getElementById('subjRows');
      const n = box.children.length;
      const row = document.createElement('div');
      row.className = 'form-row subj-row';
      row.innerHTML = `
        <input class="input subj-name" id="subj_n_${n}" value="新科目">
        <span class="muted small">满分</span>
        <input type="number" class="input subj-full" id="subj_f_${n}" min="1" max="300" value="100">
        <button class="btn btn-xs btn-danger" onclick="App.Settings.delSubjRow(this)">删除</button>`;
      box.appendChild(row);
    },
    delSubjRow(btn) { btn.parentElement.remove(); },
    saveSubjects() {
      const box = document.getElementById('subjRows');
      const list = [];
      const seen = {};
      let ok = true;
      Array.from(box.children).forEach(row => {
        const name = row.querySelector('.subj-name').value.trim();
        const full = Number(row.querySelector('.subj-full').value) || 100;
        if (!name) { ok = false; App.toast('科目名称不能为空', 'error'); return; }
        if (seen[name]) { ok = false; App.toast('科目名称重复：「' + name + '」', 'error'); return; }
        seen[name] = true;
        list.push({ name, full });
      });
      if (!ok || !list.length) return;
      Store.setSubjects(list);
      App.toast('科目设置已保存');
      App.renderView();
    },

    exportData() {
      const blob = new Blob([JSON.stringify(Store.raw(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '班主任工作台备份_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      App.toast('已导出备份文件');
    },
    importData(evt) {
      const file = evt.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const d = JSON.parse(reader.result);
          if (!d || !Array.isArray(d.students) && !Array.isArray(d.classes)) throw new Error('文件格式不正确');
          Store.replace(d);
          App.resetClassState();
          App.toast('导入成功');
          App.renderView();
        } catch (e) {
          App.toast('导入失败：' + e.message, 'error');
        }
      };
      reader.readAsText(file);
      evt.target.value = '';
    },
    loadDemo() {
      if (Store.hasData() && !confirm('载入示例数据将覆盖当前全部数据，确定继续吗？')) return;
      Store.seedDemo();
      App.resetClassState();
      App.toast('已载入示例数据');
      App.renderView();
    },
    clearData() {
      if (!confirm('确定清空全部数据吗？此操作不可恢复，建议先导出备份！')) return;
      Store.reset();
      App.resetClassState();
      App.toast('已清空全部数据');
      App.renderView();
    }
  };

  return {
    state, init, renderView, setViewHtml, openModal, closeModal, toast, throttleRender,
    loadDemo, switchClass, resetClassState, openStudentDetail,
    Dashboard, Settings
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
