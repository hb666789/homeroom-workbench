/* ============================================================
 * store.js — 数据层 v2
 * 多班级管理 / 学生档案 / 考试成绩 / 试卷题目与逐题统计
 * localStorage 持久化，兼容 v1 数据自动迁移
 * ============================================================ */
const Store = (function () {
  const KEY = 'homeroom_workbench_v1';
  const DEFAULT_SUBJECTS = [
    { name: '语文', full: 150 },
    { name: '数学', full: 150 },
    { name: '英语', full: 150 },
    { name: '物理', full: 100 },
    { name: '化学', full: 100 },
    { name: '生物', full: 100 },
    { name: '政治', full: 100 },
    { name: '历史', full: 100 },
    { name: '地理', full: 100 }
  ];
  let data = null;

  function newClass(name, id) {
    return {
      id: id || ('c' + Date.now()),
      name: name || '新班级',
      students: [],
      exams: [],
      scores: {},
      qresults: {},
      nextId: { student: 1, exam: 1, event: 1, question: 1 }
    };
  }

  function empty() {
    const c = newClass('高三(1)班', 'c1');
    return {
      version: 2,
      subjects: DEFAULT_SUBJECTS.map(s => ({ ...s })),
      warnLines: {},
      classes: [c],
      currentClassId: 'c1',
      nextClassId: 2
    };
  }

  /* 兼容旧数据 / 补全字段（v1 → v2 自动迁移） */
  function normalize(d) {
    if (!d || typeof d !== 'object') return empty();
    if (!Array.isArray(d.subjects) || !d.subjects.length) d.subjects = DEFAULT_SUBJECTS.map(s => ({ ...s }));
    if (!d.warnLines || typeof d.warnLines !== 'object') d.warnLines = {};
    if (!Array.isArray(d.classes) || !d.classes.length) {
      const cls = newClass(d.className || '高三(1)班', 'c1');
      cls.students = Array.isArray(d.students) ? d.students : [];
      cls.exams = Array.isArray(d.exams) ? d.exams : [];
      cls.scores = (d.scores && typeof d.scores === 'object') ? d.scores : {};
      cls.qresults = (d.qresults && typeof d.qresults === 'object') ? d.qresults : {};
      if (d.nextId) Object.assign(cls.nextId, d.nextId);
      d.classes = [cls];
      d.currentClassId = 'c1';
      d.nextClassId = 2;
    }
    d.classes.forEach(c => {
      if (!c.id) c.id = 'c' + Date.now() + Math.floor(Math.random() * 1000);
      if (!c.name) c.name = '未命名班级';
      if (!c.nextId) c.nextId = { student: 1, exam: 1, event: 1, question: 1 };
      if (!c.nextId.question) c.nextId.question = 1;
      if (!c.scores || typeof c.scores !== 'object') c.scores = {};
      if (!c.qresults || typeof c.qresults !== 'object') c.qresults = {};
      if (!Array.isArray(c.students)) c.students = [];
      if (!Array.isArray(c.exams)) c.exams = [];
      c.students.forEach(s => {
        if (!s.subjects) s.subjects = {};
        if (!s.life) s.life = {};
        if (!Array.isArray(s.events)) s.events = [];
        if (!Array.isArray(s.hiddenSubjects)) s.hiddenSubjects = [];
      });
    });
    if (!d.currentClassId || !d.classes.some(c => c.id === d.currentClassId)) d.currentClassId = d.classes[0].id;
    return d;
  }

  /* ---------- 持久化 ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = normalize(raw ? JSON.parse(raw) : empty());
    } catch (e) {
      data = empty();
    }
    return data;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 存储失败忽略 */ }
  }
  function raw() { return data; }
  function replace(d) { data = normalize(d); save(); }
  function reset() { data = empty(); save(); }
  function hasData() { return data.classes.some(c => c.students.length || c.exams.length); }

  /* ---------- 班级 ---------- */
  function listClasses() { return data.classes; }
  function getClass(id) { return data.classes.find(c => c.id === id) || null; }
  function currentClassId() { return data.currentClassId; }
  function currentClass() { return getClass(data.currentClassId) || data.classes[0] || null; }
  function setCurrentClass(id) {
    if (getClass(id)) { data.currentClassId = id; save(); return true; }
    return false;
  }
  function addClass(name) {
    const c = newClass(name, 'c' + (data.nextClassId++));
    data.classes.push(c);
    data.currentClassId = c.id;
    save();
    return c;
  }
  function renameClass(id, name) {
    const c = getClass(id);
    if (c && name) { c.name = name; save(); }
  }
  function deleteClass(id) {
    if (data.classes.length <= 1) return false;
    data.classes = data.classes.filter(c => c.id !== id);
    if (data.currentClassId === id) data.currentClassId = data.classes[0].id;
    save();
    return true;
  }
  function className() { const c = currentClass(); return c ? c.name : ''; }
  function setClassName(v) { const c = currentClass(); if (c && v) { c.name = v; save(); } }

  /* 把学生（含成绩与逐题记录）移到另一个班级 */
  function moveStudentToClass(sid, targetClassId) {
    const from = currentClass(), to = getClass(targetClassId);
    if (!from || !to || from.id === to.id) return false;
    const s = from.students.find(x => x.id === sid);
    if (!s) return false;
    from.students = from.students.filter(x => x.id !== sid);
    to.students.push(s);
    if (from.scores[sid]) { to.scores[sid] = from.scores[sid]; delete from.scores[sid]; }
    Object.keys(from.qresults || {}).forEach(eid => {
      const qm = from.qresults[eid] || {};
      Object.keys(qm).forEach(qid => {
        if (qm[qid] && sid in qm[qid]) {
          if (!to.qresults[eid]) to.qresults[eid] = {};
          if (!to.qresults[eid][qid]) to.qresults[eid][qid] = {};
          to.qresults[eid][qid][sid] = qm[qid][sid];
          delete qm[qid][sid];
        }
      });
    });
    save();
    return true;
  }

  /* ---------- 科目（全局配置） ---------- */
  function listSubjects() { return data.subjects; }
  function fullOf(name) {
    const s = data.subjects.find(x => x.name === name);
    return s ? Number(s.full) || 100 : 100;
  }
  function setSubjects(list) { data.subjects = list; save(); }

  /* ---------- 成绩预警线 ---------- */
  /* 显式设置的预警线；未设置则返回 null */
  function warnLineExplicit(name) {
    return data.warnLines[name] != null ? Number(data.warnLines[name]) : null;
  }
  /* 生效的预警线：显式值，否则默认满分的 60% */
  function warnLineOf(name) {
    const ex = warnLineExplicit(name);
    if (ex != null && ex > 0) return ex;
    return Math.round(fullOf(name) * 0.6);
  }
  function setWarnLine(name, val) {
    const v = Number(val);
    if (isFinite(v) && v > 0) data.warnLines[name] = v;
    else delete data.warnLines[name];
    save();
  }
  function resetWarnLine(name) {
    delete data.warnLines[name];
    save();
  }
  /* 某次考试中的学科预警：{student, subject, score, line} */
  function warningsForExam(eid) {
    const exam = getExam(eid);
    const c = currentClass();
    const out = [];
    if (!exam || !c) return out;
    c.students.forEach(s => {
      exam.subjects.forEach(n => {
        const v = getScore(s.id, eid, n);
        if (v == null) return;
        const line = warnLineOf(n);
        if (v < line) out.push({ student: s, subject: n, score: v, line });
      });
    });
    return out;
  }

  /* ---------- 学生 ---------- */
  function listStudents() { const c = currentClass(); return c ? c.students : []; }
  function getStudent(id) { const c = currentClass(); return c ? c.students.find(s => s.id === id) || null : null; }

  function addStudent(info) {
    const c = currentClass();
    if (!c) return null;
    const st = {
      id: 's' + (c.nextId.student++),
      name: info.name || '未命名',
      studentNo: info.studentNo || '',
      gender: info.gender || '',
      seat: info.seat || '',
      birthday: info.birthday || '',
      dorm: info.dorm || '',
      phone: info.phone || '',
      parentPhone: info.parentPhone || '',
      hukouType: info.hukouType || '',
      nativePlace: info.nativePlace || '',
      localStudent: info.localStudent || '',
      xuejiStatus: info.xuejiStatus || '',
      xuejiNo: info.xuejiNo || '',
      notes: info.notes || '',
      subjects: {},
      hiddenSubjects: [],
      life: {},
      events: [],
      createdAt: Date.now()
    };
    c.students.push(st);
    save();
    return st;
  }

  function updateStudent(id, patch) {
    const s = getStudent(id);
    if (!s) return null;
    Object.keys(patch).forEach(k => { if (k !== 'id') s[k] = patch[k]; });
    save();
    return s;
  }

  function deleteStudent(id) {
    const c = currentClass();
    if (!c) return;
    c.students = c.students.filter(s => s.id !== id);
    delete c.scores[id];
    Object.keys(c.qresults || {}).forEach(eid => {
      Object.keys(c.qresults[eid] || {}).forEach(qid => {
        if (c.qresults[eid][qid]) delete c.qresults[eid][qid][id];
      });
    });
    save();
  }

  /* 学科情况：s.subjects[科目名] = {level, attitude, homework, weak, note} */
  function setSubjectInfo(id, subj, info) {
    const s = getStudent(id);
    if (!s) return;
    if (!s.subjects[subj]) s.subjects[subj] = {};
    Object.assign(s.subjects[subj], info);
    save();
  }
  function removeSubjectInfo(id, subj) {
    const s = getStudent(id);
    if (!s || !s.subjects) return;
    delete s.subjects[subj];
    save();
  }
  /* 删除（隐藏）该学生的一门学科：删除记录并记录到 hiddenSubjects，不再显示 */
  function hideSubject(id, subj) {
    const s = getStudent(id);
    if (!s) return;
    delete s.subjects[subj];
    if (!Array.isArray(s.hiddenSubjects)) s.hiddenSubjects = [];
    if (!s.hiddenSubjects.includes(subj)) s.hiddenSubjects.push(subj);
    save();
  }
  function showSubject(id, subj) {
    const s = getStudent(id);
    if (!s) return;
    if (Array.isArray(s.hiddenSubjects)) s.hiddenSubjects = s.hiddenSubjects.filter(n => n !== subj);
    save();
  }

  /* 生活情况 */
  function setLifeInfo(id, info) {
    const s = getStudent(id);
    if (!s) return;
    if (!s.life) s.life = {};
    Object.assign(s.life, info);
    save();
  }

  /* 成长记录 */
  function addEvent(id, ev) {
    const s = getStudent(id);
    const c = currentClass();
    if (!s || !c) return null;
    const item = { id: 'ev' + (c.nextId.event++), date: ev.date || '', title: ev.title || '', detail: ev.detail || '' };
    s.events.push(item);
    save();
    return item;
  }
  function deleteEvent(id, evId) {
    const s = getStudent(id);
    if (!s) return;
    s.events = s.events.filter(e => e.id !== evId);
    save();
  }

  /* ---------- 考试 ---------- */
  function listExams() {
    const c = currentClass();
    return c ? c.exams.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) : [];
  }
  function getExam(id) { const c = currentClass(); return c ? c.exams.find(e => e.id === id) || null : null; }
  function latestExam() {
    const list = listExams();
    return list.length ? list[list.length - 1] : null;
  }
  function addExam(info) {
    const c = currentClass();
    if (!c) return null;
    const e = {
      id: 'e' + (c.nextId.exam++),
      name: info.name || '未命名考试',
      date: info.date || '',
      type: info.type || '月考',
      subjects: (info.subjects && info.subjects.length) ? info.subjects.slice() : data.subjects.map(s => s.name),
      paper: []
    };
    c.exams.push(e);
    save();
    return e;
  }
  function updateExam(id, patch) {
    const e = getExam(id);
    if (!e) return null;
    Object.keys(patch).forEach(k => { if (k !== 'id') e[k] = patch[k]; });
    if (!Array.isArray(e.paper)) e.paper = [];
    save();
    return e;
  }
  function deleteExam(id) {
    const c = currentClass();
    if (!c) return;
    c.exams = c.exams.filter(e => e.id !== id);
    Object.keys(c.scores).forEach(sid => { delete c.scores[sid][id]; });
    delete c.qresults[id];
    save();
  }
  function examFullSum(exam) {
    return exam.subjects.reduce((t, n) => t + fullOf(n), 0);
  }

  /* ---------- 成绩 ---------- */
  function getScore(sid, eid, subj) {
    const c = currentClass();
    const m = c && c.scores[sid] && c.scores[sid][eid];
    return m ? (m[subj] == null ? null : m[subj]) : null;
  }
  function setScore(sid, eid, subj, val) {
    const c = currentClass();
    if (!c) return;
    if (!c.scores[sid]) c.scores[sid] = {};
    if (!c.scores[sid][eid]) c.scores[sid][eid] = {};
    c.scores[sid][eid][subj] = (val === null || val === '' || val === undefined) ? null : Number(val);
    save();
  }
  function studentTotal(sid, eid, subjectNames) {
    const c = currentClass();
    const m = c && c.scores[sid] && c.scores[sid][eid];
    if (!m) return null;
    let total = 0, count = 0;
    subjectNames.forEach(n => {
      const v = m[n];
      if (typeof v === 'number' && isFinite(v)) { total += v; count++; }
    });
    return count ? { total, count } : null;
  }
  function examRankings(eid) {
    const c = currentClass();
    const exam = getExam(eid);
    if (!c || !exam) return [];
    const rows = [];
    c.students.forEach(s => {
      const t = studentTotal(s.id, eid, exam.subjects);
      if (t) rows.push({ student: s, total: t.total, count: t.count });
    });
    rows.sort((a, b) => b.total - a.total || String(a.student.studentNo).localeCompare(String(b.student.studentNo)));
    let rank = 0, prev = null;
    rows.forEach((r, i) => {
      if (prev === null || r.total !== prev) { rank = i + 1; prev = r.total; }
      r.rank = rank;
    });
    return rows;
  }
  function classAvg(eid) {
    const exam = getExam(eid);
    const c = currentClass();
    const out = { _overall: null };
    if (!exam || !c) return out;
    const sums = {}, counts = {};
    exam.subjects.forEach(n => { sums[n] = 0; counts[n] = 0; });
    c.students.forEach(s => {
      const m = c.scores[s.id] && c.scores[s.id][eid];
      if (!m) return;
      exam.subjects.forEach(n => {
        const v = m[n];
        if (typeof v === 'number' && isFinite(v)) { sums[n] += v; counts[n]++; }
      });
    });
    let tot = 0, totN = 0;
    exam.subjects.forEach(n => {
      if (counts[n]) { out[n] = Math.round((sums[n] / counts[n]) * 10) / 10; tot += sums[n]; totN += counts[n]; }
      else out[n] = null;
    });
    if (totN) out._overall = Math.round((tot / totN) * 10) / 10;
    return out;
  }

  /* ---------- 试卷题目与逐题统计 ---------- */
  function getQuestions(eid) {
    const exam = getExam(eid);
    return exam && Array.isArray(exam.paper) ? exam.paper : [];
  }
  function addQuestion(eid, q) {
    const exam = getExam(eid);
    const c = currentClass();
    if (!exam || !c) return null;
    if (!Array.isArray(exam.paper)) exam.paper = [];
    const item = {
      id: 'q' + (c.nextId.question++),
      subject: q.subject || '',
      type: q.type || '其他',
      title: q.title || '',
      score: Number(q.score) || 0
    };
    exam.paper.push(item);
    save();
    return item;
  }
  function deleteQuestion(eid, qid) {
    const exam = getExam(eid);
    const c = currentClass();
    if (!exam || !c) return;
    exam.paper = (exam.paper || []).filter(q => q.id !== qid);
    if (c.qresults[eid]) delete c.qresults[eid][qid];
    save();
  }
  function clearQuestions(eid) {
    const exam = getExam(eid);
    const c = currentClass();
    if (!exam || !c) return;
    exam.paper = [];
    c.qresults[eid] = {};
    save();
  }
  /* 逐题对错：val = 1 正确 / 0 错误 / null 未答 */
  function setQResult(eid, qid, sid, val) {
    const c = currentClass();
    if (!c) return;
    if (!c.qresults[eid]) c.qresults[eid] = {};
    if (!c.qresults[eid][qid]) c.qresults[eid][qid] = {};
    c.qresults[eid][qid][sid] = val;
    save();
  }
  function getQResult(eid, qid, sid) {
    const c = currentClass();
    const m = c && c.qresults[eid] && c.qresults[eid][qid];
    return m ? (m[sid] == null ? null : m[sid]) : null;
  }
  function qStats(eid, qid) {
    const c = currentClass();
    const m = c && c.qresults[eid] && c.qresults[eid][qid] ? c.qresults[eid][qid] : {};
    const students = c ? c.students : [];
    let right = 0, wrong = 0, none = 0;
    students.forEach(s => {
      const v = m[s.id];
      if (v === 1) right++;
      else if (v === 0) wrong++;
      else none++;
    });
    const total = students.length || 1;
    const r = x => Math.round(x / total * 1000) / 10;
    return { right, wrong, none, total, rightRate: r(right), wrongRate: r(wrong), noneRate: r(none) };
  }

  /* ---------- 示例数据 ---------- */
  const NAMES1 = ['王思远', '李雨桐', '张浩然', '刘欣怡', '陈子墨', '赵一诺', '孙嘉豪', '周诗涵',
    '吴宇航', '郑晓彤', '钱博文', '冯若曦', '蒋天佑', '韩静怡', '杨明轩', '朱可欣',
    '秦少杰', '许梦琪', '何俊熙', '吕欣然', '施文博', '孔慧敏', '曹骏驰', '严雨欣'];
  const NAMES2 = ['陈立', '黄雨萱', '罗宇翔', '谢思琪', '谭俊杰', '苏婉婷', '邓凯', '彭佳怡',
    '曾浩然', '萧雅文', '沈志强', '唐心怡'];

  function seedDemo() {
    reset();
    seedClass('高三(1)班', NAMES1, [
      { name: '2025年9月月考', date: '2025-09-25', type: '月考' },
      { name: '2025年10月期中', date: '2025-10-30', type: '期中' },
      { name: '2025年11月月考', date: '2025-11-27', type: '月考' },
      { name: '2025年12月月考', date: '2025-12-25', type: '月考' },
      { name: '2026年1月期末', date: '2026-01-22', type: '期末' }
    ], true);
    seedClass('高二(3)班', NAMES2, [
      { name: '2025年10月期中', date: '2025-10-30', type: '期中' },
      { name: '2025年11月月考', date: '2025-11-27', type: '月考' },
      { name: '2025年12月月考', date: '2025-12-25', type: '月考' }
    ], false);
    setCurrentClass(data.classes[0].id);
    save();
  }

  function seedClass(cname, names, examDefs, isFirst) {
    if (!isFirst) addClass(cname);
    const c = currentClass();
    if (cname) c.name = cname;

    names.forEach((n, i) => {
      addStudent({
        name: n,
        studentNo: String(i + 1).padStart(2, '0'),
        gender: i % 2 ? '女' : '男',
        seat: String(i + 1)
      });
    });
    examDefs.forEach(d => addExam({ ...d, subjects: data.subjects.map(s => s.name) }));

    const subjects = data.subjects;
    c.students.forEach(s => {
      const ability = {};
      subjects.forEach(sub => { ability[sub.name] = 0.55 + Math.random() * 0.38; });
      const i1 = Math.floor(Math.random() * subjects.length);
      const i2 = (i1 + 3) % subjects.length;
      ability[subjects[i1].name] = Math.min(0.97, ability[subjects[i1].name] + 0.14);
      ability[subjects[i2].name] = Math.max(0.32, ability[subjects[i2].name] - 0.16);
      s._ability = ability;

      subjects.forEach(sub => {
        const ab = ability[sub.name];
        s.subjects[sub.name] = {
          level: ab >= 0.85 ? '优秀' : ab >= 0.7 ? '良好' : ab >= 0.55 ? '中等' : '薄弱',
          attitude: Math.random() < 0.55 ? '积极主动' : '一般',
          homework: Math.random() < 0.65 ? '按时完成' : '偶尔拖欠',
          weak: ab < 0.6 ? sub.name + '基础较薄弱，需加强巩固' : '',
          note: ''
        };
      });
      s.life = {
        personality: Math.random() < 0.5 ? '性格开朗，乐于助人' : '性格沉稳，做事认真',
        hobbies: Math.random() < 0.5 ? '篮球、阅读' : '音乐、绘画',
        family: '',
        relations: '与同学相处融洽',
        psychology: '状态良好',
        health: '身体健康',
        notes: ''
      };
      /* 基础信息补充字段示例 */
      s.hukouType = Math.random() < 0.55 ? '城镇' : '农村';
      s.nativePlace = ['湖南长沙', '湖南株洲', '湖南湘潭', '湖南衡阳', '湖南邵阳', '广东深圳', '广西桂林'][Math.floor(Math.random() * 7)];
      s.localStudent = Math.random() < 0.75 ? '是' : '否';
      s.xuejiStatus = Math.random() < 0.95 ? '在籍' : '借读';
      let no = 'G';
      for (let k = 0; k < 18; k++) no += Math.floor(Math.random() * 10);
      s.xuejiNo = no;
      if (Math.random() < 0.4) {
        s.events.push({
          id: 'ev' + (c.nextId.event++),
          date: '2025-10-15',
          title: '班级活动表现积极',
          detail: '运动会中积极参与，为班级争取荣誉。'
        });
      }
    });

    c.exams.forEach((exam, ei) => {
      c.students.forEach(s => {
        const m = {};
        subjects.forEach(sub => {
          let ab = s._ability[sub.name] + ei * 0.012 + (Math.random() * 0.1 - 0.05);
          ab = Math.min(0.98, Math.max(0.3, ab));
          m[sub.name] = Math.round(ab * sub.full);
        });
        if (!c.scores[s.id]) c.scores[s.id] = {};
        c.scores[s.id][exam.id] = m;
      });
    });
    c.students.forEach(s => { delete s._ability; });

    /* 给第一班最近一次考试生成示例试卷与逐题统计 */
    if (isFirst && c.exams.length) {
      const last = c.exams[c.exams.length - 1];
      const qDefs = [
        { subject: '语文', type: '选择', title: '下列词语中加点字的读音全部正确的一项是', score: 3 },
        { subject: '语文', type: '填空', title: '补写出下列名篇名句中的空缺部分（第1小题）', score: 5 },
        { subject: '数学', type: '选择', title: '已知集合A={x|x²-3x+2<0}，则A中元素个数为', score: 5 },
        { subject: '数学', type: '解答', title: '已知函数f(x)=x³-3x，求f(x)的单调区间', score: 12 },
        { subject: '英语', type: '选择', title: '—How about the party? —Great! We had ____ good time.', score: 1.5 },
        { subject: '英语', type: '阅读', title: '阅读理解 Passage A：第1题（文章主旨）', score: 2 }
      ];
      qDefs.forEach(qd => addQuestion(last.id, qd));
      c.students.forEach(s => {
        qDefs.forEach(qd => {
          const q = last.paper.find(x => x.title === qd.title);
          if (q) setQResult(last.id, q.id, s.id, Math.random() < 0.72 ? 1 : 0);
        });
      });
    }
  }

  return {
    load, save, raw, replace, reset, hasData,
    className, setClassName,
    listClasses, getClass, currentClassId, setCurrentClass, addClass, renameClass, deleteClass, moveStudentToClass,
    listSubjects, fullOf, setSubjects,
    warnLineExplicit, warnLineOf, setWarnLine, resetWarnLine, warningsForExam,
    listStudents, getStudent, addStudent, updateStudent, deleteStudent,
    setSubjectInfo, removeSubjectInfo, hideSubject, showSubject, setLifeInfo, addEvent, deleteEvent,
    listExams, getExam, latestExam, addExam, updateExam, deleteExam, examFullSum,
    getScore, setScore, studentTotal, examRankings, classAvg,
    getQuestions, addQuestion, deleteQuestion, clearQuestions,
    setQResult, getQResult, qStats,
    seedDemo
  };
})();
