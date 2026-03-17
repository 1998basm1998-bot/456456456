// المتغيرات وحالة التطبيق (100 ميزة)
let currentTabId = 'center';
let historyStack = [];
let redoStack = [];
let autoSaveInterval = null;
let soundEnabled = false;
let isReadOnly = false;
let sessionSeconds = 0;
let currentPage = 1;
let rowsPerPage = 50;
let paginationEnabled = false;
let multiSelectEnabled = false;

// 1. تحديد العناصر الرئيسية
const tableContainer = document.getElementById('tableContainer');
const notification = document.getElementById('notification');
const csvFileInput = document.getElementById('csvFileInput');
const toolbar = document.getElementById('toolbar');
const tabsContainer = document.getElementById('tabsContainer');

// 2. دالة الإشعارات
function notify(msg, type = 'success') {
    notification.textContent = msg;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');
    if(soundEnabled) playSound(type === 'success' ? 1000 : 200, 0.1);
    setTimeout(() => notification.classList.add('hidden'), 3000);
}

// 3. دالة الأصوات
function playSound(freq, duration) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    osc.connect(ctx.destination);
    osc.start(); setTimeout(() => osc.stop(), duration * 1000);
}

// 4. السجل (التراجع والإعادة)
function saveState() {
    if(!document.querySelector('table')) return;
    historyStack.push(tableContainer.innerHTML);
    if(historyStack.length > 20) historyStack.shift();
    redoStack = [];
    updateStats();
}

// 5. التبويبات (إدارة شاملة)
tabsContainer.addEventListener('click', (e) => {
    if(e.target.classList.contains('tab-btn')) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentTabId = e.target.getAttribute('data-id');
        document.getElementById('sectionTitle').textContent = e.target.textContent;
        loadData();
    }
});

// 6. إضافة تبويب جديد
document.getElementById('addTabBtn').onclick = () => {
    const name = prompt("اسم التبويب الجديد:");
    if(!name) return;
    const id = 'tab_' + Date.now();
    const btn = document.createElement('button');
    btn.className = 'tab-btn'; btn.setAttribute('data-id', id); btn.textContent = name;
    tabsContainer.appendChild(btn);
    notify("تم إضافة التبويب");
};

// 7. حذف تبويب
document.getElementById('deleteTabBtn').onclick = () => {
    const active = document.querySelector('.tab-btn.active');
    if(tabsContainer.children.length > 1 && confirm("هل أنت متأكد من حذف التبويب وبياناته؟")) {
        localStorage.removeItem(`data_${active.getAttribute('data-id')}`);
        active.remove();
        tabsContainer.firstElementChild.click();
        notify("تم الحذف");
    }
};

// 8. إعادة تسمية التبويب
document.getElementById('renameTabBtn').onclick = () => {
    const active = document.querySelector('.tab-btn.active');
    const newName = prompt("الاسم الجديد:", active.textContent);
    if(newName) { active.textContent = newName; document.getElementById('sectionTitle').textContent = newName; }
};

// 9. استنساخ التبويب
document.getElementById('cloneTabBtn').onclick = () => {
    const active = document.querySelector('.tab-btn.active');
    const id = 'tab_' + Date.now();
    const btn = document.createElement('button');
    btn.className = 'tab-btn'; btn.setAttribute('data-id', id); btn.textContent = active.textContent + " (نسخة)";
    tabsContainer.appendChild(btn);
    localStorage.setItem(`data_${id}`, localStorage.getItem(`data_${currentTabId}`) || "");
    notify("تم الاستنساخ");
};

// 10. حماية بكلمة مرور
document.getElementById('passwordTabBtn').onclick = () => {
    const pw = prompt("أدخل كلمة مرور لحماية التبويب (اتركه فارغاً للفك):");
    localStorage.setItem(`pw_${currentTabId}`, pw || "");
    notify("تم تحديث الحماية");
};

