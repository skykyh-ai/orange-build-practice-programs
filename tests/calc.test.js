/* 검증용: node tests/calc.test.js  (ES5 문법. Node 없이 WSH 등에서 돌릴 때는 전역 Calc, SAMPLE_FILES, ERROR_SAMPLE, out(msg)을 미리 정의) */
var Calc, SAMPLE_FILES, ERROR_SAMPLE, report;
if (typeof module !== 'undefined' && typeof require === 'function') {
  Calc = require('../js/calc.js');
  var D = require('../js/data.js');
  SAMPLE_FILES = D.SAMPLE_FILES; ERROR_SAMPLE = D.ERROR_SAMPLE;
  report = function (m) { console.log(m); };
} else {
  Calc = this.Calc; SAMPLE_FILES = this.SAMPLE_FILES; ERROR_SAMPLE = this.ERROR_SAMPLE;
  report = this.out;
}

var fails = 0, total = 0;
function eq(name, actual, expected) {
  total++;
  var ok = String(actual) === String(expected);
  if (!ok) fails++;
  report((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' got=' + actual + ' expected=' + expected));
}
function near(name, actual, expected) {
  total++;
  var ok = actual !== null && Math.abs(actual - expected) < 1e-9;
  if (!ok) fails++;
  report((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' got=' + actual + ' expected=' + expected));
}

// 정상 3파일
var r = Calc.loadFiles(SAMPLE_FILES);
eq('normal valid rows', r.valid.length, 18);
eq('normal excluded', r.excluded.length, 0);
eq('normal errors', r.errors.length, 0);
eq('first row line', r.valid[0].line + '/' + r.valid[0].file, '2/2024.csv');
var s = Calc.summarize(r.valid, 70);
eq('sum p/c', s['참여자합계'] + '/' + s['수료자합계'], '1410/1171');
eq('rate fmt', Calc.formatRate(s['전체수료율']), '83.0%');
near('rate raw not rounded', s['전체수료율'], 1171 / 1410 * 100);
eq('programs/years', s['사업수'] + '/' + s['연도수'], '6/3');
eq('warn@70', s['주의수'], 1);
eq('warn@80', Calc.summarize(r.valid, 80)['주의수'], 8);
eq('judge exact threshold', Calc.judge(70, 70), '정상');
eq('judge below', Calc.judge(68, 70), '주의');
eq('judge null', Calc.judge(null, 70), '계산 불가');

var y = Calc.byYear(r.valid);
eq('byYear', y.map(function (e) { return e['연도'] + ':' + e['참여자수'] + '/' + e['수료자수'] + '/' + Calc.formatRate(e['수료율']); }).join(' '),
  '2024:400/320/80.0% 2025:470/388/82.6% 2026:540/463/85.7%');
var p = Calc.byProgram(r.valid);
eq('byProgram', p.map(function (e) { return e['사업ID'] + ':' + e['참여자수'] + '/' + e['수료자수']; }).join(' '),
  'P01:270/211 P02:240/200 P03:180/129 P04:345/322 P05:225/199 P06:150/110');
var f = Calc.byField(r.valid);
eq('byField', f.map(function (e) { return e['분야'] + ':' + e['참여자수']; }).join(' '), '교육:510 일자리:525 지역사회:375');
eq('byField pct', f.map(function (e) { return e['비율'].toFixed(1); }).join(' '), '36.2 37.2 26.6');

// 2025만 필터
var f25 = Calc.filterRows(r.valid, [2025]);
var s25 = Calc.summarize(f25, 70);
eq('2025 rows', f25.length, 6);
eq('2025 summary', s25['참여자합계'] + '/' + s25['수료자합계'] + '/' + Calc.formatRate(s25['전체수료율']) + '/' + s25['사업수'] + '/' + s25['연도수'] + '/' + s25['주의수'], '470/388/82.6%/6/1/0');
eq('filter empty years', Calc.filterRows(r.valid, []).length, 0);
var sEmpty = Calc.summarize([], 70);
eq('empty summary', sEmpty['참여자합계'] + '/' + sEmpty['전체수료율'] + '/' + Calc.formatRate(sEmpty['전체수료율']), '0/null/계산 불가');
eq('byField empty', Calc.byField([]).map(function (e) { return e['분야'] + e['참여자수'] + e['비율']; }).join(' '), '교육0null 일자리0null 지역사회0null');

// toCSV 왕복
var csv = Calc.toCSV(r.valid);
eq('csv BOM', csv.charCodeAt(0), 0xFEFF);
eq('csv header', csv.slice(1).split('\r\n')[0], Calc.COLUMNS.join(','));
var r2 = Calc.loadFiles([{ name: 'out.csv', text: csv }]);
eq('roundtrip rows', r2.valid.length + '/' + r2.excluded.length + '/' + r2.errors.length, '18/0/0');
var s2 = Calc.summarize(r2.valid, 70);
eq('roundtrip summary', s2['참여자합계'] + '/' + s2['수료자합계'] + '/' + s2['사업수'] + '/' + s2['주의수'], '1410/1171/6/1');
eq('csv 2025 only roundtrip', Calc.loadFiles([{ name: 'o.csv', text: Calc.toCSV(f25) }]).valid.length, 6);

