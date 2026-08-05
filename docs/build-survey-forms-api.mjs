/**
 * Космонавт — калибровка «мерила». Создаёт Google-форму через Forms REST API.
 *
 * ЗАПУСК:
 *   FORMS_TOKEN=<access-token> GCP_PROJECT=<project-id> node docs/build-survey-forms-api.mjs
 *
 * Токен нужен со scope https://www.googleapis.com/auth/forms.body.
 * Быстрее всего:
 *   gcloud auth application-default login --scopes="https://www.googleapis.com/auth/forms.body,https://www.googleapis.com/auth/cloud-platform"
 *   gcloud services enable forms.googleapis.com
 *   gcloud auth application-default print-access-token
 *
 * ОГРАНИЧЕНИЕ Forms API: нельзя задать числовую валидацию (0–100) и правило «ровно 3».
 * Эти проверки станут текстовыми подсказками. Сетки, секции, все типы вопросов — поддержаны.
 */

const TOKEN = process.env.FORMS_TOKEN;
const PROJECT = process.env.GCP_PROJECT;
if (!TOKEN || !PROJECT) {
  console.error('Нужны переменные FORMS_TOKEN и GCP_PROJECT.');
  process.exit(1);
}

const H = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  'x-goog-user-project': PROJECT,
};

const Z = ['1. Основы менеджмента', '2. Бизнес-процессы', '3. Финансовые показатели филиала', '4. Задачи сотрудников магазина', '5. Идеология Компании'];
const U = ['6. Организация и контроль работы', '7. Системность мышления', '8. Коммуникабельность', '9. Мотивация сотрудников', '10. Обучение сотрудников'];
const L = ['11. Объективная самооценка', '12. Гибкость поведения', '13. Личная мотивация к обучению и новым обязанностям', '14. Направленность на результат'];
const ALL14 = [...Z, ...U, ...L];
const SCALE = ['1', '2', '3', '4', '5'];

const page = (t, d) => ({ title: t, description: d, pageBreakItem: {} });
const para = (t) => ({ title: t, questionItem: { question: { required: true, textQuestion: { paragraph: true } } } });
const short = (t) => ({ title: t, questionItem: { question: { required: true, textQuestion: { paragraph: false } } } });
const radio = (t, opts) => ({ title: t, questionItem: { question: { required: true, choiceQuestion: { type: 'RADIO', options: opts.map((v) => ({ value: v })) } } } });
const checks = (t, opts) => ({ title: t, questionItem: { question: { required: true, choiceQuestion: { type: 'CHECKBOX', options: opts.map((v) => ({ value: v })) } } } });
const note = (t) => ({ title: t, textItem: {} });
const grid = (t, rows) => ({ title: t, questionGroupItem: { questions: rows.map((r) => ({ required: true, rowQuestion: { title: r } })), grid: { columns: { type: 'RADIO', options: SCALE.map((v) => ({ value: v })) } } } });

const items = [
  page('1. О вас', 'Анонимно, для группировки ответов.'),
  radio('Ваша роль', ['Управляющий магазином', 'Региональный руководитель', 'Наставник', 'Другое']),
  short('Дивизион / РРС'),
  radio('Сколько подчинённых/кандидатов вы оценивали за последний год', ['0', '1–3', '4–10', '10+']),

  page('2. Реальные случаи', 'Опишите КОНКРЕТНЫЕ действия, а не общие впечатления.'),
  para('Случай, когда подчинённый СИЛЬНО проявил себя. Что именно он сделал и как вы отреагировали / как это повлияло на вашу оценку?'),
  para('Случай СЛАБОГО управленческого поведения. Что он сделал или НЕ сделал и какой была ваша реакция?'),

  page('3. Что важнее для готовности к роли', 'Сначала распределите вес между блоками, затем оцените важность внутри.'),
  short('Блок «Знания» — сколько баллов из 100'),
  short('Блок «Умения» — сколько баллов из 100'),
  short('Блок «Личностные качества» — сколько баллов из 100'),
  note('Сумма трёх блоков должна равняться 100.'),
  grid('Важность компетенций блока «Знания» (1 — второстепенно, 5 — критично)', Z),
  grid('Важность компетенций блока «Умения» (1–5)', U),
  grid('Важность компетенций блока «Личностные качества» (1–5)', L),
  checks('Отметьте 3 компетенции-СТОП-ФАКТОРА — без которых человека нельзя ставить на роль (ровно 3)', ALL14),

  page('4. Как это выглядит в действии', 'Раскройте те компетенции, которые цените выше всего.'),
  checks('Выберите 3 компетенции (из самых важных для вас) для детализации ниже (ровно 3)', ALL14),
  para('Компетенция #1 — СИЛЬНО выглядит в действии так:'),
  para('Компетенция #1 — СЛАБО выглядит в действии так:'),
  para('Компетенция #2 — СИЛЬНО выглядит в действии так:'),
  para('Компетенция #2 — СЛАБО выглядит в действии так:'),
  para('Компетенция #3 — СИЛЬНО выглядит в действии так:'),
  para('Компетенция #3 — СЛАБО выглядит в действии так:'),

  page('5. Ваша реакция'),
  para('Когда подчинённый принимает быстрое, но рискованное решение ради результата — как вы реагируете и как это влияет на вашу оценку?'),
  para('Что в поведении подчинённого сильнее всего роняет ваше доверие к его управленческой готовности?'),
];

async function main() {
  // 1. Создать форму (при создании допустим только info.title)
  let r = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST', headers: H,
    body: JSON.stringify({ info: { title: 'Космонавт — калибровка оценки управленческой готовности' } }),
  });
  if (!r.ok) throw new Error('create: ' + r.status + ' ' + (await r.text()));
  const form = await r.json();
  const id = form.formId;

  // 2. Наполнить: описание + все элементы по индексам
  const requests = [
    { updateFormInfo: { info: { description: 'Мы настраиваем управленческий тренажёр по вашим меркам. Опишите, что человек ДЕЛАЛ и как вы на это реагируете, без оценок-прилагательных. Форма анонимная, ~15–20 минут.' }, updateMask: 'description' } },
    ...items.map((item, i) => ({ createItem: { item, location: { index: i } } })),
  ];
  r = await fetch(`https://forms.googleapis.com/v1/forms/${id}:batchUpdate`, {
    method: 'POST', headers: H, body: JSON.stringify({ requests }),
  });
  if (!r.ok) throw new Error('batchUpdate: ' + r.status + ' ' + (await r.text()));

  const got = await (await fetch(`https://forms.googleapis.com/v1/forms/${id}`, { headers: H })).json();
  console.log('\nГОТОВО.');
  console.log('EDIT:      https://docs.google.com/forms/d/' + id + '/edit');
  console.log('LIVE:      ' + (got.responderUri || '(опубликуй через кнопку Send в редакторе)'));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
