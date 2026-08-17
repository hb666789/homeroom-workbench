/* ============================================================
 * students.js — 学生管理
 * 列表 / 建档编辑 / 详情（基本信息、学科情况、生活情况、成长记录、成绩分析）
 * ============================================================ */
const Students = (function () {
  function val(id) {
    const e = document.getElementById(id);
    return e ? e.value : '';
  }

  /* ---------- 列表 ---------- */
  function render() {
    const q = (App.state.studentsQuery || '').toLowerCase();
    let list = Store.listStudents();
    list = list.filter(s =>
      !q || s.name.toLowerCase().includes(q) || String(s.studentNo).toLowerCase().includes(q)
    );
    const lastExam = Store.latestExam();
    const rankMap = {};
    if (lastExam) Store.examRankings(lastExam.id).forEach(r => { rankMap[r.student.id] = r; });
    const fullSum = lastExam ? Store.examFullSum(lastExam) : 0;

    let html = `
      <div class="page-head">
        <h2>学生管理</h2>
        <div class="page-actions">
          <input class="input search" placeholder="搜索姓名 / 学号" value="${escA(App.state.studentsQuery || '')}"
                 oninput="App.state.studentsQuery=this.value; App.throttleRender()">
          <button class="btn btn-primary" onclick="Students.openForm()">+ 新增学生</button>
        </div>
      </div>`;

    if (!list.length) {
      html += `<div class="card empty">${Store.listStudents().length ? '没有匹配的学生' : '还没有学生，点击右上角「新增学生」开始建档'}</div>`;
    } else {
      html += `<div class="card table-card">
        <table class="table">
          <thead><tr>
            <th>学号</th><th>姓名</th><th>性别</th><th>座位</th>
            <th>最近考试总分</th><th>排名</th><th>状态</th><th style="width:220px">操作</th>
          </tr></thead><tbody>`;
      list.forEach(s => {
        const r = rankMap[s.id];
        const total = r ? r.total : '—';
        const rank = r ? r.rank : '—';
        const weak = r && fullSum && r.total < fullSum * 0.6;
        html += `<tr>
          <td>${esc(s.studentNo) || '—'}</td>
          <td class="stu-name">${esc(s.name)}</td>
          <td>${esc(s.gender) || '—'}</td>
          <td>${esc(s.seat) || '—'}</td>
          <td>${total}</td>
          <td>${rank}</td>
          <td>${weak ? '<span class="badge badge-warn">关注</span>' : ''}</td>
          <td class="ops">
            <button class="btn btn-xs" onclick="Students.openDetail('${s.id}')">档案</button>
            <button class="btn btn-xs" onclick="Students.openForm('${s.id}')">编辑</button>
            <button class="btn btn-xs btn-danger" onclick="Students.delStudent('${s.id}')">删除</button>
          </td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    App.setViewHtml(html);
  }

  /* ---------- 新建 / 编辑 ---------- */
  function openForm(sid) {
    const s = sid ? Store.getStudent(sid) : null;
    App.openModal(`
      <div class="modal-head">
        <h3>${s ? '编辑学生' : '新增学生'}</h3>
        <button class="modal-x" onclick="App.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>姓名 *</label><input id="f_name" class="input" value="${escA(s ? s.name : '')}"></div>
          <div class="field"><label>学号</label><input id="f_no" class="input" value="${escA(s ? s.studentNo : '')}"></div>
          <div class="field"><label>性别</label>
            <select id="f_gender" class="select">
              <option value="">请选择</option>
              <option ${s && s.gender === '男' ? 'selected' : ''}>男</option>
              <option ${s && s.gender === '女' ? 'selected' : ''}>女</option>
            </select>
          </div>
          <div class="field"><label>座位号</label><input id="f_seat" class="input" value="${escA(s ? s.seat : '')}"></div>
          <div class="field"><label>生日</label><input id="f_birth" type="date" class="input" value="${escA(s ? s.birthday || '' : '')}"></div>
          <div class="field"><label>宿舍</label><input id="f_dorm" class="input" value="${escA(s ? s.dorm : '')}"></div>
          <div class="field"><label>本人电话</label><input id="f_phone" class="input" value="${escA(s ? s.phone : '')}"></div>
          <div class="field"><label>家长电话</label><input id="f_pphone" class="input" value="${escA(s ? s.parentPhone : '')}"></div>
        </div>
        <div class="field" style="margin-top:12px"><label>备注</label>
          <textarea id="f_notes" class="input" rows="2">${esc(s ? s.notes : '')}</textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="App.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="Students.saveForm('${sid || ''}')">保存</button>
      </div>`);
  }

  function saveForm(sid) {
    const name = val('f_name').trim();
    if (!name) return App.toast('请填写学生姓名', 'error');
    const info = {
      name,
      studentNo: val('f_no').trim(),
      gender: val('f_gender'),
      seat: val('f_seat').trim(),
      birthday: val('f_birth'),
      dorm: val('f_dorm').trim(),
      phone: val('f_phone').trim(),
      parentPhone: val('f_pphone').trim(),
      notes: val('f_notes')
    };
    if (sid) { Store.updateStudent(sid, info); App.toast('已保存'); }
    else { Store.addStudent(info); App.toast('已添加学生'); }
    App.closeModal();
    render();
  }

  function delStudent(sid) {
    const s = Store.getStudent(sid);
    if (!s) return;
    if (confirm('确定删除学生「' + s.name + '」的档案及全部成绩记录吗？')) {
      Store.deleteStudent(sid);
      App.toast('已删除');
      render();
    }
  }

  /* ---------- 详情 ---------- */
  function openDetail(sid) {
    const s = Store.getStudent(sid);
    if (!s) return;
    App.openModal(`
      <div class="modal-lg">
        <div class="modal-head detail-head">
          <div class="avatar">${esc(s.name.charAt(0))}</div>
          <div>
            <h3>${esc(s.name)}</h3>
            <div class="muted small">${s.studentNo ? '学号 ' + esc(s.studentNo) + '　' : ''}${esc(s.gender) || ''}${s.seat ? '　座位 ' + esc(s.seat) : ''}</div>
          </div>
          <button class="modal-x" onclick="App.closeModal()">×</button>
        </div>
        <div class="tabs">
          <button class="tab active" data-tab="base" onclick="Students.activateTab('${s.id}','base')">基本信息</button>
          <button class="tab" data-tab="subjects" onclick="Students.activateTab('${s.id}','subjects')">学科情况</button>
          <button class="tab" data-tab="life" onclick="Students.activateTab('${s.id}','life')">生活情况</button>
          <button class="tab" data-tab="analysis" onclick="Students.activateTab('${s.id}','analysis')">成绩分析</button>
        </div>
        <div class="modal-body" id="stuTabContent"></div>
        <div class="modal-foot"><button class="btn" onclick="App.closeModal()">关闭</button></div>
      </div>`);
    activateTab(s.id, 'base');
  }

  function activateTab(sid, tab) {
    document.querySelectorAll('#modal .tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const box = document.getElementById('stuTabContent');
    if (!box) return;
    const s = Store.getStudent(sid);
    if (!s) return;
    if (tab === 'base') box.innerHTML = baseHtml(s);
    else if (tab === 'subjects') box.innerHTML = subjectsHtml(s);
    else if (tab === 'life') box.innerHTML = lifeHtml(s);
    else if (tab === 'analysis') { box.innerHTML = analysisHtml(s); renderAnalysisCharts(s); }
  }

  /* ----- 基本信息 ----- */
  function baseHtml(s) {
    return `
      <div class="form-grid">
        <div class="field"><label>姓名 *</label><input id="f_name" class="input" value="${escA(s.name)}"></div>
        <div class="field"><label>学号</label><input id="f_no" class="input" value="${escA(s.studentNo)}"></div>
        <div class="field"><label>性别</label>
          <select id="f_gender" class="select">
            <option value="">请选择</option>
            <option ${s.gender === '男' ? 'selected' : ''}>男</option>
            <option ${s.gender === '女' ? 'selected' : ''}>女</option>
          </select>
        </div>
        <div class="field"><label>座位号</label><input id="f_seat" class="input" value="${escA(s.seat)}"></div>
        <div class="field"><label>生日</label><input id="f_birth" type="date" class="input" value="${escA(s.birthday || '')}"></div>
        <div class="field"><label>宿舍</label><input id="f_dorm" class="input" value="${escA(s.dorm)}"></div>
        <div class="field"><label>本人电话</label><input id="f_phone" class="input" value="${escA(s.phone)}"></div>
        <div class="field"><label>家长电话</label><input id="f_pphone" class="input" value="${escA(s.parentPhone)}"></div>
      </div>
      <div class="field" style="margin-top:12px"><label>备注</label>
        <textarea id="f_notes" class="input" rows="2">${esc(s.notes)}</textarea>
      </div>
      <div style="text-align:right;margin-top:14px">
        <button class="btn btn-primary" onclick="Students.saveBase('${s.id}')">保存基本信息</button>
      </div>`;
  }

  function saveBase(sid) {
    const name = val('f_name').trim();
    if (!name) return App.toast('请填写学生姓名', 'error');
    Store.updateStudent(sid, {
      name,
      studentNo: val('f_no').trim(),
      gender: val('f_gender'),
      seat: val('f_seat').trim(),
      birthday: val('f_birth'),
      dorm: val('f_dorm').trim(),
      phone: val('f_phone').trim(),
      parentPhone: val('f_pphone').trim(),
      notes: val('f_notes')
    });
    App.toast('基本信息已保存');
  }

  /* ----- 学科情况 ----- */
  function subjectsHtml(s) {
    const opt = (cur, arr) => arr.map(o => `<option ${o === cur ? 'selected' : ''}>${o}</option>`).join('');
    let html = '<div class="subj-grid">';
    Store.listSubjects().forEach((sub, i) => {
      const info = s.subjects[sub.name] || {};
      html += `<div class="subj-card">
        <h5><span>${esc(sub.name)}</span><span class="muted small">满分 ${sub.full}</span></h5>
        <div class="field"><label>当前水平</label>
          <select id="subj_level_${i}" class="select">${opt(info.level || '', ['优秀', '良好', '中等', '薄弱'])}</select></div>
        <div class="field"><label>学习态度</label>
          <select id="subj_attitude_${i}" class="select">${opt(info.attitude || '', ['积极主动', '一般', '需督促'])}</select></div>
        <div class="field"><label>作业情况</label>
          <select id="subj_homework_${i}" class="select">${opt(info.homework || '', ['按时完成', '偶尔拖欠', '经常拖欠'])}</select></div>
        <div class="field"><label>薄弱点</label>
          <input id="subj_weak_${i}" class="input" value="${escA(info.weak || '')}"></div>
        <div class="field"><label>备注</label>
          <textarea id="subj_note_${i}" class="input" rows="2">${esc(info.note || '')}</textarea></div>
      </div>`;
    });
    html += `</div>
      <div style="text-align:right;margin-top:14px">
        <button class="btn btn-primary" onclick="Students.saveSubjects('${s.id}')">保存学科情况</button>
      </div>`;
    return html;
  }

  function saveSubjects(sid) {
    Store.listSubjects().forEach((sub, i) => {
      Store.setSubjectInfo(sid, sub.name, {
        level: val('subj_level_' + i),
        attitude: val('subj_attitude_' + i),
        homework: val('subj_homework_' + i),
        weak: val('subj_weak_' + i).trim(),
        note: val('subj_note_' + i)
      });
    });
    App.toast('学科情况已保存');
  }

  /* ----- 生活情况 ----- */
  function lifeHtml(s) {
    const L = s.life || {};
    return `
      <div class="form-grid">
        <div class="field"><label>性格特点</label><input id="life_personality" class="input" value="${escA(L.personality || '')}"></div>
        <div class="field"><label>兴趣爱好</label><input id="life_hobbies" class="input" value="${escA(L.hobbies || '')}"></div>
        <div class="field"><label>家庭情况</label><input id="life_family" class="input" value="${escA(L.family || '')}"></div>
        <div class="field"><label>人际关系</label><input id="life_relations" class="input" value="${escA(L.relations || '')}"></div>
        <div class="field"><label>心理健康</label><input id="life_psychology" class="input" value="${escA(L.psychology || '')}"></div>
        <div class="field"><label>身体状况</label><input id="life_health" class="input" value="${escA(L.health || '')}"></div>
      </div>
      <div class="field" style="margin-top:12px"><label>备注</label>
        <textarea id="life_notes" class="input" rows="2">${esc(L.notes || '')}</textarea>
      </div>
      <div style="text-align:right;margin-top:14px">
        <button class="btn btn-primary" onclick="Students.saveLife('${s.id}')">保存生活情况</button>
      </div>
      <hr class="sep">
      <h4>成长记录</h4>
      <div class="timeline-wrap" id="timelineWrap">${timelineHtml(s)}</div>
      <div class="add-event">
        <input id="ev_date" type="date" class="input" style="width:150px">
        <input id="ev_title" class="input" placeholder="事件标题" style="flex:1;min-width:140px">
        <input id="ev_detail" class="input" placeholder="事件详情（可选）" style="flex:2;min-width:160px">
        <button class="btn btn-primary" onclick="Students.addEvent('${s.id}')">添加记录</button>
      </div>`;
  }

  function timelineHtml(s) {
    if (!s.events.length) return '<div class="muted small" style="padding:8px 0">暂无记录，可添加学生的成长点滴（获奖、谈心、违纪、进步等）。</div>';
    const sorted = s.events.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    let html = '<ul class="timeline">';
    sorted.forEach(ev => {
      html += `<li>
        <div class="ev-date">${esc(ev.date)}<button class="btn btn-xs btn-danger" style="margin-left:10px" onclick="Students.delEvent('${s.id}','${ev.id}')">删除</button></div>
        <div class="ev-title">${esc(ev.title)}</div>
        ${ev.detail ? '<div class="ev-detail">' + esc(ev.detail) + '</div>' : ''}
      </li>`;
    });
    html += '</ul>';
    return html;
  }

  function saveLife(sid) {
    Store.setLifeInfo(sid, {
      personality: val('life_personality').trim(),
      hobbies: val('life_hobbies').trim(),
      family: val('life_family').trim(),
      relations: val('life_relations').trim(),
      psychology: val('life_psychology').trim(),
      health: val('life_health').trim(),
      notes: val('life_notes')
    });
    App.toast('生活情况已保存');
  }

  function addEvent(sid) {
    const title = val('ev_title').trim();
    if (!title) return App.toast('请填写事件标题', 'error');
    Store.addEvent(sid, { date: val('ev_date'), title, detail: val('ev_detail').trim() });
    const wrap = document.getElementById('timelineWrap');
    if (wrap) wrap.innerHTML = timelineHtml(Store.getStudent(sid));
    const clear = id => { const e = document.getElementById(id); if (e) e.value = ''; };
    clear('ev_title'); clear('ev_detail'); clear('ev_date');
    App.toast('已添加记录');
  }

  function delEvent(sid, evId) {
    Store.deleteEvent(sid, evId);
    const wrap = document.getElementById('timelineWrap');
    if (wrap) wrap.innerHTML = timelineHtml(Store.getStudent(sid));
    App.toast('已删除记录');
  }

  /* ----- 成绩分析 ----- */
  function analysisHtml() {
    return `
      <div class="chart-grid">
        <div class="chart-box"><h4>各科成绩趋势</h4><div id="chartStuTrend"></div></div>
        <div class="chart-box"><h4>排名趋势（曲线越靠上排名越靠前）</h4><div id="chartStuRank"></div></div>
        <div class="chart-box wide"><h4>最近考试：本人 vs 班级平均（雷达图）</h4><div id="chartStuRadar"></div></div>
      </div>`;
  }

  function renderAnalysisCharts(s) {
    const exams = Store.listExams();
    const subj = Store.listSubjects();

    const trendEl = document.getElementById('chartStuTrend');
    if (trendEl) {
      const series = subj.map((sb, si) => ({
        name: sb.name,
        color: Charts.COLORS[si % Charts.COLORS.length],
        values: exams.map(e => Store.getScore(s.id, e.id, sb.name))
      }));
      Charts.lineChart(trendEl, { labels: exams.map(e => e.name), series });
    }

    const rankEl = document.getElementById('chartStuRank');
    if (rankEl) {
      const vals = exams.map(e => {
        const r = Store.examRankings(e.id).find(x => x.student.id === s.id);
        return r ? r.rank : null;
      });
      Charts.lineChart(rankEl, {
        labels: exams.map(e => e.name),
        series: [{ name: '排名', color: Charts.COLORS[3], values: vals }],
        invert: true, yMin: 0, yMax: Store.listStudents().length + 1
      });
    }

    const radarEl = document.getElementById('chartStuRadar');
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
              name: s.name, color: Charts.COLORS[3],
              values: exam.subjects.map(n => Store.getScore(s.id, exam.id, n) || 0),
              maxValues: exam.subjects.map(n => Store.fullOf(n))
            },
            {
              name: '班级平均', color: Charts.COLORS[0],
              values: exam.subjects.map(n => (avgs[n] != null ? avgs[n] : 0)),
              maxValues: exam.subjects.map(n => Store.fullOf(n))
            }
          ]
        });
      }
    }
  }

  return {
    render, openForm, saveForm, delStudent,
    openDetail, activateTab, saveBase, saveSubjects, saveLife, addEvent, delEvent
  };
})();
