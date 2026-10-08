/* calc.js - CSV 읽기 / 검증 / 계산 (기준: docs/criteria.md)
 * 일반 <script>로 로드. 전역 window.Calc. Node에서는 module.exports 로도 사용 가능.
 */
(function (root) {
  'use strict';

  var COLUMNS = ['연도', '사업ID', '사업명', '분야', '지역', '참여자수', '수료자수'];
  var FIELDS = ['교육', '일자리', '지역사회'];
  var FIELD_COLORS = { '교육': '#2563eb', '일자리': '#f59e0b', '지역사회': '#16a34a' };

  var REASON_REQUIRED = '필수값 누락';
  var REASON_MISSING ='숫자 누락';
  var REASON_INVALID = '정수가 아니거나 음수';
  var REASON_OVER = '수료자가 참여자보다 많음';
  var REASON_DUP = '중복(연도+사업ID)';

  // 내부: 레코드와 시작 물리 행 번호를 함께 반환
  function parseRecords(text) {
    text = String(text == null ? '' : text);
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var rows = [];
    var lines = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var line = 1;        // 현재 물리 행
    var startLine = 1;   // 현재 레코드가 시작한 행
    var i = 0;
    var n = text.length;
    var ch;

    function endRecord() {
      row.push(field);
      field = '';
      rows.push(row);
      lines.push(startLine);
      row = [];
    }

    while (i < n) {
      ch = text.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        if (ch === '\r') {
          if (text.charAt(i + 1) === '\n') i++;
          field += '\n'; line++; i++; continue;
        }
        if (ch === '\n') line++;
        field += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && text.charAt(i + 1) === '\n') i++;
        endRecord();
        line++;
        startLine = line;
        i++;
        continue;
      }
      field += ch; i++;
    }
    // 마지막 줄(개행 없이 끝난 경우)
    if (field !== '' || row.length > 0) endRecord();
    return { rows: rows, lines: lines };
  }

  function parseCSV(text) {
    return parseRecords(text).rows;
  }

  function trim(s) {
    return String(s == null ? '' : s).replace(/^\s+|\s+$/g, '');
  }

  function isBlankRecord(rec) {
    var k;
    for (k = 0; k < rec.length; k++) {
      if (trim(rec[k]) !== '') return false;
    }
    return true;
  }

  function isNonNegInt(s) {
    return /^[0-9]+$/.test(s);
  }

  function rateOf(part, whole) {
    if (!whole) return null;
    return part / whole * 100;
  }

  function loadFiles(files) {
    var valid = [];
    var excluded = [];
    var errors = [];
    var seen = {}; // 유효로 남은 (연도+사업ID)
    var f, name, parsed, header, r, rec, line, raw, k;
    var yearS, idS, partS, compS, part, comp, year, reason;

    files = files || [];
    for (f = 0; f < files.length; f++) {
      name = files[f].name;
      parsed = parseRecords(files[f].text);
      if (parsed.rows.length === 0) {
        errors.push(name + ': 파일이 비어 있어 건너뜀');
        continue;
      }
      header = parsed.rows[0];
      var headerOk = header.length === COLUMNS.length;
      if (headerOk) {
        for (k = 0; k < COLUMNS.length; k++) {
          if (trim(header[k]) !== COLUMNS[k]) { headerOk = false; break; }
        }
      }
      if (!headerOk) {
        errors.push(name + ': 헤더가 "' + COLUMNS.join(',') + '"와 다름(1행: ' +
          header.join(',') + ')');
        continue;
      }
      for (r = 1; r < parsed.rows.length; r++) {
        rec = parsed.rows[r];
        line = parsed.lines[r];
        if (isBlankRecord(rec)) continue;
        raw = [];
        for (k = 0; k < COLUMNS.length; k++) raw.push(rec[k] === undefined ? '' : rec[k]);

        yearS = trim(raw[0]);
        idS = trim(raw[1]);
        partS = trim(raw[5]);
        compS = trim(raw[6]);
        reason = null;

        if (yearS === '' || idS === '' || trim(raw[2]) === '' || trim(raw[3]) === '') {
          reason = REASON_REQUIRED;
        } else if (partS === '' || compS === '') {
          reason = REASON_MISSING;
        } else if (!isNonNegInt(partS) || !isNonNegInt(compS) || !isNonNegInt(yearS)) {
          // 연도가 정수가 아닌 경우도 같은 이유 문구 사용(기준 문서에 별도 문구 없음)
          reason = REASON_INVALID;
        } else {
          part = parseInt(partS, 10);
          comp = parseInt(compS, 10);
          year = parseInt(yearS, 10);
          if (comp > part) {
            reason = REASON_OVER;
          } else if (seen[year + '|' + idS]) {
            reason = REASON_DUP;
          }
        }

        if (reason) {
          excluded.push({ file: name, line: line, raw: raw, reason: reason });
          continue;
        }
        seen[year + '|' + idS] = true;
        valid.push({
          '연도': year,
          '사업ID': idS,
          '사업명': trim(raw[2]),
          '분야': trim(raw[3]),
          '지역': trim(raw[4]),
          '참여자수': part,
          '수료자수': comp,
          '수료율': rateOf(comp, part),
          file: name,
          line: line
        });
      }
    }
    return { valid: valid, excluded: excluded, errors: errors };
  }

  function judge(rate, threshold) {
    if (rate === null || rate === undefined || isNaN(rate)) return '계산 불가';
    return rate < threshold ? '주의' : '정상';
  }

  function filterRows(valid, years) {
    var out = [];
    var set = {};
    var i;
    years = years || [];
    for (i = 0; i < years.length; i++) set[Number(years[i])] = true;
    for (i = 0; i < valid.length; i++) {
      if (set[valid[i]['연도']]) out.push(valid[i]);
    }
    return out;
  }

  function summarize(rows, threshold) {
    var p = 0, c = 0, warn = 0, i;
    var ids = {}, yrs = {}, nIds = 0, nYrs = 0;
    for (i = 0; i < rows.length; i++) {
      p += rows[i]['참여자수'];
      c += rows[i]['수료자수'];
      if (!ids[rows[i]['사업ID']]) { ids[rows[i]['사업ID']] = true; nIds++; }
      if (!yrs[rows[i]['연도']]) { yrs[rows[i]['연도']] = true; nYrs++; }
      if (judge(rateOf(rows[i]['수료자수'], rows[i]['참여자수']), threshold) === '주의') warn++;
    }
    return {
      '참여자합계': p,
      '수료자합계': c,
      '전체수료율': rateOf(c, p),
      '사업수': nIds,
      '연도수': nYrs,
      '주의수': warn
    };
  }

  function byField(rows) {
    var sums = {};
    var order = FIELDS.slice();
    var total = 0, i, name;
    for (i = 0; i < FIELDS.length; i++) sums[FIELDS[i]] = 0;
    for (i = 0; i < rows.length; i++) {
      name = rows[i]['분야'];
      if (!Object.prototype.hasOwnProperty.call(sums, name)) { sums[name] = 0; order.push(name); }
      sums[name] += rows[i]['참여자수'];
      total += rows[i]['참여자수'];
    }
    var out = [];
    for (i = 0; i < order.length; i++) {
      out.push({
        '분야': order[i],
        '참여자수': sums[order[i]],
        '비율': total ? sums[order[i]] / total * 100 : null
      });
    }
    return out;
  }

  function byProgram(rows) {
    var map = {}, list = [], i, id, e;
    for (i = 0; i < rows.length; i++) {
      id = rows[i]['사업ID'];
      if (!Object.prototype.hasOwnProperty.call(map, id)) {
        map[id] = { '사업ID': id, '사업명': rows[i]['사업명'], '참여자수': 0, '수료자수': 0 };
        list.push(map[id]);
      }
      e = map[id];
      e['참여자수'] += rows[i]['참여자수'];
      e['수료자수'] += rows[i]['수료자수'];
    }
    list.sort(function (a, b) { return a['사업ID'] < b['사업ID'] ? -1 : (a['사업ID'] > b['사업ID'] ? 1 : 0); });
    return list;
  }

  function byYear(rows) {
    var map = {}, list = [], i, y, e;
    for (i = 0; i < rows.length; i++) {
      y = rows[i]['연도'];
      if (!Object.prototype.hasOwnProperty.call(map, y)) {
        map[y] = { '연도': y, '참여자수': 0, '수료자수': 0, '수료율': null };
        list.push(map[y]);
      }
      e = map[y];
      e['참여자수'] += rows[i]['참여자수'];
      e['수료자수'] += rows[i]['수료자수'];
    }
    for (i = 0; i < list.length; i++) list[i]['수료율'] = rateOf(list[i]['수료자수'], list[i]['참여자수']);
    list.sort(function (a, b) { return a['연도'] - b['연도']; });
    return list;
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCSV(rows) {
    var out = [COLUMNS.join(',')];
    var i, k, cells;
    for (i = 0; i < rows.length; i++) {
      cells = [];
      for (k = 0; k < COLUMNS.length; k++) cells.push(csvCell(rows[i][COLUMNS[k]]));
      out.push(cells.join(','));
    }
    return '﻿' + out.join('\r\n') + '\r\n';
  }

  function formatRate(rate) {
    if (rate === null || rate === undefined || isNaN(rate)) return '계산 불가';
    return rate.toFixed(1) + '%';
  }

  var Calc = {
    COLUMNS: COLUMNS,
    FIELDS: FIELDS,
    FIELD_COLORS: FIELD_COLORS,
    parseCSV: parseCSV,
    loadFiles: loadFiles,
    judge: judge,
    filterRows: filterRows,
    summarize: summarize,
    byField: byField,
    byProgram: byProgram,
    byYear: byYear,
    toCSV: toCSV,
    formatRate: formatRate
  };

  root.Calc = Calc;
  if (typeof module !== 'undefined' && module.exports) module.exports = Calc;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
