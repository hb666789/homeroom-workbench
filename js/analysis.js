/* ============================================================
 * analysis.js — 数据分析
 * 班级整体：各科平均分柱状图 / 总分分布 / 历次考试趋势
 * 学生个人：各科趋势 / 排名趋势 / 与班级平均对比雷达图
 * ============================================================ */
const Analysis = (function () {
  function render() {
    const exams = Store.listExams();
    const students = Store.listStudents();
    const lastExam = exams[exams.length - 1] || null;

    const selExam = lastExam && App.state.analysisExam && Store.getExam(App.state.analysisExam)
      ? App.state.analysisExam
      : (lastExam ? lastExam.id : '');
    const selStu = students.length
      ? (App.state.analysisStudent && Store.getStudent(App.state.analysisStudent) ? App.state.analysisStudent : students[0].id)
      : '';

    let html = `<div class="page-head"><h2>数据分析</h2></div>`;

    /* ----- 班级整体 ----- */
    html += `<div class="card chart-grid">
      <div class="span-all grid-head-row">
        <h3>班级整体分析</h3>
        <select class="select" onchange="Analysis.setExam(this.value)">
          ${exams.map(e => `<option value="${e.id}" ${e.id === selExam ? 'selected' : ''}>${esc(e.name)}（${esc(e.date)}）</option>`).join('')}
        </select>
      </div>`;
    if (selExam) {
      const exam = Store.getExam(selExam);
      html += `<div class="chart-box"><h4>各科班级平均分（${esc(exam.name)}）</h4><div id="clsBar"></div></div>`;
      html += `<div class="chart-box"><h4>总分分布（按满分百分比）</h4><div id="clsDist"></div></div>`;
      html += `<div class="chart-box span-all"><h4>历次考试班级平均分趋势</h4><div id="clsTrend"></div></div>`;
    } else {
      html += `<div class="empty span-all">暂无考试数据，请先在「成绩管理」中新建考试并录入成绩</div>`;
    }
    html += `</div>`;

    /* ----- 学生个人 ----- */
    html += `<div class="card chart-grid">
      <div class="span-all grid-head-row">
        <h3>学生个人分析</h3>
        <select class="select" onchange="Analysis.setStudent(this.value)">
          ${students.map(s => `<option value="${s.id}" ${s.id === selStu ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
      </div>`;
    if (selStu) {
      html += `<div class="chart-box"><h4>各科成绩趋势</h4><div id="perTrend"></div></div>`;
      html += `<div class="chart-box"><h4>排名趋势（曲线越靠上排名越靠前）</h4><div id="perRank"></div></div>`;
      html += `<div class="chart-box span-all"><h4>最近考试：本人 vs 班级平均（雷达图）</h4><div id="perRadar"></div></div>`;
    } else {
      html += `<div class="empty span-all">暂无学生数据，请先在「学生管理」中建档</div>`;
    }
    html += `</div>`;

    App.setViewHtml(html);

    if (selExam) renderClassCharts(selExam);
    if (selStu) renderPerCharts(selStu);
  }

  function setExam(eid) { App.state.analysisExam = eid; render(); }
  function setStudent(sid) { App.state.analysisStudent = sid; render(); }

  /* ----- 班级图表 ----- */
  function renderClassCharts(eid) {
    const exam = Store.getExam(eid);
    const avgs = Store.classAvg(eid);
    const C = Charts.COLORS;

    const barEl = document.getElementById('clsBar');
    if (barEl) {
      Charts.barChart(barEl, {
        labels: exam.subjects,
        series: [{ name: '班级平均', color: C[1], values: exam.subjects.map(n => avgs[n] != null ? avgs[n] : null) }],
        yMax: Math.max.apply(null, exam.subjects.map(n => Store.fullOf(n)))
      });
    }

    const distEl = document.getElementById('clsDist');
    if (distEl) {
      const fullSum = Store.examFullSum(exam);
      const bins = { '优秀 (≥85%)': 0, '良好 (70–85%)': 0, '及格 (60–70%)': 0, '不及格 (<60%)': 0 };
      Store.examRankings(eid).forEach(r => {
        const p = r.total / fullSum;
        if (p >= 0.85) bins['优秀 (≥85%)']++;
        else if (p >= 0.7) bins['良好 (70–85%)']++;
        else if (p >= 0.6) bins['及格 (60–70%)']++;
        else bins['不及格 (<60%)']++;
      });
      Charts.histogram(distEl, {
        items: Object.keys(bins).map(k => ({ label: k, count: bins[k] })),
        color: C[0]
      });
    }

    const trendEl = document.getElementById('clsTrend');
    if (trendEl) {
      const exams = Store.listExams();
      Charts.lineChart(trendEl, {
        labels: exams.map(e => e.name),
        series: Store.listSubjects().map((sub, si) => ({
          name: sub.name,
          color: C[si % C.length],
          values: exams.map(e => Store.classAvg(e.id)[sub.name] != null ? Store.classAvg(e.id)[sub.name] : null)
        }))
      });
    }
  }

  /* ----- 个人图表 ----- */
  function renderPerCharts(sid) {
    const s = Store.getStudent(sid);
    if (!s) return;
    const exams = Store.listExams();
    const subj = Store.listSubjects();
    const C = Charts.COLORS;

    const trendEl = document.getElementById('perTrend');
    if (trendEl) {
      Charts.lineChart(trendEl, {
        labels: exams.map(e => e.name),
        series: subj.map((sb, si) => ({
          name: sb.name,
          color: C[si % C.length],
          values: exams.map(e => Store.getScore(s.id, e.id, sb.name))
        }))
      });
    }

    const rankEl = document.getElementById('perRank');
    if (rankEl) {
      Charts.lineChart(rankEl, {
        labels: exams.map(e => e.name),
        series: [{ name: '排名', color: C[3], values: exams.map(e => {
          const r = Store.examRankings(e.id).find(x => x.student.id === s.id);
          return r ? r.rank : null;
        }) }],
        invert: true, yMin: 0, yMax: Store.listStudents().length + 1
      });
    }

    const radarEl = document.getElementById('perRadar');
    if (radarEl) {
      const exam = exams[exams.length - 1];
      if (!exam) {
        radarEl.innerHTML = '<div class="chart-empty">暂无考试数据</div>';
      } else {
        const avgs = Store.classAvg(exam.id);
        Charts.radarChart(radarEl, {
          labels: exam.subjects,
          series: [
            {
              name: s.name, color: C[3],
              values: exam.subjects.map(n => Store.getScore(s.id, exam.id, n) || 0),
              maxValues: exam.subjects.map(n => Store.fullOf(n))
            },
            {
              name: '班级平均', color: C[0],
              values: exam.subjects.map(n => (avgs[n] != null ? avgs[n] : 0)),
              maxValues: exam.subjects.map(n => Store.fullOf(n))
            }
          ]
        });
      }
    }
  }

  return { render, setExam, setStudent };
})();
