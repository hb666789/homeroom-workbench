/* ============================================================
 * app.js — 应用外壳
 * 导航 / 总览 / 设置 / 弹窗 / 提示 / 欢迎引导
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
    analysisStudent: ''
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

  function renderView() {
    document.querySelectorAll('#nav .nav-item').forEach(b =>
      b.classList.toggle('active', b.dataset.view === state.view));
    document.getElementById('brandClass').textContent = Store.className() || '未设置班级';
    if (state.view === 'dashboard') Dashboard.render();
    else if (state.view === 'students') Students.render();
    else if (state.view === 'grades') Grades.render();
    else if (state.view === 'analysis') Analysis.render();
    else if (state.view === 'settings') Settings.render();
  }

  /* ---------- 弹窗 / 提示 ---------- */
  function openModal(html) {
    document.getElementById('modal-root').innerHTML =
      `<div class="modal-mask" id="modal" onclick="if(event.target===this)App.closeModal()"><div class="modal">${html}</div></div>`;
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

  /* ---------- 欢迎引导 ---------- */
  function showWelcome() {
    localStorage.setItem('homeroom_workbench_firstrun_done', '1');
    openModal(`
      <div class="modal-head"><h3>欢迎使用班主任工作台 🎉</h3></div>
      <div class="modal-body">
        <p>这是一个为高中班主任设计的班级管理工具：</p>
        <ul class="intro">
          <li>为每位学生独立建档：基本信息、学科情况、生活情况、成长记录</li>
          <li>管理历次考试成绩，自动计算总分、排名、班级平均分</li>
          <li>成绩可视化：趋势图、雷达图、分布图一应俱全</li>
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
    renderView();
    toast('已载入示例数据');
  }

  /* ============================================================
   * 总览
   * ============================================================ */
  const Dashboard = {
    render() {
      const students = Store.listStudents();
      const exams = Store.listExams();
      const lastExam = exams[exams.length - 1] || null;
      const avgs = lastExam ? Store.classAvg(lastExam.id) : null;
      const males = students.filter(s => s.gender === '男').length;
      const females = students.filter(s => s.gender === '女').length;
      const weakCount = lastExam
        ? Store.examRankings(lastExam.id).filter(r => r.total < Store.examFullSum(lastExam) * 0.6).length
        : 0;

      let html = `<div class="page-head"><h2>总览</h2></div>
        <div class="stat-grid">
          ${statCard('👥', '学生人数', students.length)}
          ${statCard('👦', '男生', males)}
          ${statCard('👧', '女生', females)}
          ${statCard('📝', '考试次数', exams.length)}
          ${statCard('📅', '最近考试', lastExam ? lastExam.name : '—')}
          ${statCard('🎯', '最近平均分', avgs && avgs._overall != null ? avgs._overall : '—')}
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

      html += `<div class="card chart-grid">
        <div class="chart-box span-all"><h4>班级平均分趋势（全部科目）</h4><div id="dashTrend"></div></div>
        <div class="chart-box"><h4>最近考试各科平均分</h4><div id="dashBar"></div></div>
        <div class="chart-box"><h4>最近考试总分分布</h4><div id="dashDist"></div></div>
        <div class="chart-box span-all"><h4>最近考试前十名</h4><div id="dashTop"></div></div>
      </div>`;
      if (weakCount > 0) {
        html += `<div class="card"><h4>⚠️ 需要关注</h4>
          <p class="muted small">最近一次考试总分低于满分 60% 的学生共 ${weakCount} 人，可在「学生管理」中查看对应档案，了解其学科与生活情况。</p></div>`;
      }
      App.setViewHtml(html);

      const C = Charts.COLORS;
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

      Charts.barChart(document.getElementById('dashBar'), {
        labels: lastExam.subjects,
        series: [{ name: '班级平均', color: C[1], values: lastExam.subjects.map(n => avgs[n] != null ? avgs[n] : null) }],
        yMax: Math.max.apply(null, lastExam.subjects.map(n => Store.fullOf(n)))
      });

      const fullSum = Store.examFullSum(lastExam);
      const bins = { '优秀 (≥85%)': 0, '良好 (70–85%)': 0, '及格 (60–70%)': 0, '不及格 (<60%)': 0 };
      Store.examRankings(lastExam.id).forEach(r => {
        const p = r.total / fullSum;
        if (p >= 0.85) bins['优秀 (≥85%)']++;
        else if (p >= 0.7) bins['良好 (70–85%)']++;
        else if (p >= 0.6) bins['及格 (60–70%)']++;
        else bins['不及格 (<60%)']++;
      });
      Charts.histogram(document.getElementById('dashDist'), {
        items: Object.keys(bins).map(k => ({ label: k, count: bins[k] })),
        color: C[0]
      });

      const top = Store.examRankings(lastExam.id).slice(0, 10);
      document.getElementById('dashTop').innerHTML = top.length
        ? `<ol class="rank-list">${top.map(r => `<li><span>${esc(r.student.name)}</span><b>${r.total}分</b></li>`).join('')}</ol>`
        : '<div class="chart-empty">暂无成绩</div>';
    }
  };

  /* 辅助：统计卡片 */
  function statCard(ico, label, value) {
    return `<div class="stat-card"><div class="stat-ico">${ico}</div>
      <div><div class="stat-val">${esc(value)}</div><div class="stat-label">${esc(label)}</div></div></div>`;
  }

  /* ============================================================
   * 设置
   * ============================================================ */
  const Settings = {
    render() {
      let html = `<div class="page-head"><h2>设置</h2></div>`;

      html += `<div class="card">
        <h3>班级信息</h3>
        <div class="form-row">
          <label>班级名称</label>
          <input id="set_class" class="input" style="max-width:260px" value="${escA(Store.className())}">
        </div>
        <button class="btn btn-primary" onclick="Settings.saveClass()">保存班级名称</button>
      </div>`;

      html += `<div class="card">
        <h3>科目管理</h3>
        <p class="muted small" style="margin-bottom:12px">满分用于成绩校验与图表刻度。修改科目名不会影响已录入的历史成绩（历史成绩按原科目名保存），新考试将使用新科目列表。</p>
        <div id="subjRows">
          ${Store.listSubjects().map((s, i) => `
            <div class="form-row subj-row">
              <input class="input subj-name" id="subj_n_${i}" value="${escA(s.name)}">
              <span class="muted small">满分</span>
              <input type="number" class="input subj-full" id="subj_f_${i}" min="1" max="300" value="${s.full}">
              <button class="btn btn-xs btn-danger" onclick="Settings.delSubjRow(this)">删除</button>
            </div>`).join('')}
        </div>
        <div class="btn-row">
          <button class="btn" onclick="Settings.addSubjRow()">+ 添加科目</button>
          <button class="btn btn-primary" onclick="Settings.saveSubjects()">保存科目设置</button>
        </div>
      </div>`;

      html += `<div class="card">
        <h3>数据管理</h3>
        <div class="btn-row">
          <button class="btn" onclick="Settings.exportData()">⬇ 导出数据（JSON 备份）</button>
          <label class="btn">⬆ 导入数据
            <input type="file" accept=".json,application/json" style="display:none" onchange="Settings.importData(event)">
          </label>
          <button class="btn" onclick="Settings.loadDemo()">载入示例数据</button>
          <button class="btn btn-danger" onclick="Settings.clearData()">清空全部数据</button>
        </div>
        <p class="muted small" style="margin-top:10px">所有数据保存在当前浏览器的 localStorage 中，请定期导出备份；换电脑或清缓存前务必先导出。</p>
      </div>`;

      App.setViewHtml(html);
    },

    saveClass() {
      const v = document.getElementById('set_class').value.trim();
      if (!v) return App.toast('班级名称不能为空', 'error');
      Store.setClassName(v);
      App.toast('班级名称已保存');
      renderView();
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
        <button class="btn btn-xs btn-danger" onclick="Settings.delSubjRow(this)">删除</button>`;
      box.appendChild(row);
    },

    delSubjRow(btn) {
      btn.parentElement.remove();
    },

    saveSubjects() {
      const box = document.getElementById('subjRows');
      const list = [];
      const seen = {};
      let ok = true;
      Array.from(box.children).forEach((row, i) => {
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
      renderView();
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
          if (!d || !Array.isArray(d.students) || !Array.isArray(d.exams)) throw new Error('文件格式不正确');
          Store.replace(d);
          App.state.selectedExam = null;
          App.toast('导入成功');
          renderView();
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
      App.toast('已载入示例数据');
      renderView();
    },

    clearData() {
      if (!confirm('确定清空全部数据吗？此操作不可恢复，建议先导出备份！')) return;
      Store.reset();
      App.state.selectedExam = null;
      App.toast('已清空全部数据');
      renderView();
    }
  };

  return { state, init, renderView, setViewHtml, openModal, closeModal, toast, throttleRender, loadDemo };
})();

document.addEventListener('DOMContentLoaded', App.init);