// 11. رفع ملف CSV
csvFileInput.onchange = (e) => {
    const file = e.target.files[0];
    if(file) {
        document.getElementById('loadingSpinner').classList.remove('hidden');
        const reader = new FileReader();
        reader.onload = (event) => {
            renderTableFromCSV(event.target.result);
            document.getElementById('loadingSpinner').classList.add('hidden');
            notify("تم رفع الملف"); saveState();
        };
        reader.readAsText(file);
    }
};

// 12. السحب والإفلات
tableContainer.addEventListener('dragover', e => { e.preventDefault(); tableContainer.classList.add('dragover'); });
tableContainer.addEventListener('dragleave', () => tableContainer.classList.remove('dragover'));
tableContainer.addEventListener('drop', e => {
    e.preventDefault(); tableContainer.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if(file && file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = ev => { renderTableFromCSV(ev.target.result); saveState(); notify("تم التحميل بالسحب"); };
        reader.readAsText(file);
    }
});

// 13. بناء الجدول
function renderTableFromCSV(csv) {
    const rows = csv.split('\n').filter(r => r.trim());
    if(!rows.length) { tableContainer.innerHTML = '<p class="placeholder-text">فارغ</p>'; return; }
    let html = '<table id="dataTable">';
    rows.forEach((r, i) => {
        const cols = r.split(',');
        html += '<tr>';
        cols.forEach(c => {
            if(i === 0) html += `<th>${c.trim()}</th>`;
            else html += `<td contenteditable="true">${c.trim()}</td>`;
        });
        html += '</tr>';
    });
    html += '</table>';
    tableContainer.innerHTML = html;
    updateStats();
    attachCellListeners();
}

// 14. استخراج البيانات من الجدول
function getTableData() {
    const table = document.getElementById('dataTable');
    if(!table) return "";
    let csv = [];
    for(let i=0; i<table.rows.length; i++) {
        let row = [];
        for(let j=0; j<table.rows[i].cells.length; j++) {
            row.push(table.rows[i].cells[j].innerText.trim().replace(/,/g, ''));
        }
        csv.push(row.join(','));
    }
    return csv.join('\n');
}

// 15. الحفظ المحلي
document.getElementById('saveLocalBtn').onclick = saveToLocal;
function saveToLocal() {
    if(isReadOnly) return notify("الجدول مقفل!", "error");
    localStorage.setItem(`data_${currentTabId}`, getTableData());
    document.getElementById('confetti').classList.remove('hidden');
    setTimeout(() => document.getElementById('confetti').classList.add('hidden'), 1000);
    notify("تم الحفظ في المتصفح");
}

// 16. الاسترجاع المحلي
document.getElementById('loadLocalBtn').onclick = loadData;
function loadData() {
    const pw = localStorage.getItem(`pw_${currentTabId}`);
    if(pw && prompt("أدخل كلمة المرور:") !== pw) return notify("كلمة المرور خاطئة", "error");
    const data = localStorage.getItem(`data_${currentTabId}`);
    if(data) { renderTableFromCSV(data); notify("تم الاسترجاع"); }
    else { tableContainer.innerHTML = '<p class="placeholder-text">لا توجد بيانات</p>'; updateStats(); }
    historyStack = []; saveState();
}

// 17. تفريغ الحفظ
document.getElementById('clearLocalBtn').onclick = () => {
    if(confirm("مسح الحفظ؟")) { localStorage.removeItem(`data_${currentTabId}`); loadData(); }
};

// 18. الحفظ التلقائي
document.getElementById('autoSaveToggle').onclick = (e) => {
    if(autoSaveInterval) { clearInterval(autoSaveInterval); autoSaveInterval = null; e.target.textContent = "تفعيل الحفظ التلقائي"; notify("تم الإيقاف"); }
    else { autoSaveInterval = setInterval(saveToLocal, 30000); e.target.textContent = "إيقاف الحفظ التلقائي (يعمل)"; notify("تم التفعيل (كل 30ث)"); }
};

