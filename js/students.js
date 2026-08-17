/* ============================================================
 * students.js — 学生管理
 * 列表（含批量选择）/ 建档编辑 / 详情（基本信息、学科情况可增删、生活情况、成长记录、成绩分析）
 * ============================================================ */
const Students = (function () {
  function val(id) {
    const e = document.getElementById(id);
    return e ? e.value : '';
  }

  /* ---------- 批量选择 ---------- */
  function selCount() { return Object.keys(App.state.stuSel).length; }
  function selList() { return Store.listStudents().filter(s => App.state.stuSel[s.id]); }

  function toggleSel(sid, checked) {
    const s = App.state.stuSel;
    if (checked) s[sid] = true; else delete s[sid];
    render();
  }
  function toggleAll(checked) {
    const q = (App.state.studentsQuery || '').toLowerCase();
    const list = Store.listStudents().filter(s =>
      !q || s.name.toLowerCase().includes(q) || String(s.studentNo).toLowerCase().includes(q));
    const sel = App.state.stuSel;
    list.forEach(st => { if (checked) sel[st.id] = true; else delete sel[st.id]; });
    render();
  }
  function clearSel() { App.state.stuSel = {}; render(); }

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
    const sel = App.state.stuSel;

    let html = `
      <div class="page-head">
        <h2>学生管理 <span class="muted small">${esc(Store.className())} · 共 ${Store.listStudents().length} 人</span></h2>
        <div class="page-actions">
          <input class="input search" placeholder="搜索姓名 / 学号" value="${escA(App.state.studentsQuery || '')}"
                 oninput="App.state.studentsQuery=this.value; App.throttleRender()">
          <button class="btn btn-primary" onclick="Students.openForm()">+ 新增学生</button>
        </div>
      </div>`;

    if (selCount()) {
      const names = selList().map(s => s.name).slice(0, 3).join('、');
      html += `<div class="sel-toolbar">
        <span>已选 <b>${selCount()}</b> 人${names ? '（' + esc(names) + (selCount() > 3 ? ' 等' : '') + '）' : ''}</span>
        <button class="btn btn-xs btn-primary" onclick="Students.batchEdit()">批量编辑</button>
        ${Store.listClasses().length > 1 ? '<button class="btn btn-xs" onclick="Students.batchMove()">批量移动班级</button>' : ''}
        <button class="btn btn-xs btn-danger" onclick="Students.batchDelete()">批量删除</button>
        <button class="btn btn-xs" onclick="Students.clearSel()">取消选择</button>
      </div>`;
    }

    if (!list.length) {
      html += `<div class="card empty">${Store.listStudents().length ? '没有匹配的学生' : '还没有学生，点击右上角「新增学生」开始建档'}</div>`;
    } else {
      html += `<div class="card table-card">
        <table class="table">
          <thead><tr>
            <th style="width:34px"><input type="checkbox" class="stu-chk" onchange="Students.toggleAll(this.checked)"></th>
            <th>学号</th><th>姓名</th><th>性别</th><th>座位</th>
            <th>最近考试总分</th><th>排名</th><th>状态</th><th style="width:220px">操作</th>
          </tr></thead><tbody>`;
      list.forEach(s => {
        const r = rankMap[s.id];
        const total = r ? r.total : '—';
        const rank = r ? r.rank : '—';
        const weak = r && fullSum && r.total < fullSum * 0.6;
        html += `<tr class="${sel[s.id] ? 'row-sel' : ''}">
          <td><input type="checkbox" class="stu-chk" ${sel[s.id] ? 'checked' : ''} onchange="Students.toggleSel('${s.id}', this.checked)"></td>
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

  /* ---------- 批量操作 ---------- */
  function batchEdit() {
    if (!selCount()) return;
    App.openModal(`
      <div class="modal-head"><h3>批量编辑（${selCount()} 人）</h3><button class="modal-x" onclick="App.closeModal()">×</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>性别（留空则不修改）</label>
            <select id="be_gender" class="select"><option value="">不修改</option><option>男</option><option>女</option></select>
          </div>
          <div class="field"><label>备注</label>
            <label class="chk" style="margin:0 0 6px"><input type="checkbox" id="be_append"> 追加到原备注（不勾选则覆盖）</label>
          </div>
        </div>
        <div class="field"><label>备注内容</label><textarea id="be_note" class="input" rows="3" placeholder="将应用到所有选中学生"></textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="App.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="Students.saveBatchEdit()">应用</button>
      </div>`);
  }
  function saveBatchEdit() {
    const list = selList();
    if (!list.length) return App.toast('未选择学生', 'error');
    const gender = val('be_gender');
    const append = document.getElementById('be_append') ? document.getElementById('be_append').checked : false;
    const note = val('be_note').trim();
    if (!gender && !note) return App.toast('请至少填写一项修改内容', 'error');
    list.forEach(s => {
      const patch = {};
      if (gender) patch.gender = gender;
      if (note) patch.notes = append ? (s.notes ? s.notes + '\n' + note : note) : note;
      Store.updateStudent(s.id, patch);
    });
    App.state.stuSel = {};
    App.closeModal();
    App.toast('已批量更新 ' + list.length + ' 名学生');
    render();
  }
  function batchMove() {
    if (!selCount()) return;
    const others = Store.listClasses().filter(c => c.id !== Store.currentClassId());
    App.openModal(`
      <div class="modal-head"><h3>批量移动班级（${selCount()} 人）</h3><button class="modal-x" onclick="App.closeModal()">×</button></div>
      <div class="modal-body">
        <div class="field"><label>目标班级</label>
          <select id="bm_cls" class="select">${others.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
        </div>
        <p class="muted small" style="margin-top:10px">移动后将同时迁移其成绩与逐题统计记录。</p>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="App.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="Students.saveBatchMove()">移动</button>
      </div>`);
  }
  function saveBatchMove() {
    const list = selList();
    const el = document.getElementById('bm_cls');
    if (!list.length || !el) return;
    const target = el.value;
    const cls = Store.getClass(target);
    if (!cls) return;
    if (!confirm('确定将选中的 ' + list.length + ' 名学生移动到「' + cls.name + '」吗？')) return;
    list.forEach(s => Store.moveStudentToClass(s.id, target));
    App.state.stuSel = {};
    App.closeModal();
    App.toast('已移动 ' + list.length + ' 名学生到「' + cls.name + '」');
    render();
  }
  function batchDelete() {
    const list = selList();
    if (!list.length) return;
    const names = list.slice(0, 5).map(s => s.name).join('、');
    if (!confirm('确定删除选中的 ' + list.length + ' 名学生吗？\n' + names + (list.length > 5 ? ' 等' : '') + '\n其档案与全部成绩记录将被删除！')) return;
    list.forEach(s => Store.deleteStudent(s.id));
    App.state.stuSel = {};
    App.toast('已删除 ' + list.length + ' 名学生');
    render();
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
      delete App.state.stuSel[sid];
      App.toast('已删除');
      render();
    }
  }

  /* ---------- 详情 ---------- */
  function openDetail(sid) {
    const s = Store.getStudent(sid);
    if (!s) return;
    App.openModal(`
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
      <div class="modal-foot"><button class="btn" onclick="App.closeModal()">关闭</button></div>`, 'modal-lg');
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
    else if (tab === 'analysis') { box.innerHTML = analysisHtml(); renderAnalysisCharts(s); }
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

  /* ----- 学科情况（全局科目 + 学生自定义学科） ----- */
  function combinedSubjects(s) {
    const configuredNames = Store.listSubjects().map(c => c.name);
    const custom = Object.keys(s.subjects || {}).filter(n => !configuredNames.includes(n));
    return Store.listSubjects()
      .map(c => ({ name: c.name, full: c.full, custom: false }))
      .concat(custom.map(n => ({ name: n, full: Store.fullOf(n), custom: true })));
  }

  function subjectsHtml(s) {
    const opt = (cur, arr) => arr.map(o => `<option ${o === cur ? 'selected' : ''}>${o}</option>`).join('');
    const combined = combinedSubjects(s);
    const customCount = combined.filter(x => x.custom).length;
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span class="muted small">共 ${combined.length} 门学科${customCount ? '（含自定义 ' + customCount + ' 门）' : ''}</span>
      <button class="btn btn-primary" onclick="Students.addSubject('${s.id}')">+ 添加学科</button>
    </div>
    <div class="subj-grid">`;
    combined.forEach((sub, i) => {
      const info = s.subjects[sub.name] || {};
      html += `<div class="subj-card">
        <h5>
          <span>${esc(sub.name)}${sub.custom ? ' <span class="badge">自定义</span>' : ''}</span>
          <span>${sub.custom
            ? `<button class="btn btn-xs btn-danger" onclick="Students.delSubject('${s.id}','${escA(sub.name)}')">删除学科</button>`
            : `<span class="muted small">满分 ${sub.full}</span>`}</span>
        </h5>
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
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">
        <button class="btn btn-primary" onclick="Students.saveSubjects('${s.id}')">保存学科情况</button>
      </div>`;
    return html;
  }

  function saveSubjects(sid) {
    const s = Store.getStudent(sid);
    if (!s) return;
    combinedSubjects(s).forEach((sub, i) => {
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

  const QUICK_SUBJECTS = ['日语', '俄语', '德语', '法语', '西班牙语', '信息技术', '通用技术', '体育', '美术', '音乐', '心理健康', '生涯规划'];

  function addSubject(sid) {
    App.openModal(`
      <div class="modal-head"><h3>添加学科</h3><button class="modal-x" onclick="App.closeModal()">×</button></div>
      <div class="modal-body">
        <div class="field"><label>常用学科（点击快速填入）</label>
          <div class="name-chips" style="margin-bottom:12px">
            ${QUICK_SUBJECTS.map(n => `<span class="chip" onclick="Students.pickSubject('${n}')">${n}</span>`).join('')}
          </div>
        </div>
        <div class="field"><label>或手动输入学科名称 *</label>
          <input id="f_subjname" class="input" placeholder="如：日语、校本课程"></div>
        <p class="muted small" style="margin-top:8px">自定义学科只对该学生生效；如需全校统一的新科目，请在「设置 → 科目管理」中添加。</p>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="App.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="Students.saveAddSubject('${sid}')">添加</button>
      </div>`);
    setTimeout(() => { const el = document.getElementById('f_subjname'); if (el) el.focus(); }, 60);
  }
  function pickSubject(name) {
    const el = document.getElementById('f_subjname');
    if (el) el.value = name;
  }
  function saveAddSubject(sid) {
    const name = val('f_subjname').trim();
    if (!name) return App.toast('请填写学科名称', 'error');
    const s = Store.getStudent(sid);
    if (s && s.subjects && s.subjects[name]) return App.toast('该学科已存在', 'error');
    Store.setSubjectInfo(sid, name, {});
    App.closeModal();
    App.toast('已添加学科「' + name + '」，请填写情况后保存');
    activateTab(sid, 'subjects');
  }
  function delSubject(sid, name) {
    if (!confirm('确定删除该学生的自定义学科「' + name + '」吗？')) return;
    Store.removeSubjectInfo(sid, name);
    App.toast('已删除学科');
    activateTab(sid, 'subjects');
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
    openDetail, activateTab, saveBase, saveSubjects, addSubject, pickSubject, saveAddSubject, delSubject,
    saveLife, addEvent, delEvent,
    toggleSel, toggleAll, clearSel, batchEdit, saveBatchEdit, batchMove, saveBatchMove, batchDelete
  };
})();
