(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var BAR_COLORS = { 참여: '#94a3b8', 수료: '#0d9488' };
  var LINE_COLOR = '#7c3aed';
  var THRESH_COLOR = '#b91c1c';

  var state = {
    files: [],          // [{name,text}]
    sourceLabel: '',
    loaded: null,       // Calc.loadFiles result
    years: [],          // 자료에 있는 연도(오름차순)
    selected: {}        // 연도 -> boolean
  };
  var lastRows = [];

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return Number(n).toLocaleString('ko-KR'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  function svgRoot(w, h, label) {
    var s = el('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': label, preserveAspectRatio: 'xMidYMid meet' });
    if (w !== 240) s.style.width = w + 'px'; // 막대·꺾은선: viewBox 1:1 크기(글자 축소 없음)
    return s;
  }
  function fieldColor(f) { return (Calc.FIELD_COLORS && Calc.FIELD_COLORS[f]) || '#64748b'; }

  /* ---------- 자료 로드 ---------- */
  function clearFileInput() { try { $('file-input').value = ''; } catch (e) { /* 무시 */ } }
  function setFiles(files, label, notice) {
    state.files = files;
    state.sourceLabel = label;
    state.notice = notice || '';
    state.loaded = Calc.loadFiles(files);
    var ys = {};
    state.loaded.valid.forEach(function (r) { ys[r.연도] = true; });
    state.years = Object.keys(ys).map(Number).sort(function (a, b) { return a - b; });
    state.selected = {};
    state.years.forEach(function (y) { state.selected[y] = true; });
    renderYears();
    renderAll();
  }

  function useSample() {
    clearFileInput();
    setFiles(window.SAMPLE_FILES.map(function (f) { return { name: f.name, text: f.text }; }),
      '기본 샘플 (정상 자료 ' + window.SAMPLE_FILES.length + '개: ' + window.SAMPLE_FILES.map(function (f) { return f.name; }).join(', ') + ')');
  }
  function useErrorSample() {
    clearFileInput();
    var e = window.ERROR_SAMPLE;
    setFiles([{ name: e.name, text: e.text }], '오류 사례 (' + e.name + ') - 정상 자료와 섞지 않고 따로 확인');
  }

  function readFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList);
    if (!arr.length) return;
    Promise.all(arr.map(function (f) {
      return new Promise(function (resolve) {
        var fr = new FileReader();
        fr.onload = function () { resolve({ name: f.name, text: String(fr.result) }); };
        fr.onerror = function () { resolve({ name: f.name, failed: true }); };
        fr.readAsText(f, 'UTF-8');
      });
    })).then(function (all) {
      var files = all.filter(function (f) { return !f.failed; });
      var failed = all.filter(function (f) { return f.failed; }).map(function (f) { return '파일 읽기 실패: ' + f.name; });
      if (!files.length) {
        state.notice = failed.join(' / ') + ' / 이전 자료를 유지합니다.';
        if (state.loaded) renderAll(); else $('source-line').textContent = state.notice;
        return;
      }
      var label = '직접 선택한 파일 (' + files.map(function (f) { return f.name; }).join(', ') + ')';
      var notice = failed.slice();
      if (files.length > 1) notice.push('정상 자료와 오류 자료를 섞지 마세요. 서로 다른 성격의 파일은 따로 불러와 확인하세요.');
      setFiles(files, label, notice.join(' / '));
    });
  }

  /* ---------- 필터 ---------- */
  function renderYears() {
    var box = $('year-list');
    box.innerHTML = '';
    if (!state.years.length) { box.textContent = '선택할 연도가 없습니다.'; return; }
    state.years.forEach(function (y) {
      var l = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!state.selected[y];
      cb.addEventListener('change', function () { state.selected[y] = cb.checked; renderAll(); });
      l.appendChild(cb);
      l.appendChild(document.createTextNode(y + '년'));
      box.appendChild(l);
    });
  }
  function selectedYears() { return state.years.filter(function (y) { return state.selected[y]; }); }
  function getThreshold() {
    var v = parseFloat($('threshold').value);
    return isNaN(v) ? 70 : v;
  }

  /* ---------- 렌더 ---------- */
  function renderAll() {
    $('source-line').textContent = '현재 자료: ' + state.sourceLabel + (state.notice ? '  ※ ' + state.notice : '');
    var th = getThreshold();
    var rows = Calc.filterRows(state.loaded.valid, selectedYears());
    lastRows = rows;
    renderSummary(rows, th);
    renderPie(rows);
    renderBar(rows);
    renderLine(rows, th);
    renderTable(rows, th);
    renderExcluded();
  }

  function renderSummary(rows, th) {
    var s = Calc.summarize(rows, th);
    var rateNA = s.전체수료율 == null;
    var items = [
      { l: '참여자 합계', v: fmt(s.참여자합계), u: '명' },
      { l: '수료자 합계', v: fmt(s.수료자합계), u: '명' },
      { l: '전체 수료율', v: rateNA ? '계산 불가' : Calc.formatRate(s.전체수료율), u: '', na: rateNA,
        reason: rateNA ? (rows.length === 0 ? '선택한 연도가 없어 계산할 수 없습니다.' : '참여자 합계가 0명이라 수료율을 계산할 수 없습니다.') : '' },
      { l: '사업 수', v: fmt(s.사업수), u: '개' },
      { l: '선택 연도 수', v: fmt(s.연도수), u: '개' },
      { l: '주의 항목 수', v: fmt(s.주의수), u: '건' }
    ];
    $('summary').innerHTML = items.map(function (i) {
      return '<div class="summary-card"><div class="label">' + esc(i.l) + '</div>' +
        '<div class="value' + (i.na ? ' na' : '') + '">' + esc(i.v) + (i.u ? '<small>' + i.u + '</small>' : '') + '</div>' +
        (i.reason ? '<div class="reason">' + esc(i.reason) + '</div>' : '') + '</div>';
    }).join('');
  }

  /* 파이 */
  function renderPie(rows) {
    var data = Calc.byField(rows);
    var total = data.reduce(function (a, d) { return a + d.참여자수; }, 0);
    $('note-pie').textContent = '분야별 참여자수(명)가 전체에서 차지하는 비율입니다. 조각이 클수록 참여자가 많습니다.';
    var wrap = $('pie');
    wrap.innerHTML = '';
    if (total === 0) {
      var p = document.createElement('p');
      p.className = 'pie-empty';
      p.textContent = '선택한 조건에 참여자가 없어 비중을 표시할 수 없습니다.';
      wrap.appendChild(p);
    } else {
      var svg = svgRoot(240, 240, '분야별 참여자 비중 파이 차트');
      var cx = 120, cy = 120, r = 105, ang = -Math.PI / 2;
      var nonZero = data.filter(function (d) { return d.참여자수 > 0; });
      nonZero.forEach(function (d) {
        var frac = d.참여자수 / total;
        var color = fieldColor(d.분야);
        if (nonZero.length === 1) {
          svg.appendChild(el('circle', { cx: cx, cy: cy, r: r, fill: color, stroke: '#fff', 'stroke-width': 2 }));
        } else {
          var a2 = ang + frac * Math.PI * 2;
          var x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang);
          var x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
          var path = 'M' + cx + ' ' + cy + ' L' + x1.toFixed(2) + ' ' + y1.toFixed(2) +
            ' A' + r + ' ' + r + ' 0 ' + (frac > 0.5 ? 1 : 0) + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' Z';
          svg.appendChild(el('path', { d: path, fill: color, stroke: '#fff', 'stroke-width': 2 }));
        }
        var mid = ang + frac * Math.PI;
        if (frac >= 0.06 || nonZero.length === 1) {
          var tx = nonZero.length === 1 ? cx : cx + r * 0.62 * Math.cos(mid);
          var ty = nonZero.length === 1 ? cy : cy + r * 0.62 * Math.sin(mid);
          var t = el('text', { x: tx.toFixed(1), y: ty.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 15, 'font-weight': 700, fill: '#fff', style: 'fill:#fff;paint-order:stroke;stroke:rgba(0,0,0,.35);stroke-width:2px' }, (frac * 100).toFixed(1) + '%');
          svg.appendChild(t);
        }
        ang += frac * Math.PI * 2;
      });
      wrap.appendChild(svg);
    }
    var lg = document.createElement('div');
    lg.className = 'legend-grid';
    var h = '<span></span><span class="legend-head">분야</span><span class="legend-head r">비율</span><span class="legend-head r">참여자수(명)</span>';
    data.forEach(function (d) {
      h += '<span class="sw" style="background:' + fieldColor(d.분야) + '"></span><span>' + esc(d.분야) + '</span>' +
        '<span class="r">' + (d.비율 == null ? '-' : d.비율.toFixed(1) + '%') + '</span>' +
        '<span class="r">' + fmt(d.참여자수) + '명</span>';
    });
    lg.innerHTML = h;
    wrap.appendChild(lg);
  }

  function niceMax(v) {
    if (v <= 0) return 10;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10));
    var n = v / p;
    var m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return m * p;
  }

  /* 막대 */
  function renderBar(rows) {
    var data = Calc.byProgram(rows);
    $('note-bar').textContent = '사업별 참여자(명)와 수료자(명)를 나란히 비교합니다. 두 막대 높이 차이가 작을수록 수료가 잘 이루어진 사업입니다.';
    var box = $('bar');
    box.innerHTML = '';
    if (!data.length) { box.innerHTML = '<p class="empty-msg">표시할 사업이 없습니다.</p>'; return; }
    var W = Math.max(480, 80 + data.length * 78, box.clientWidth), H = 320;
    var L = 64, R = 16, T = 28, B = 56;
    var pw = W - L - R, ph = H - T - B;
    var max = niceMax(Math.max.apply(null, data.map(function (d) { return Math.max(d.참여자수, d.수료자수); })));
    var svg = svgRoot(W, H, '사업별 참여자·수료자 그룹 막대 차트');
    var axis = el('g', { 'class': 'axis' });
    for (var i = 0; i <= 5; i++) {
      var v = max * i / 5, y = T + ph - ph * i / 5;
      axis.appendChild(el('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: i === 0 ? '#64748b' : '#e3e8cf' }));
      axis.appendChild(el('text', { x: L - 8, y: y + 4, 'text-anchor': 'end' }, fmt(v)));
    }
    axis.appendChild(el('text', { x: L, y: 14, 'text-anchor': 'start' }, '단위: 명'));
    svg.appendChild(axis);
    var gw = pw / data.length, bw = Math.min(30, gw / 2 - 6);
    data.forEach(function (d, idx) {
      var gx = L + gw * idx + gw / 2;
      [['참여', d.참여자수, -bw], ['수료', d.수료자수, 0]].forEach(function (b) {
        var bh = ph * b[1] / max, x = gx + b[2], y = T + ph - bh;
        svg.appendChild(el('rect', { x: x, y: y, width: bw, height: Math.max(bh, 0), fill: BAR_COLORS[b[0]], rx: 2 }));
        svg.appendChild(el('text', { x: x + bw / 2, y: y - 5, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }, fmt(b[1])));
      });
      svg.appendChild(el('text', { x: gx, y: T + ph + 18, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }, d.사업ID));
      var nm = String(d.사업명 || '');
      if (nm.length > 6) nm = nm.slice(0, 5) + '…';
      svg.appendChild(el('text', { x: gx, y: T + ph + 34, 'text-anchor': 'middle', 'font-size': 11, style: 'fill:#4a5636' }, nm));
    });
    box.appendChild(svg);
    var lg = document.createElement('div');
    lg.className = 'inline-legend';
    lg.innerHTML = '<span><i style="background:' + BAR_COLORS.참여 + '"></i>참여자수(명)</span><span><i style="background:' + BAR_COLORS.수료 + '"></i>수료자수(명)</span>';
    box.appendChild(lg);
  }

  /* 꺾은선 */
  function renderLine(rows, th) {
    var data = Calc.byYear(rows);
    $('note-line').textContent = '연도별 수료율(%)입니다. 점선은 주의 기준(' + th + '%)이며, 선이 점선 아래로 내려가면 주의가 필요합니다.';
    var box = $('line');
    box.innerHTML = '';
    var extra = $('line-extra');
    var na = data.filter(function (d) { return d.수료율 == null; });
    extra.textContent = na.length ? '계산 불가 연도(' + na.map(function (d) { return d.연도 + '년'; }).join(', ') + '): 참여자 0명이라 수료율을 계산할 수 없어 점을 표시하지 않았습니다.' : '';
    if (!data.length) { box.innerHTML = '<p class="empty-msg">표시할 연도가 없습니다.</p>'; return; }
    var W = Math.max(480, box.clientWidth), H = 300, L = 56, R = 32, T = 32, B = 48;
    var pw = W - L - R, ph = H - T - B;
    var svg = svgRoot(W, H, '연도별 수료율 꺾은선 차트');
    var axis = el('g', { 'class': 'axis' });
    for (var i = 0; i <= 5; i++) {
      var v = 20 * i, y = T + ph - ph * v / 100;
      axis.appendChild(el('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: i === 0 ? '#64748b' : '#e3e8cf' }));
      axis.appendChild(el('text', { x: L - 8, y: y + 4, 'text-anchor': 'end' }, v + '%'));
    }
    axis.appendChild(el('text', { x: L, y: 16, 'text-anchor': 'start' }, '단위: 수료율(%)'));
    svg.appendChild(axis);
    var xs = data.map(function (d, idx) { return data.length === 1 ? L + pw / 2 : L + pw * (idx + 0.5) / data.length; });
    data.forEach(function (d, idx) {
      svg.appendChild(el('text', { x: xs[idx], y: T + ph + 22, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, d.연도 + '년'));
    });
    var ty = T + ph - ph * Math.min(Math.max(th, 0), 100) / 100;
    svg.appendChild(el('line', { x1: L, x2: W - R, y1: ty, y2: ty, stroke: THRESH_COLOR, 'stroke-width': 2, 'stroke-dasharray': '6 4' }));
    svg.appendChild(el('text', { x: W - R, y: ty - 6, 'text-anchor': 'end', 'font-size': 12, 'font-weight': 700, style: 'fill:' + THRESH_COLOR }, '기준 ' + th + '%'));
    var pts = [];
    data.forEach(function (d, idx) {
      if (d.수료율 != null) pts.push({ x: xs[idx], y: T + ph - ph * d.수료율 / 100, d: d });
    });
    if (pts.length > 1) {
      svg.appendChild(el('polyline', { points: pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' '), fill: 'none', stroke: LINE_COLOR, 'stroke-width': 3 }));
    }
    pts.forEach(function (p) {
      svg.appendChild(el('circle', { cx: p.x, cy: p.y, r: 5, fill: LINE_COLOR, stroke: '#fff', 'stroke-width': 2 }));
      var ly = p.y - 12 < T - 4 ? p.y + 20 : p.y - 12;
      svg.appendChild(el('text', { x: p.x, y: ly, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, Calc.formatRate(p.d.수료율)));
    });
    box.appendChild(svg);
    var lg = document.createElement('div');
    lg.className = 'inline-legend';
    lg.innerHTML = '<span><i style="background:' + LINE_COLOR + '"></i>연도별 수료율(%)</span><span><i class="dash"></i>주의 기준(' + esc(th) + '%)</span>';
    box.appendChild(lg);
  }

  /* 표 */
  function renderTable(rows, th) {
    var tb = document.querySelector('#detail-table tbody');
    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="10">표시할 행이 없습니다.</td></tr>';
      return;
    }
    tb.innerHTML = rows.map(function (r) {
      var j = Calc.judge(r.수료율, th);
      var cls = j === '주의' ? 'warn' : j === '정상' ? 'ok' : 'na';
      var note = r.참여자수 === 0 ? '참여자 0명으로 수료율 계산 불가' : '';
      return '<tr' + (j === '주의' ? ' class="warn"' : '') + '>' +
        '<td>' + esc(r.연도) + '</td><td>' + esc(r.사업ID) + '</td><td>' + esc(r.사업명) + '</td>' +
        '<td>' + esc(r.분야) + '</td><td>' + esc(r.지역) + '</td>' +
        '<td class="num">' + fmt(r.참여자수) + '</td><td class="num">' + fmt(r.수료자수) + '</td>' +
        '<td class="num">' + esc(Calc.formatRate(r.수료율)) + '</td>' +
        '<td><span class="badge ' + cls + '">' + esc(j) + '</span></td><td>' + esc(note) + '</td></tr>';
    }).join('');
  }

  function renderExcluded() {
    var ex = state.loaded.excluded, errs = state.loaded.errors || [];
    var h = '';
    if (errs.length) {
      h += '<ul class="err-list">' + errs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
    }
    if (!ex.length) {
      h += '<p class="empty-msg">제외된 행 없음</p>';
    } else {
      h += '<div class="scroll-x"><table><thead><tr><th>파일</th><th class="num">행 번호</th><th>원본 값</th><th>제외 이유</th></tr></thead><tbody>' +
        ex.map(function (x) {
          return '<tr><td>' + esc(x.file) + '</td><td class="num">' + esc(x.line) + '</td><td>' + esc((x.raw || []).join(', ')) + '</td><td>' + esc(x.reason) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    $('excluded').innerHTML = h;
  }

  /* ---------- CSV ---------- */
  function downloadCSV() {
    var csv = Calc.toCSV(lastRows);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '통합_실적.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------- 시작 ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    $('btn-errors').addEventListener('click', useErrorSample);
    $('btn-reset').addEventListener('click', useSample);
    $('file-input').addEventListener('change', function (e) {
      var list = Array.prototype.slice.call(e.target.files); // 초기화 전에 복사
      clearFileInput(); // 같은 파일을 다시 선택해도 change가 발생하도록
      readFiles(list);
    });
    $('threshold').addEventListener('input', function () { renderAll(); });
    $('btn-csv').addEventListener('click', downloadCSV);
    var rt = null, lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        renderBar(lastRows);
        renderLine(lastRows, getThreshold());
      }, 150);
    });
    useSample();
  });
})();