// errors.csv
var e = Calc.loadFiles([ERROR_SAMPLE]);
eq('err valid/excluded', e.valid.length + '/' + e.excluded.length, '2/3');
eq('err reasons', e.excluded.map(function (x) { return x.line + ':' + x.reason; }).join(' | '),
  '3:중복(연도+사업ID) | 4:숫자 누락 | 6:수료자가 참여자보다 많음');
eq('err raw len', e.excluded[0].raw.length, 7);
var se = Calc.summarize(e.valid, 70);
eq('err summary', se['참여자합계'] + '/' + se['수료자합계'] + '/' + Calc.formatRate(se['전체수료율']) + '/' + se['사업수'] + '/' + se['주의수'], '20/15/75.0%/2/0');
eq('err @80 warn', Calc.summarize(e.valid, 80)['주의수'], 1);
eq('zero row', e.valid[1]['수료율'] + '/' + Calc.formatRate(e.valid[1]['수료율']) + '/' + Calc.judge(e.valid[1]['수료율'], 70), 'null/계산 불가/계산 불가');
var csvE = Calc.loadFiles([{ name: 'e2.csv', text: Calc.toCSV(e.valid) }]);
eq('err roundtrip', csvE.valid.length + '/' + csvE.excluded.length, '2/0');

// 파서 / 기타 규칙
var q = Calc.parseCSV('﻿a,b\r\n"x,1","he said ""hi"""\r\n');
eq('parse quotes', q[1][0] + '|' + q[1][1], 'x,1|he said "hi"');
var bad = Calc.loadFiles([{ name: 'bad.csv', text: 'a,b,c\n1,2,3\n' }]);
eq('header mismatch', bad.errors.length + '/' + bad.valid.length, '1/0');
var h = Calc.COLUMNS.join(',');
var m = Calc.loadFiles([{ name: 'm.csv', text: h + '\n2024,A1,"Name, with comma",교육,서울,10,5\n\n2024,A2,n,교육,서울,1.5,1\n2024,A3,n,교육,서울,-1,0\n2024,A4,n,교육,서울,x,0\n2024,A1,n,교육,서울,10,5\n2024,B1,n,기타,서울,5,5' }]);
eq('misc valid/excl', m.valid.length + '/' + m.excluded.length, '2/4');
eq('misc reasons', m.excluded.map(function (x) { return x.line + ':' + x.reason; }).join(' | '),
  '4:정수가 아니거나 음수 | 5:정수가 아니거나 음수 | 6:정수가 아니거나 음수 | 7:중복(연도+사업ID)');
eq('quoted csv out', Calc.toCSV(m.valid).split('\r\n')[1], '2024,A1,"Name, with comma",교육,서울,10,5');
eq('unknown field appended', Calc.byField(m.valid).map(function (x) { return x['분야']; }).join(','), '교육,일자리,지역사회,기타');
// 무효로 제외된 행은 중복의 첫 행이 되지 않음
var inv = Calc.loadFiles([{ name: 'i.csv', text: h + '\n2024,Z,n,교육,서울,5,9\n2024,Z,n,교육,서울,5,4\n2024,Z,n,교육,서울,5,4' }]);
eq('invalid not first', inv.valid.length + '/' + inv.excluded.map(function (x) { return x.reason; }).join(','), '1/수료자가 참여자보다 많음,중복(연도+사업ID)');
// 필수값(연도·사업ID·사업명·분야) 누락: 숫자 누락보다 먼저 판정
var req = Calc.loadFiles([{ name: 'r.csv', text: h + '\n2024,,n,교육,서울,5,4\n,R2,n,교육,서울,5,4\n2024,R3,,교육,서울,5,4\n2024,R4,n,,서울,5,4\n2024,R5,n,교육,,5,4\n2024,,n,교육,서울,,4' }]);
eq('required valid (region may be empty)', req.valid.length + '/' + req.valid[0]['사업ID'], '1/R5');
eq('required reasons', req.excluded.map(function (x) { return x.line + ':' + x.reason; }).join(' | '),
  '2:필수값 누락 | 3:필수값 누락 | 4:필수값 누락 | 5:필수값 누락 | 7:필수값 누락');
eq('colors', Calc.FIELD_COLORS['교육'] + Calc.FIELD_COLORS['일자리'] + Calc.FIELD_COLORS['지역사회'], '#2563eb#f59e0b#16a34a');

report((fails ? 'FAILED ' : 'ALL PASSED ') + (total - fails) + '/' + total);
if (typeof process !== 'undefined' && fails) process.exitCode = 1;
