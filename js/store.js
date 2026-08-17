/* ============================================================
 * store.js — 数据层
 * 学生档案 / 考试成绩 数据模型 + localStorage 持久化
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

  function empty() {
    return {
      version: 1,
      className: '高三(1)班',
      subjects: DEFAULT_SUBJECTS.map(s => ({ ...s })),
      students: [],
      exams: [],
      scores: {},
      nextId: { student: 1, exam: 1, event: 1 }
    };
  }

  /* 兼容旧数据 / 补全字段 */
  function normalize(d) {
    if (!d || typeof d !== 'object') return empty();
    if (!Array.isArray(d.subjects) || !d.subjects.length) d.subjects = DEFAULT_SUBJECTS.map(s => ({ ...s }));
    if (!d.scores || typeof d.scores !== 'object') d.scores = {};
    if (!d.nextId) d.nextId = { student: 1, exam: 1, event: 1 };
    if (!Array.isArray(d.students)) d.students = [];
    if (!Array.isArray(d.exams)) d.exams = [];
    d.students.forEach(s => {
      if (!s.subjects) s.subjects = {};
      if (!s.life) s.life = {};
      if (!Array.isArray(s.events)) s.events = [];
    });
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
  function hasData() { return !!(data.students.length || data.exams.length); }
  function className() { return data.className || ''; }
  function setClassName(v) { data.className = v; save(); }

  /* ---------- 科目 ---------- */
  function listSubjects() { return data.subjects; }
  function fullOf(name) {
    const s = data.subjects.find(x => x.name === name);
    return s ? Number(s.full) || 100 : 100;
  }
  function setSubjects(list) { data.subjects = list; save(); }

  /* ---------- 学生 ---------- */
  function listStudents() { return data.students; }
  function getStudent(id) { return data.students.find(s => s.id === id) || null; }

  function addStudent(info) {
    const st = {
      id: 's' + (data.nextId.student++),
      name: info.name || '未命名',
      studentNo: info.studentNo || '',
      gender: info.gender || '',
      seat: info.seat || '',
      birthday: info.birthday || '',
      dorm: info.dorm || '',
      phone: info.phone || '',
      parentPhone: info.parentPhone || '',
      notes: info.notes || '',
      subjects: {},
      life: {},
      events: [],
      createdAt: Date.now()
    };
    data.students.push(st);
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
    data.students = data.students.filter(s => s.id !== id);
    delete data.scores[id];
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

  /* 生活情况：s.life = {personality, hobbies, family, relations, psychology, health, notes} */
  function setLifeInfo(id, info) {
    const s = getStudent(id);
    if (!s) return;
    Object.assign(s.life, info);
    save();
  }

  /* 成长记录 */
  function addEvent(id, ev) {
    const s = getStudent(id);
    if (!s) return null;
    const item = { id: 'ev' + (data.nextId.event++), date: ev.date || '', title: ev.title || '', detail: ev.detail || '' };
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
    return data.exams.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  function getExam(id) { return data.exams.find(e => e.id === id) || null; }
  function latestExam() {
    const list = listExams();
    return list.length ? list[list.length - 1] : null;
  }
  function addExam(info) {
    const e = {
      id: 'e' + (data.nextId.exam++),
      name: info.name || '未命名考试',
      date: info.date || '',
      type: info.type || '月考',
      subjects: (info.subjects && info.subjects.length) ? info.subjects.slice() : data.subjects.map(s => s.name)
    };
    data.exams.push(e);
    save();
    return e;
  }
  function updateExam(id, patch) {
    const e = getExam(id);
    if (!e) return null;
    Object.keys(patch).forEach(k => { if (k !== 'id') e[k] = patch[k]; });
    save();
    return e;
  }
  function deleteExam(id) {
    data.exams = data.exams.filter(e => e.id !== id);
    Object.keys(data.scores).forEach(sid => { delete data.scores[sid][id]; });
    save();
  }
  function examFullSum(exam) {
    return exam.subjects.reduce((t, n) => t + fullOf(n), 0);
  }

  /* ---------- 成绩 ---------- */
  function getScore(sid, eid, subj) {
    const m = data.scores[sid] && data.scores[sid][eid];
    return m ? (m[subj] == null ? null : m[subj]) : null;
  }
  function setScore(sid, eid, subj, val) {
    if (!data.scores[sid]) data.scores[sid] = {};
    if (!data.scores[sid][eid]) data.scores[sid][eid] = {};
    data.scores[sid][eid][subj] = (val === null || val === '' || val === undefined) ? null : Number(val);
    save();
  }

  /* 单个学生某次考试的总分与已录入科目数 */
  function studentTotal(sid, eid, subjectNames) {
    const m = data.scores[sid] && data.scores[sid][eid];
    if (!m) return null;
    let total = 0, count = 0;
    subjectNames.forEach(n => {
      const v = m[n];
      if (typeof v === 'number' && isFinite(v)) { total += v; count++; }
    });
    return count ? { total, count } : null;
  }

  /* 某次考试排名（按总分降序，同分同名次） */
  function examRankings(eid) {
    const exam = getExam(eid);
    if (!exam) return [];
    const rows = [];
    data.students.forEach(s => {
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

  /* 某次考试各科班级平均分；_overall 为总体平均（所有学生所有科目） */
  function classAvg(eid) {
    const exam = getExam(eid);
    const out = { _overall: null };
    if (!exam) return out;
    const sums = {}, counts = {};
    exam.subjects.forEach(n => { sums[n] = 0; counts[n] = 0; });
    data.students.forEach(s => {
      const m = data.scores[s.id] && data.scores[s.id][eid];
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

  /* ---------- 示例数据 ---------- */
  function seedDemo() {
    reset();
    const names = ['王思远', '李雨桐', '张浩然', '刘欣怡', '陈子墨', '赵一诺', '孙嘉豪', '周诗涵',
      '吴宇航', '郑晓彤', '钱博文', '冯若曦', '蒋天佑', '韩静怡', '杨明轩', '朱可欣',
      '秦少杰', '许梦琪', '何俊熙', '吕欣然', '施文博', '孔慧敏', '曹骏驰', '严雨欣'];
    names.forEach((n, i) => {
      addStudent({
        name: n,
        studentNo: String(i + 1).padStart(2, '0'),
        gender: i % 2 ? '女' : '男',
        seat: String(i + 1)
      });
    });
    const examDefs = [
      { name: '2025年9月月考', date: '2025-09-25', type: '月考' },
      { name: '2025年10月期中', date: '2025-10-30', type: '期中' },
      { name: '2025年11月月考', date: '2025-11-27', type: '月考' },
      { name: '2025年12月月考', date: '2025-12-25', type: '月考' },
      { name: '2026年1月期末', date: '2026-01-22', type: '期末' }
    ];
    examDefs.forEach(d => addExam({ ...d, subjects: data.subjects.map(s => s.name) }));

    const subjects = data.subjects;
    data.students.forEach(s => {
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
      if (Math.random() < 0.4) {
        s.events.push({
          id: 'ev' + (data.nextId.event++),
          date: '2025-10-15',
          title: '班级活动表现积极',
          detail: '运动会中积极参与，为班级争取荣誉。'
        });
      }
    });

    data.exams.forEach((exam, ei) => {
      data.students.forEach(s => {
        const m = {};
        subjects.forEach(sub => {
          let ab = s._ability[sub.name] + ei * 0.012 + (Math.random() * 0.1 - 0.05);
          ab = Math.min(0.98, Math.max(0.3, ab));
          m[sub.name] = Math.round(ab * sub.full);
        });
        if (!data.scores[s.id]) data.scores[s.id] = {};
        data.scores[s.id][exam.id] = m;
      });
    });
    data.students.forEach(s => { delete s._ability; });
    save();
  }

  return {
    load, save, raw, replace, reset, hasData,
    className, setClassName,
    listSubjects, fullOf, setSubjects,
    listStudents, getStudent, addStudent, updateStudent, deleteStudent,
    setSubjectInfo, setLifeInfo, addEvent, deleteEvent,
    listExams, getExam, latestExam, addExam, updateExam, deleteExam, examFullSum,
    getScore, setScore, studentTotal, examRankings, classAvg,
    seedDemo
  };
})();