// 19-21. التصدير
document.getElementById('exportCsvBtn').onclick = () => downloadFile(getTableData(), `data_${currentTabId}.csv`, "text/csv");
document.getElementById('exportTxtBtn').onclick = () => downloadFile(getTableData().replace(/,/g, '\t'), `data_${currentTabId}.txt`, "text/plain");
document.getElementById('exportJsonBtn').onclick = () => {
    const table = document.getElementById('dataTable');
    if(!table) return;
    let json = [];
    const headers = Array.from(table.rows[0].cells).map(th => th.innerText);
    for(let i=1; i<table.rows.length; i++) {
        let obj = {};
        Array.from(table.rows[i].cells).forEach((td, j) => obj[headers[j] || j] = td.innerText);
        json.push(obj);
    }
    downloadFile(JSON.stringify(json, null, 2), `data_${currentTabId}.json`, "application/json");
};
function downloadFile(content, name, type) {
    const blob = new Blob(["\uFEFF" + content], {type: type + ";charset=utf-8;"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    notify("تم التصدير");
}

// 22-23. النسخ الاحتياطي
document.getElementById('backupBtn').onclick = () => {
    localStorage.setItem('backup_all', JSON.stringify(localStorage));
    notify("تم أخذ نسخة احتياطية شاملة");
};
document.getElementById('restoreBtn').onclick = () => {
    if(!confirm("سيتم استبدال كل البيانات!")) return;
    const b = JSON.parse(localStorage.getItem('backup_all') || "{}");
    for(let k in b) localStorage.setItem(k, b[k]);
    loadData(); notify("تمت الاستعادة");
};

// 24-27. الثيمات والمظهر
document.getElementById('darkModeBtn').onclick = () => { document.body.className = 'dark-mode'; };
document.getElementById('lightModeBtn').onclick = () => { document.body.className = ''; };
document.getElementById('themeBlueBtn').onclick = () => { document.body.className = 'theme-blue'; };
document.getElementById('themeGreenBtn').onclick = () => { document.body.className = 'theme-green'; };

// 28-29. التكبير والتصغير
let currentZoom = 14;
document.getElementById('zoomInBtn').onclick = () => { currentZoom+=2; document.body.style.fontSize = currentZoom + 'px'; };
document.getElementById('zoomOutBtn').onclick = () => { currentZoom-=2; document.body.style.fontSize = currentZoom + 'px'; };

// 30-31. الطباعة
document.getElementById('printBtn').onclick = () => window.print();
document.getElementById('printSelectedBtn').onclick = () => {
    const table = document.getElementById('dataTable');
    if(!table) return;
    const cloned = table.cloneNode(true);
    Array.from(cloned.rows).forEach((r, i) => { if(i > 0 && !r.classList.contains('selected')) r.style.display = 'none'; });
    const win = window.open('','','width=800,height=600');
    win.document.write('<html dir="rtl"><head><style>table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:5px}</style></head><body>');
    win.document.write(cloned.outerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print(); win.close();
};

// 32-33. الشاشة الكاملة والقائمة الجانبية
document.getElementById('fullscreenBtn').onclick = () => {
    if(!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
};
document.getElementById('toggleSidebarBtn').onclick = () => {
    document.getElementById('sidebar').classList.toggle('hidden');
};

// 34-36. العناوين والأرقام
document.getElementById('freezeHeaderBtn').onclick = () => {
    document.querySelectorAll('th').forEach(th => th.classList.toggle('freeze'));
};
document.getElementById('showRowNumsBtn').onclick = () => {
    const table = document.getElementById('dataTable'); if(!table) return;
    Array.from(table.rows).forEach((r, i) => {
        let cell = r.insertCell(0);
        cell.innerText = i === 0 ? "#" : i;
        cell.style.background = "var(--btn-primary)"; cell.style.color = "white";
    });
    saveState();
};

// 37. إضافة صف
document.getElementById('addRowBtn').onclick = () => {
    const table = document.getElementById('dataTable');
    if(!table) return renderTableFromCSV("عمود1,عمود2\nجديد,جديد");
    const row = table.insertRow(-1);
    for(let i=0; i<table.rows[0].cells.length; i++) {
        let c = row.insertCell(i); c.contentEditable = !isReadOnly; c.innerText = "جديد";
    }
    saveState(); notify("تم إضافة صف");
};

// 38. حذف صف
document.getElementById('deleteRowBtn').onclick = () => {
    const table = document.getElementById('dataTable');
    if(table && table.rows.length > 1) { table.deleteRow(-1); saveState(); notify("تم الحذف"); }
};

// 39. تكرار صف
document.getElementById('duplicateRowBtn').onclick = () => {
    const table = document.getElementById('dataTable');
    const selected = table.querySelector('tr.selected');
    if(selected && selected.rowIndex > 0) {
        const clone = selected.cloneNode(true);
        selected.parentNode.insertBefore(clone, selected.nextSibling);
        saveState(); notify("تم التكرار");
    } else notify("حدد صفاً أولاً", "error");
};

// 40-41. تحريك الصفوف
document.getElementById('moveRowUpBtn').onclick = () => moveRow(-1);
document.getElementById('moveRowDownBtn').onclick = () => moveRow(1);
function moveRow(dir) {
    const table = document.getElementById('dataTable');
    const row = table?.querySelector('tr.selected');
    if(row && row.rowIndex > 0) {
        const targetIndex = row.rowIndex + dir;
        if(targetIndex > 0 && targetIndex < table.rows.length) {
            const targetRow = table.rows[targetIndex];
            row.parentNode.insertBefore(row, dir === 1 ? targetRow.nextSibling : targetRow);
            saveState();
        }
    }
}

// 42. التحديد العشوائي/الترتيب
document.getElementById('randomizeRowsBtn').onclick = () => {
    const table = document.getElementById('dataTable'); if(!table) return;
    const rows = Array.from(table.rows).slice(1);
    rows.sort(() => Math.random() - 0.5);
    rows.forEach(r => table.appendChild(r));
    saveState(); notify("تم الخلط");
};

// 43-46. التحديد والمسح
document.getElementById('selectAllBtn').onclick = () => document.querySelectorAll('tr').forEach(r => r.classList.add('selected'));
document.getElementById('deleteSelectedBtn').onclick = () => {
    document.querySelectorAll('tr.selected').forEach(r => { if(r.rowIndex > 0) r.remove(); });
    saveState(); notify("تم حذف المحدد");
};
document.getElementById('clearTableBtn').onclick = () => {
    if(confirm("تفريغ الجدول؟")) { tableContainer.innerHTML = ''; saveState(); }
};
document.getElementById('highlightRowBtn').onclick = () => {
    const r = document.querySelector('tr.selected'); if(r) r.classList.toggle('highlight');
};

// 47-49. إدارة الأعمدة
document.getElementById('addColumnBtn').onclick = () => {
    const table = document.getElementById('dataTable'); if(!table) return;
    Array.from(table.rows).forEach((r, i) => {
        let c = r.insertCell(-1);
        c.innerText = i === 0 ? "عمود جديد" : "بيانات";
        if(i > 0) c.contentEditable = !isReadOnly;
    });
    saveState();
};
document.getElementById('deleteColumnBtn').onclick = () => {
    const table = document.getElementById('dataTable'); if(!table) return;
    Array.from(table.rows).forEach(r => r.deleteCell(-1));
    saveState();
};
document.getElementById('renameColumnBtn').onclick = () => {
    const table = document.getElementById('dataTable');
    const idx = prompt("رقم العمود (يبدأ من 1):");
    const name = prompt("الاسم الجديد:");
    if(table && idx && name && table.rows[0].cells[idx-1]) { table.rows[0].cells[idx-1].innerText = name; saveState(); }
};

// 50-51. الفرز
document.getElementById('sortAscBtn').onclick = () => sortTable(1);
document.getElementById('sortDescBtn').onclick = () => sortTable(-1);
function sortTable(dir) {
    const table = document.getElementById('dataTable');
    const idx = prompt("رقم العمود للفرز (يبدأ من 1):") - 1;
    if(!table || isNaN(idx)) return;
    const rows = Array.from(table.rows).slice(1);
    rows.sort((a,b) => {
        let v1 = a.cells[idx]?.innerText || ""; let v2 = b.cells[idx]?.innerText || "";
        return (v1.localeCompare(v2, 'ar', {numeric: true})) * dir;
    });
    rows.forEach(r => table.appendChild(r));
    saveState(); notify("تم الفرز");
}

// 52-53. إخفاء الأعمدة والمحاذاة
document.getElementById('hideColumnBtn').onclick = () => {
    const table = document.getElementById('dataTable');
    const idx = prompt("رقم العمود للإخفاء:") - 1;
    if(table && table.rows[0].cells[idx]) {
        Array.from(table.rows).forEach(r => r.cells[idx].style.display = 'none');
    }
};
document.getElementById('showColumnsBtn').onclick = () => {
    document.querySelectorAll('td, th').forEach(c => c.style.display = '');
};

// 54-56. المحاذاة
document.getElementById('alignCenterBtn').onclick = () => document.querySelectorAll('td').forEach(c => c.style.textAlign = 'center');
document.getElementById('alignRightBtn').onclick = () => document.querySelectorAll('td').forEach(c => c.style.textAlign = 'right');
document.getElementById('alignLeftBtn').onclick = () => document.querySelectorAll('td').forEach(c => c.style.textAlign = 'left');

// 57-58. القفل والتعديل
document.getElementById('lockTableBtn').onclick = () => { isReadOnly = true; document.querySelectorAll('td').forEach(c => c.contentEditable = false); notify("الجدول مقفل"); };
document.getElementById('editCellBtn').onclick = () => { isReadOnly = false; document.querySelectorAll('td').forEach(c => c.contentEditable = true); notify("التعديل مفعل"); };

// 59-66. التنسيق الخلوي
let activeCell = null;
tableContainer.addEventListener('focusin', e => { if(e.target.tagName === 'TD') activeCell = e.target; });
document.getElementById('clearCellBtn').onclick = () => { if(activeCell) { activeCell.innerText = ''; saveState(); } };
document.getElementById('uppercaseBtn').onclick = () => { if(activeCell) { activeCell.innerText = activeCell.innerText.toUpperCase(); saveState(); } };
document.getElementById('lowercaseBtn').onclick = () => { if(activeCell) { activeCell.innerText = activeCell.innerText.toLowerCase(); saveState(); } };
document.getElementById('trimBtn').onclick = () => { if(activeCell) { activeCell.innerText = activeCell.innerText.trim(); saveState(); } };
document.getElementById('boldBtn').onclick = () => { if(activeCell) { activeCell.classList.toggle('td-bold'); saveState(); } };
document.getElementById('italicBtn').onclick = () => { if(activeCell) { activeCell.classList.toggle('td-italic'); saveState(); } };
document.getElementById('colorRedBtn').onclick = () => { if(activeCell) { activeCell.className = 'td-red'; saveState(); } };
document.getElementById('colorBlueBtn').onclick = () => { if(activeCell) { activeCell.className = 'td-blue'; saveState(); } };

// 67-69. البحث والاستبدال
document.getElementById('searchInput').oninput = (e) => {
    const val = e.target.value.toLowerCase();
    document.querySelectorAll('tr').forEach((r, i) => {
        if(i===0) return;
        r.style.display = r.innerText.toLowerCase().includes(val) ? '' : 'none';
    });
};
document.getElementById('replaceBtn').onclick = () => {
    const s = document.getElementById('searchInput').value;
    const r = document.getElementById('replaceInput').value;
    if(s) {
        document.querySelectorAll('td').forEach(td => {
            if(td.innerText.includes(s)) td.innerText = td.innerText.replaceAll(s, r);
        });
        saveState(); notify("تم الاستبدال");
    }
};

// 70-71. التكرارات
document.getElementById('removeDupBtn').onclick = () => {
    const table = document.getElementById('dataTable'); if(!table) return;
    let seen = new Set();
    Array.from(table.rows).slice(1).forEach(r => {
        let txt = r.innerText;
        if(seen.has(txt)) r.remove(); else seen.add(txt);
    });
    saveState(); notify("تم حذف المكرر");
};
document.getElementById('highlightDupBtn').onclick = () => {
    const table = document.getElementById('dataTable'); if(!table) return;
    let seen = new Set();
    Array.from(table.rows).slice(1).forEach(r => {
        let txt = r.innerText;
        if(seen.has(txt)) r.style.background = '#ffb8b8'; else seen.add(txt);
    });
};

// 72-75. العمليات الحسابية
document.getElementById('countRowsBtn').onclick = () => notify(`الصفوف: ${document.querySelectorAll('tr').length - 1}`);
document.getElementById('sumColBtn').onclick = () => calcCol((a,b)=>a+b, 0, "المجموع");
document.getElementById('avgColBtn').onclick = () => calcCol((a,b)=>a+b, 0, "المتوسط", true);
document.getElementById('minMaxBtn').onclick = () => {
    const idx = prompt("رقم العمود:") - 1;
    const vals = getColVals(idx);
    if(vals.length) notify(`أعلى: ${Math.max(...vals)} | أقل: ${Math.min(...vals)}`);
};
function getColVals(idx) {
    const table = document.getElementById('dataTable');
    if(!table || isNaN(idx)) return [];
    return Array.from(table.rows).slice(1).map(r => parseFloat(r.cells[idx]?.innerText)).filter(n => !isNaN(n));
}
function calcCol(fn, init, name, isAvg=false) {
    const idx = prompt("رقم العمود للحساب:") - 1;
    const vals = getColVals(idx);
    if(vals.length) {
        let res = vals.reduce(fn, init);
        if(isAvg) res /= vals.length;
        notify(`${name}: ${res.toFixed(2)}`);
    }
}

// 76. التراجع والإعادة
document.getElementById('undoBtn').onclick = () => {
    if(historyStack.length > 1) {
        redoStack.push(historyStack.pop());
        tableContainer.innerHTML = historyStack[historyStack.length - 1];
        attachCellListeners(); notify("تم التراجع");
    }
};
document.getElementById('redoBtn').onclick = () => {
    if(redoStack.length > 0) {
        const state = redoStack.pop();
        historyStack.push(state);
        tableContainer.innerHTML = state;
        attachCellListeners(); notify("تم الإعادة");
    }
};

// 77-85. أدوات متقدمة
document.getElementById('markEmptyBtn').onclick = () => document.querySelectorAll('td').forEach(td => { if(!td.innerText.trim()) td.style.background = '#ffeaa7'; });
document.getElementById('fillEmptyBtn').onclick = () => { document.querySelectorAll('td').forEach(td => { if(!td.innerText.trim()) td.innerText = '-'; }); saveState(); };
document.getElementById('stripHtmlBtn').onclick = () => { document.querySelectorAll('td').forEach(td => td.innerHTML = td.innerText); saveState(); };
document.getElementById('prefixBtn').onclick = () => { const p = prompt("البادئة:"); if(p) { document.querySelectorAll('td').forEach(td => td.innerText = p + td.innerText); saveState(); } };
document.getElementById('suffixBtn').onclick = () => { const s = prompt("اللاحقة:"); if(s) { document.querySelectorAll('td').forEach(td => td.innerText += s); saveState(); } };
document.getElementById('generateIdBtn').onclick = () => {
    const table = document.getElementById('dataTable'); if(!table) return;
    Array.from(table.rows).forEach((r,i) => { if(i>0 && r.cells[0]) r.cells[0].innerText = 'ID-'+Math.floor(Math.random()*10000); });
    saveState();
};
document.getElementById('numOnlyBtn').onclick = () => { document.querySelectorAll('td').forEach(td => td.innerText = td.innerText.replace(/\D/g, '')); saveState(); };
document.getElementById('textOnlyBtn').onclick = () => { document.querySelectorAll('td').forEach(td => td.innerText = td.innerText.replace(/[\d]/g, '')); saveState(); };
document.getElementById('showLogsBtn').onclick = () => alert("عدد العمليات المسجلة: " + historyStack.length);

// 86-90. التفاعلية
document.getElementById('soundToggleBtn').onclick = (e) => { soundEnabled = !soundEnabled; e.target.textContent = soundEnabled ? "الأصوات: مفعل" : "تفعيل الأصوات"; };
document.getElementById('rowHoverToggleBtn').onclick = () => document.getElementById('dataTable')?.classList.toggle('auto-fit');
tableContainer.addEventListener('click', e => {
    if(e.target.tagName === 'TD') {
        if(multiSelectEnabled) e.target.parentNode.classList.toggle('selected');
        else { document.querySelectorAll('tr').forEach(r => r.classList.remove('selected')); e.target.parentNode.classList.add('selected'); }
    }
});
document.getElementById('multiSelectToggleBtn').onclick = (e) => { multiSelectEnabled = !multiSelectEnabled; e.target.style.background = multiSelectEnabled ? 'green' : ''; };

// 91-94. أعمدة خاصة
document.getElementById('checkboxColBtn').onclick = () => addSpecialCol('☑', '<input type="checkbox">');
document.getElementById('ratingColBtn').onclick = () => addSpecialCol('تقييم', '⭐⭐⭐⭐⭐');
document.getElementById('noteColBtn').onclick = () => addSpecialCol('ملاحظات', '...📝');
function addSpecialCol(head, content) {
    const table = document.getElementById('dataTable'); if(!table) return;
    Array.from(table.rows).forEach((r,i) => {
        let c = r.insertCell(-1);
        if(i===0) c.innerText = head; else c.innerHTML = content;
    }); saveState();
}

// 95. اللغة
document.getElementById('arLangBtn').onclick = () => { document.documentElement.dir = 'rtl'; document.body.style.fontFamily = 'Segoe UI'; };
document.getElementById('enLangBtn').onclick = () => { document.documentElement.dir = 'ltr'; document.body.style.fontFamily = 'Arial'; };

// 96. الإحصائيات الحية
function updateStats() {
    const table = document.getElementById('dataTable');
    if(!table) return;
    const text = table.innerText;
    document.getElementById('statRows').innerText = table.rows.length - 1;
    document.getElementById('statCols').innerText = table.rows[0].cells.length;
    document.getElementById('statWords').innerText = text.split(/\s+/).filter(w => w.length).length;
    document.getElementById('statChars').innerText = text.length;
}
function attachCellListeners() {
    document.querySelectorAll('td').forEach(td => td.onblur = () => { saveState(); updateStats(); });
}

// 97. الساعة والتاريخ والجلسة
setInterval(() => {
    const now = new Date();
    document.getElementById('clockDisplay').innerText = now.toLocaleTimeString('ar-EG');
    document.getElementById('dateDisplay').innerText = now.toLocaleDateString('ar-EG');
    sessionSeconds++;
    const m = Math.floor(sessionSeconds / 60).toString().padStart(2, '0');
    const s = (sessionSeconds % 60).toString().padStart(2, '0');
    document.getElementById('sessionTimer').innerText = `الوقت: ${m}:${s}`;
}, 1000);

// 98. القائمة السياقية (كليك يمين)
document.addEventListener('contextmenu', e => {
    if(e.target.tagName === 'TD') {
        e.preventDefault();
        const menu = document.getElementById('contextMenu');
        menu.style.left = e.pageX + 'px'; menu.style.top = e.pageY + 'px';
        menu.classList.remove('hidden');
    }
});
document.addEventListener('click', () => document.getElementById('contextMenu').classList.add('hidden'));

// 99. نافذة الترحيب
document.getElementById('welcomeModalBtn').onclick = () => document.getElementById('welcomeModal').classList.remove('hidden');
document.getElementById('closeModalBtn').onclick = () => document.getElementById('welcomeModal').classList.add('hidden');

// 100. التهيئة الابتدائية
window.onload = () => {
    if(!localStorage.getItem('visited')) { document.getElementById('welcomeModal').classList.remove('hidden'); localStorage.setItem('visited', 'true'); }
    loadData();
    setInterval(updateStats, 2000);
};

// اختصارات لوحة المفاتيح
document.addEventListener('keydown', e => {
    if(e.ctrlKey && e.key === 's') { e.preventDefault(); saveToLocal(); }
    if(e.ctrlKey && e.key === 'z') { e.preventDefault(); document.getElementById('undoBtn').click(); }
    if(e.ctrlKey && e.key === 'y') { e.preventDefault(); document.getElementById('redoBtn').click(); }
});
