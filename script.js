// تحديد العناصر من صفحة HTML
const buttons = document.querySelectorAll('.tab-btn');
const sectionTitle = document.getElementById('sectionTitle');
const fileInput = document.getElementById('csvFileInput');
const tableContainer = document.getElementById('tableContainer');

// 1. برمجة الأزرار لتغيير عنوان القسم والتفاعل
buttons.forEach(button => {
    button.addEventListener('click', () => {
        // إزالة الفعالية (اللون الأزرق) عن كل الأزرار
        buttons.forEach(btn => btn.classList.remove('active'));
        
        // إضافة الفعالية للزر الذي تم الضغط عليه
        button.classList.add('active');
        
        // تغيير عنوان القسم بناءً على الزر المختار
        sectionTitle.textContent = button.getAttribute('data-title');
        
        // تصفير الجدول واختيار الملف عند التبديل بين الأقسام
        tableContainer.innerHTML = '<p class="placeholder-text">يرجى رفع ملف CSV لعرض البيانات الخاصة بهذا القسم...</p>';
        fileInput.value = ''; 
    });
});

// 2. برمجة قارئ ملفات CSV
fileInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    
    if (file) {
        // إنشاء كائن لقراءة محتوى الملف
        const reader = new FileReader();
        
        // عند الانتهاء من قراءة الملف، قم بتنفيذ هذه الدالة
        reader.onload = function(e) {
            const text = e.target.result;
            displayCSVAsTable(text);
        };
        
        // قراءة الملف كنص (Text)
        reader.readAsText(file);
    }
});

// 3. دالة لتحويل النص (CSV) إلى جدول HTML
function displayCSVAsTable(csvText) {
    // تقسيم النص إلى أسطر
    const rows = csvText.split('\n');
    
    // إنشاء عنصر الجدول
    let html = '<table>';
    
    // المرور على كل سطر
    rows.forEach((row, index) => {
        // تجاهل الأسطر الفارغة
        if (row.trim() === '') return;
        
        // تقسيم السطر إلى أعمدة بناءً على الفاصلة (,)
        const columns = row.split(',');
        
        html += '<tr>';
        
        columns.forEach(column => {
            // السطر الأول (index 0) عادة ما يكون عناوين الجدول (th)
            if (index === 0) {
                html += `<th>${column.trim()}</th>`;
            } else {
                html += `<td>${column.trim()}</td>`;
            }
        });
        
        html += '</tr>';
    });
    
    html += '</table>';
    
    // إدراج الجدول في الصفحة
    tableContainer.innerHTML = html;
}
