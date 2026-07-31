/**
 * Космонавт — калибровка «мерила» оценки.
 * Создаёт Google-форму со всей анкетой (docs/simulation-survey-criteria.md).
 *
 * КАК ЗАПУСТИТЬ:
 * 1. Открой https://script.google.com → New project.
 * 2. Удали содержимое Code.gs, вставь весь этот файл.
 * 3. Нажми Run (функция buildSurvey). Разреши доступ, когда попросит.
 * 4. Открой View → Logs (Ctrl+Enter). Там будут две ссылки:
 *    - EDIT  — редактировать форму;
 *    - LIVE  — та, что рассылаешь респондентам.
 */
function buildSurvey() {
  var form = FormApp.create('Космонавт — калибровка оценки управленческой готовности')
    .setDescription(
      'Мы настраиваем управленческий тренажёр по вашим меркам, а не по чужим. ' +
      'Ответьте, как вы на практике оцениваете и реагируете на управленческие действия ' +
      'подчинённых на позициях ЗУМ, старшего продавца, ВРИО/ИО. ' +
      'Просьба описывать, что человек ДЕЛАЛ и как вы на это реагируете, без оценок-прилагательных. ' +
      'Форма анонимная, ~15–20 минут.'
    )
    .setProgressBar(true)
    .setCollectEmail(false);

  var Z = [
    '1. Основы менеджмента',
    '2. Бизнес-процессы',
    '3. Финансовые показатели филиала',
    '4. Задачи сотрудников магазина',
    '5. Идеология Компании'
  ];
  var U = [
    '6. Организация и контроль работы',
    '7. Системность мышления',
    '8. Коммуникабельность',
    '9. Мотивация сотрудников',
    '10. Обучение сотрудников'
  ];
  var L = [
    '11. Объективная самооценка',
    '12. Гибкость поведения',
    '13. Личная мотивация к обучению и новым обязанностям',
    '14. Направленность на результат'
  ];
  var ALL14 = Z.concat(U).concat(L);
  var SCALE = ['1', '2', '3', '4', '5'];

  // ---- Секция 1. Профиль ----
  form.addPageBreakItem().setTitle('1. О вас').setHelpText('Анонимно, для группировки ответов.');
  form.addMultipleChoiceItem().setTitle('Ваша роль').setRequired(true)
    .setChoiceValues(['Управляющий магазином', 'Региональный руководитель', 'Наставник', 'Другое']);
  form.addTextItem().setTitle('Дивизион / РРС').setRequired(true);
  form.addMultipleChoiceItem().setTitle('Сколько подчинённых/кандидатов вы оценивали за последний год')
    .setRequired(true).setChoiceValues(['0', '1–3', '4–10', '10+']);

  // ---- Секция 2. Критические инциденты ----
  form.addPageBreakItem().setTitle('2. Реальные случаи')
    .setHelpText('Опишите КОНКРЕТНЫЕ действия, а не общие впечатления.');
  form.addParagraphTextItem().setRequired(true).setTitle(
    'Случай, когда подчинённый СИЛЬНО проявил себя в управленческой ситуации. ' +
    'Что именно он сделал и как вы отреагировали / как это повлияло на вашу оценку?');
  form.addParagraphTextItem().setRequired(true).setTitle(
    'Случай СЛАБОГО управленческого поведения. Что он сделал или НЕ сделал и какой была ваша реакция?');

  // ---- Секция 3. Веса ----
  form.addPageBreakItem().setTitle('3. Что важнее для готовности к роли')
    .setHelpText('Сначала распределите вес между блоками, затем оцените важность внутри.');

  var num = FormApp.createTextValidation().requireNumberBetween(0, 100)
    .setHelpText('Введите число от 0 до 100.').build();
  form.addTextItem().setTitle('Блок «Знания» — сколько баллов из 100').setRequired(true).setValidation(num);
  form.addTextItem().setTitle('Блок «Умения» — сколько баллов из 100').setRequired(true).setValidation(num);
  form.addTextItem().setTitle('Блок «Личностные качества» — сколько баллов из 100').setRequired(true).setValidation(num);
  form.addSectionHeaderItem().setTitle('Сумма трёх блоков должна равняться 100.');

  form.addGridItem().setTitle('Важность компетенций блока «Знания» (1 — второстепенно, 5 — критично)')
    .setRequired(true).setRows(Z).setColumns(SCALE);
  form.addGridItem().setTitle('Важность компетенций блока «Умения» (1–5)')
    .setRequired(true).setRows(U).setColumns(SCALE);
  form.addGridItem().setTitle('Важность компетенций блока «Личностные качества» (1–5)')
    .setRequired(true).setRows(L).setColumns(SCALE);

  var exactly3 = FormApp.createCheckboxValidation().requireSelectExactly(3).build();
  form.addCheckboxItem()
    .setTitle('Отметьте 3 компетенции-СТОП-ФАКТОРА — без которых человека нельзя ставить на роль')
    .setRequired(true).setChoiceValues(ALL14).setValidation(exactly3);

  // ---- Секция 4. Поведенческие якоря ----
  form.addPageBreakItem().setTitle('4. Как это выглядит в действии')
    .setHelpText('Раскройте те компетенции, которые вы цените выше всего.');
  form.addCheckboxItem()
    .setTitle('Выберите 3 компетенции (из самых важных для вас), которые детализируете ниже')
    .setRequired(true).setChoiceValues(ALL14).setValidation(exactly3);
  for (var i = 1; i <= 3; i++) {
    form.addParagraphTextItem().setRequired(true)
      .setTitle('Компетенция #' + i + ' — СИЛЬНО выглядит в действии так:');
    form.addParagraphTextItem().setRequired(true)
      .setTitle('Компетенция #' + i + ' — СЛАБО выглядит в действии так:');
  }

  // ---- Секция 5. Реакция руководителя ----
  form.addPageBreakItem().setTitle('5. Ваша реакция');
  form.addParagraphTextItem().setRequired(true).setTitle(
    'Когда подчинённый принимает быстрое, но рискованное решение ради результата — ' +
    'как вы реагируете и как это влияет на вашу оценку?');
  form.addParagraphTextItem().setRequired(true).setTitle(
    'Что в поведении подчинённого сильнее всего роняет ваше доверие к его управленческой готовности?');

  Logger.log('EDIT: ' + form.getEditUrl());
  Logger.log('LIVE: ' + form.getPublishedUrl());
}
