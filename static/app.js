// Global State
let searchTimer = null;
let currentTab = 'docs';
let allDocumentsCache = [];
let pendingDeleteDocId = null;
let pendingDownloadDocId = null;
let lastAiResponseData = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    startClock();
    loadDocuments();
    loadLogs();
});

// Clock function
function startClock() {
    function updateClock() {
        const now = new Date();
        const str = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0') + ':' +
            String(now.getSeconds()).padStart(2, '0');
        const clockEl = document.getElementById('liveClock');
        if (clockEl) clockEl.innerText = str;
    }
    updateClock();
    setInterval(updateClock, 1000);
}

// Requested Feature 2: Top System Reset / Refresh Button
function resetSystemState() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('docTitleFilter').value = '';
    document.getElementById('statCategoryDropdown').value = '';
    
    switchTab('docs');
    loadDocuments();
    loadLogs();
}

// Tab Switching
function switchTab(tabName) {
    currentTab = tabName;
    const tabs = ['docs', 'ai', 'logs', 'exports'];
    
    tabs.forEach(t => {
        const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const sec = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        
        if (t === tabName) {
            sec.classList.remove('hidden');
            btn.classList.add('text-blue-900', 'border-blue-800');
            btn.classList.remove('text-slate-600', 'border-transparent');
        } else {
            sec.classList.add('hidden');
            btn.classList.remove('text-blue-900', 'border-blue-800');
            btn.classList.add('text-slate-600', 'border-transparent');
        }
    });

    if (tabName === 'logs') loadLogs();
    if (tabName === 'exports') renderExportDocSelectors();
}

// Fetch and render documents
async function loadDocuments() {
    const q = document.getElementById('searchInput')?.value.trim() || '';
    const cat = document.getElementById('categoryFilter')?.value || '';
    const titleFilter = document.getElementById('docTitleFilter')?.value || '';
    
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}&title=${encodeURIComponent(titleFilter)}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            allDocumentsCache = data.results;
            renderDocumentsGrid(data.results);
            updateDashboardStats(data.results);
            updateCategoryFilterDropdown(data.results);
            updateDocTitleFilterDropdown(data.results);
            renderExportDocSelectors();
        }
    } catch (err) {
        console.error('Error fetching documents:', err);
    }
}

// Dashboard Category Breakdown Dropdown Selector
function updateDashboardStats(docsList) {
    document.getElementById('statTotalDocs').innerText = docsList.length;
    
    const catCounts = {};
    docsList.forEach(d => {
        const cats = d.categories || [d.category];
        cats.forEach(c => {
            if (c) catCounts[c] = (catCounts[c] || 0) + 1;
        });
    });
    
    const uniqueCatNames = Object.keys(catCounts);
    document.getElementById('statCategories').innerText = uniqueCatNames.length;
    
    const statDropdown = document.getElementById('statCategoryDropdown');
    if (statDropdown) {
        const currentSelected = statDropdown.value;
        statDropdown.innerHTML = '<option value="">-- เลือกดูจำนวนเอกสารแยกตามหมวดหมู่ --</option>';
        
        uniqueCatNames.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.innerText = `${c} (${catCounts[c]} เอกสาร)`;
            if (c === currentSelected) opt.selected = true;
            statDropdown.appendChild(opt);
        });
    }
}

function onDashboardCategorySelect(catVal) {
    const catFilter = document.getElementById('categoryFilter');
    if (catFilter) {
        catFilter.value = catVal;
        onCategoryFilterChange();
    }
}

// Category Filter Dropdown displaying Document Count in ( )
function updateCategoryFilterDropdown(docsList) {
    const dropdown = document.getElementById('categoryFilter');
    if (!dropdown) return;
    
    const currentVal = dropdown.value;
    const catCounts = {};
    
    docsList.forEach(d => {
        (d.categories || [d.category]).forEach(c => {
            if (c) catCounts[c] = (catCounts[c] || 0) + 1;
        });
    });
    
    dropdown.innerHTML = '<option value="">-- แสดงทุกหมวดหมู่ --</option>';
    Object.keys(catCounts).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.innerText = `${c} (${catCounts[c]})`;
        if (c === currentVal) opt.selected = true;
        dropdown.appendChild(opt);
    });
}

// Requested Feature 3: Cascading Category -> Document Title Filter Dropdown
function onCategoryFilterChange() {
    updateDocTitleFilterDropdown(allDocumentsCache);
    document.getElementById('docTitleFilter').value = '';
    loadDocuments();
}

function updateDocTitleFilterDropdown(docsList) {
    const dropdown = document.getElementById('docTitleFilter');
    if (!dropdown) return;
    
    const selectedCat = document.getElementById('categoryFilter')?.value || '';
    const currentVal = dropdown.value;
    
    dropdown.innerHTML = '<option value="">-- แสดงทุกชื่อเอกสาร --</option>';
    
    docsList.forEach(d => {
        const cats = d.categories || [d.category];
        if (!selectedCat || cats.includes(selectedCat)) {
            const opt = document.createElement('option');
            opt.value = d.title;
            opt.innerText = d.title;
            if (d.title === currentVal) opt.selected = true;
            dropdown.appendChild(opt);
        }
    });
}

// Render Document Cards Grid
function renderDocumentsGrid(docs) {
    const container = document.getElementById('docsGrid');
    if (!container) return;
    
    if (docs.length === 0) {
        container.innerHTML = `
            <div class="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
                <i class="fa-solid fa-folder-open text-4xl mb-3 text-slate-300"></i>
                <p class="font-semibold text-sm">ไม่พบเอกสารตรงกับเงื่อนไขการสืบค้น</p>
            </div>
        `;
        return;
    }

    container.innerHTML = docs.map(d => {
        const cats = d.categories || [d.category || 'ยุทธศาสตร์และข้อเสนอพันธมิตร (Strategy & Partnership)'];
        
        const catBadgesHtml = cats.map(c => `
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-blue-50 text-blue-800 border-blue-200">
                <i class="fa-solid fa-tag text-[10px]"></i> ${c}
            </span>
        `).join(' ');

        return `
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 hover:shadow-md transition">
                <!-- Header Info -->
                <div class="flex flex-col md:flex-row justify-between md:items-start gap-3 border-b border-slate-100 pb-3">
                    <div>
                        <div class="flex flex-wrap items-center gap-2 mb-1.5">
                            ${catBadgesHtml}
                            <button onclick="openDocPreview('${d.id}')" class="text-[11px] font-mono text-slate-500 hover:text-blue-700 bg-slate-100 px-2 py-0.5 rounded transition">
                                <i class="fa-solid fa-file-pdf text-rose-500"></i> ${d.filename} <i class="fa-solid fa-eye text-blue-600 ml-1"></i>
                            </button>
                        </div>
                        <h3 onclick="openDocPreview('${d.id}')" class="text-base font-bold text-slate-900 hover:text-blue-700 cursor-pointer transition flex items-center gap-2">
                            <span>${d.title}</span>
                            <span class="text-xs bg-blue-50 text-blue-700 font-normal px-2 py-0.5 rounded-full border border-blue-200"><i class="fa-solid fa-expand text-[10px]"></i> Preview</span>
                        </h3>
                        <p class="text-xs text-slate-500 mt-1">
                            <i class="fa-solid fa-building-columns text-slate-400"></i> แหล่งที่มา: <span class="font-medium text-slate-700">${d.source_agency}</span>
                        </p>
                    </div>

                    <!-- Date & Timestamp Badge & Requested Download Button -->
                    <div class="flex flex-col md:items-end gap-2">
                        <div class="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 whitespace-nowrap">
                            <i class="fa-solid fa-clock-check text-emerald-600"></i>
                            <span>วิเคราะห์เมื่อ: ${d.analyzed_at}</span>
                        </div>
                        <!-- Requested Feature 4: Download button opens Download Checklist Modal -->
                        <button onclick="openDownloadChecklistModal('${d.id}')" class="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1.5 w-full md:w-auto justify-center">
                            <i class="fa-solid fa-download"></i> ดาวน์โหลดเอกสาร (Download)
                        </button>
                    </div>
                </div>

                <!-- Summary Text -->
                <div>
                    <div class="text-xs font-bold text-slate-700 mb-1 uppercase"><i class="fa-solid fa-align-left text-blue-600"></i> สรุปสาระสำคัญ (Analyze Summary):</div>
                    <p class="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        ${d.summary}
                    </p>
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-between items-center pt-2 border-t border-slate-100">
                    <div class="flex gap-2">
                        <button onclick="openDocPreview('${d.id}')" class="text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition flex items-center gap-1">
                            <i class="fa-solid fa-eye"></i> เปิดดูเอกสาร Preview
                        </button>
                        <button onclick="reanalyzeDocument('${d.id}')" class="text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition flex items-center gap-1">
                            <i class="fa-solid fa-arrows-rotate"></i> วิเคราะห์ใหม่
                        </button>
                    </div>
                    <button onclick="openDeleteModal('${d.id}', '${d.title}')" class="text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition flex items-center gap-1">
                        <i class="fa-solid fa-trash"></i> ลบเอกสาร (Remove)
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function debounceSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadDocuments, 300);
}

// Requested Feature 1: Document Preview Modal displaying Summary THEN Original File Content Preview
function openDocPreview(docId) {
    const doc = allDocumentsCache.find(d => d.id === docId);
    if (!doc) return;

    document.getElementById('previewDocTitle').innerText = doc.title;
    document.getElementById('previewDocSub').innerText = `แหล่งที่มา: ${doc.source_agency} | ไฟล์: ${doc.filename}`;
    document.getElementById('previewTimestamp').innerText = `วิเคราะห์เมื่อ: ${doc.analyzed_at}`;

    document.getElementById('previewHeaderDownloadBtn').onclick = () => { closeDocPreviewModal(); openDownloadChecklistModal(doc.id); };
    document.getElementById('previewFooterDownloadBtn').onclick = () => { closeDocPreviewModal(); openDownloadChecklistModal(doc.id); };

    const cats = doc.categories || [doc.category];
    document.getElementById('previewCatBadges').innerHTML = cats.map(c => `
        <span class="text-xs bg-amber-400 text-slate-950 font-bold px-2.5 py-0.5 rounded-full">
            <i class="fa-solid fa-tag"></i> ${c}
        </span>
    `).join(' ');

    const ea = doc.expert_analysis || {};
    const ckp = doc.categorized_key_points || {};

    const stakeholdersHtml = (doc.stakeholders || []).map(s => `
        <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
            <span class="font-bold text-blue-900">${s.rank || ''}. ${s.name}</span>
            <span class="text-slate-500 font-normal">(${s.role})</span>
            <p class="text-slate-600 mt-1">${s.responsibility}</p>
        </div>
    `).join('');

    const timelineHtml = (doc.timeline || []).map(t => `
        <tr class="hover:bg-slate-50 text-xs">
            <td class="p-2 border border-slate-200 font-semibold text-slate-800">${t.topic}</td>
            <td class="p-2 border border-slate-200 text-slate-600">${t.stakeholders}</td>
            <td class="p-2 border border-slate-200 font-mono text-emerald-700 font-bold">${t.timeframe}</td>
        </tr>
    `).join('');

    document.getElementById('previewModalBody').innerHTML = `
        <div class="space-y-5">
            <!-- PART 1: ANALYSIS SUMMARY SECTION -->
            <div class="border-b border-slate-200 pb-4 space-y-4">
                <div class="text-sm font-bold text-blue-950 uppercase border-b-2 border-blue-800 pb-1 flex items-center gap-2">
                    <i class="fa-solid fa-chart-line text-blue-700"></i> Part 1: ผลการวิเคราะห์สรุปเชิงลึก (Analysis Summary & Expert Panel)
                </div>

                <div class="bg-blue-50/70 p-4 rounded-xl border border-blue-200">
                    <h4 class="font-bold text-blue-950 text-xs mb-1"><i class="fa-solid fa-align-left text-blue-700"></i> สรุปสาระสำคัญ (Analyze Summary):</h4>
                    <p class="text-slate-800 leading-relaxed text-xs">${doc.summary}</p>
                </div>

                ${doc.stakeholders && doc.stakeholders.length > 0 ? `
                    <div class="space-y-2">
                        <h4 class="font-bold text-slate-900 text-xs"><i class="fa-solid fa-users-gear text-blue-700"></i> ผู้มีส่วนเกี่ยวข้องและบทบาทหน้าที่:</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">${stakeholdersHtml}</div>
                    </div>
                ` : ''}

                ${doc.timeline && doc.timeline.length > 0 ? `
                    <div class="space-y-2">
                        <h4 class="font-bold text-slate-900 text-xs"><i class="fa-solid fa-calendar-check text-emerald-700"></i> กรอบระยะเวลาและผู้รับผิดชอบ:</h4>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse bg-white rounded-lg border border-slate-200">
                                <thead>
                                    <tr class="bg-slate-100 text-slate-700 font-bold text-xs">
                                        <th class="p-2 border border-slate-200">เรื่อง / กิจกรรม</th>
                                        <th class="p-2 border border-slate-200">ผู้มีส่วนเกี่ยวข้อง</th>
                                        <th class="p-2 border border-slate-200">กรอบเวลา</th>
                                    </tr>
                                </thead>
                                <tbody>${timelineHtml}</tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}

                ${ea.business ? `
                    <div class="bg-indigo-50/70 p-4 rounded-xl border border-indigo-200 space-y-3">
                        <h4 class="font-bold text-indigo-950 text-xs border-b border-indigo-200 pb-2"><i class="fa-solid fa-user-tie text-indigo-700"></i> มุมมองวิเคราะห์โดยผู้เชี่ยวชาญ 6 ด้าน:</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div class="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-sm"><span class="font-bold text-blue-900">💼 ด้านธุรกิจ:</span> <p class="mt-1">${ea.business}</p></div>
                            <div class="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-sm"><span class="font-bold text-purple-900">⚖️ ด้านกฎหมาย:</span> <p class="mt-1">${ea.legal}</p></div>
                            <div class="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-sm"><span class="font-bold text-emerald-900">💰 ด้านการลงทุน:</span> <p class="mt-1">${ea.investor}</p></div>
                            <div class="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-sm"><span class="font-bold text-sky-900">💻 ด้านไอที:</span> <p class="mt-1">${ea.it}</p></div>
                            <div class="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-sm"><span class="font-bold text-amber-900">🎯 ด้านกลยุทธ์:</span> <p class="mt-1">${ea.strategy}</p></div>
                            <div class="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-sm"><span class="font-bold text-teal-900">📊 ด้านเศรษฐศาสตร์:</span> <p class="mt-1">${ea.economics}</p></div>
                        </div>
                        ${ea.recommendations ? `<div class="bg-amber-100 p-2.5 rounded-lg border border-amber-300 font-medium text-xs">💡 <strong>ข้อแนะนำเพิ่มเติม:</strong> ${ea.recommendations}</div>` : ''}
                    </div>
                ` : ''}
            </div>

            <!-- PART 2: ORIGINAL FILE CONTENT PREVIEW SECTION -->
            <div class="space-y-3">
                <div class="text-sm font-bold text-emerald-950 uppercase border-b-2 border-emerald-700 pb-1 flex items-center justify-between">
                    <span class="flex items-center gap-2"><i class="fa-solid fa-file-pdf text-rose-600"></i> Part 2: เนื้อหาไฟล์ต้นฉบับ (Original File Content Preview)</span>
                    <span class="text-xs text-slate-500 font-mono font-normal">ไฟล์: ${doc.filename}</span>
                </div>

                <div class="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 font-mono text-xs leading-relaxed max-h-72 overflow-y-auto space-y-2">
                    <p class="text-emerald-400 font-bold">--- ORIGINAL DOCUMENT DATA STREAM ---</p>
                    <p class="text-slate-300">Document Title: ${doc.title}</p>
                    <p class="text-slate-300">Source Agency: ${doc.source_agency}</p>
                    <p class="text-slate-300">File Size: ${doc.file_size || 'N/A'}</p>
                    <p class="text-slate-300">Categories: ${(doc.categories || []).join(' | ')}</p>
                    <hr class="border-slate-800 my-2">
                    <p class="text-slate-100 whitespace-pre-line">${doc.summary}</p>
                    ${(doc.key_points || []).map(kp => `<p class="text-slate-400 pl-4">• ${kp}</p>`).join('')}
                    <p class="text-emerald-400 font-bold mt-2">--- END OF PREVIEW STREAM ---</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('docPreviewModal').classList.remove('hidden');
    document.getElementById('docPreviewModal').classList.add('flex');
}

function closeDocPreviewModal() {
    document.getElementById('docPreviewModal').classList.add('hidden');
    document.getElementById('docPreviewModal').classList.remove('flex');
}

// Requested Feature 1 & 4: Download Options Checklist Modal Handlers
function openDownloadChecklistModal(docId) {
    const doc = allDocumentsCache.find(d => d.id === docId);
    if (!doc) return;
    
    pendingDownloadDocId = docId;
    document.getElementById('downloadTargetDocTitle').innerText = `${doc.title} (${doc.filename})`;
    
    document.getElementById('downloadChecklistModal').classList.remove('hidden');
    document.getElementById('downloadChecklistModal').classList.add('flex');
}

function closeDownloadChecklistModal() {
    pendingDownloadDocId = null;
    document.getElementById('downloadChecklistModal').classList.add('hidden');
    document.getElementById('downloadChecklistModal').classList.remove('flex');
}

async function executeCustomDownloadPackage() {
    if (!pendingDownloadDocId) return;

    const includeSummary = document.getElementById('chkIncludeSummary').checked;
    const includeOriginal = document.getElementById('chkIncludeOriginal').checked;
    const includeRelated = document.getElementById('chkIncludeRelated').checked;

    try {
        const res = await fetch(`/api/documents/${pendingDownloadDocId}/download_custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                include_summary: includeSummary,
                include_original: includeOriginal,
                include_related: includeRelated
            })
        });

        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Benjarong_Package_${pendingDownloadDocId}.txt`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            closeDownloadChecklistModal();
            loadLogs();
        } else {
            alert('ไม่สามารถดาวน์โหลดไฟล์ได้');
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดทางเครือข่ายในการดาวน์โหลด');
    }
}

// Re-analyze Document Action
async function reanalyzeDocument(docId) {
    try {
        const res = await fetch(`/api/documents/${docId}/analyze`, { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            loadDocuments();
            loadLogs();
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการวิเคราะห์เอกสารใหม่');
    }
}

// Delete Confirmation Pop-up Modal Handlers
function openDeleteModal(docId, title) {
    pendingDeleteDocId = docId;
    document.getElementById('deleteModalTargetTitle').innerText = title;
    const btn = document.getElementById('btnConfirmDeleteExec');
    btn.onclick = () => executeDeleteDocument(docId);
    
    document.getElementById('deleteConfirmModal').classList.remove('hidden');
    document.getElementById('deleteConfirmModal').classList.add('flex');
}

function closeDeleteModal() {
    pendingDeleteDocId = null;
    document.getElementById('deleteConfirmModal').classList.add('hidden');
    document.getElementById('deleteConfirmModal').classList.remove('flex');
}

async function executeDeleteDocument(docId) {
    if (!docId) return;
    try {
        const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            closeDeleteModal();
            loadDocuments();
            loadLogs();
        } else {
            alert(data.message || 'การลบล้มเหลว');
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดทางเครือข่ายในการลบเอกสาร');
    }
}

// Upload Modal Handlers
function openUploadModal() {
    document.getElementById('uploadModal').classList.remove('hidden');
    document.getElementById('uploadModal').classList.add('flex');
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.add('hidden');
    document.getElementById('uploadModal').classList.remove('flex');
    document.getElementById('uploadForm').reset();
    document.getElementById('fileNameDisplay').innerText = '';
}

async function handleUploadSubmit(e) {
    e.preventDefault();
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    const submitBtn = document.getElementById('btnSubmitUpload');
    submitBtn.disabled = true;
    submitBtn.innerText = 'กำลังวิเคราะห์และจัดหมวดหมู่...';

    try {
        const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.status === 'success') {
            closeUploadModal();
            loadDocuments();
            loadLogs();
            alert('อัปโหลดและวิเคราะห์เอกสารใหม่สำเร็จ');
        } else {
            alert(data.message || 'การอัปโหลดล้มเหลว');
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดทางเครือข่าย');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-upload"></i> เพิ่มและวิเคราะห์ไฟล์';
    }
}

// AI Query Logic
function setPrompt(txt) {
    document.getElementById('aiPromptInput').value = txt;
}

async function submitAiQuery() {
    const input = document.getElementById('aiPromptInput');
    const prompt = input.value.trim();
    if (!prompt) return;

    const btn = document.getElementById('btnAiSubmit');
    const responseBox = document.getElementById('aiResponseBox');
    const citationsBox = document.getElementById('aiCitationsBox');
    const citationsContainer = document.getElementById('citationsContainer');
    const exportBar = document.getElementById('aiExportBar');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-lg mb-1"></i><span class="text-xs">กำลังประมวลผล...</span>';
    responseBox.innerText = '🤖 AI กำลังประมวลผลวิเคราะห์คำตอบจากคลังเอกสาร...';

    try {
        const res = await fetch('/api/ai/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt })
        });
        const data = await res.json();

        if (data.status === 'success') {
            lastAiResponseData = data;
            responseBox.innerText = data.response;
            exportBar.classList.remove('hidden');

            if (data.citations && data.citations.length > 0) {
                citationsBox.classList.remove('hidden');
                citationsContainer.innerHTML = data.citations.map(c => `
                    <div class="bg-white p-3 rounded-lg border border-slate-200 text-xs shadow-sm space-y-1">
                        <div class="font-bold text-blue-900 cursor-pointer hover:underline" onclick="openDocPreview('${c.doc_id}')">${c.title}</div>
                        <div class="text-slate-500 font-mono text-[11px]"><i class="fa-solid fa-file-pdf text-rose-500"></i> ${c.filename}</div>
                        <div class="text-slate-600"><i class="fa-solid fa-tag text-slate-400"></i> ${(c.categories || []).join(', ')}</div>
                        <div class="text-emerald-600 text-[10px] font-semibold"><i class="fa-solid fa-clock"></i> บันทึกเมื่อ: ${c.analyzed_at}</div>
                    </div>
                `).join('');
            } else {
                citationsBox.classList.add('hidden');
            }

            loadLogs();
        } else {
            responseBox.innerText = 'เกิดข้อผิดพลาดในการประมวลผลคำถาม';
        }
    } catch (err) {
        responseBox.innerText = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane text-lg mb-1"></i><span class="text-xs">ส่งคำถาม AI</span>';
    }
}

// Requested Feature 6: Export AI Query Response (DOCX, PDF Thai, PPTX)
async function exportAiResponse(fmt) {
    if (!lastAiResponseData) {
        alert('ยังไม่มีคำตอบ AI ที่สอบถาม');
        return;
    }

    try {
        const res = await fetch(`/api/ai/export/${fmt}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lastAiResponseData)
        });

        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Benjarong_AI_Query_Response.${fmt === 'pdf' ? 'pdf' : (fmt === 'pptx' ? 'pptx' : 'docx')}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            loadLogs();
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการส่งออกคำตอบ AI');
    }
}

// Selective Custom Report Exports
function renderExportDocSelectors() {
    const container = document.getElementById('exportDocSelectorContainer');
    if (!container) return;

    if (allDocumentsCache.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 p-2">ไม่มีเอกสารในระบบ</p>';
        return;
    }

    container.innerHTML = allDocumentsCache.map(d => `
        <label class="flex items-center gap-2 p-2 hover:bg-blue-50 rounded cursor-pointer transition text-xs">
            <input type="checkbox" value="${d.id}" class="export-doc-checkbox accent-blue-700 w-4 h-4" checked>
            <span class="font-semibold text-slate-800 truncate">${d.title}</span>
            <span class="text-[10px] text-slate-400 font-mono ml-auto">(${d.filename})</span>
        </label>
    `).join('');
}

function selectAllExportDocs(checked) {
    const cbs = document.querySelectorAll('.export-doc-checkbox');
    cbs.forEach(cb => cb.checked = checked);
}

function getSelectedDocIds() {
    const cbs = document.querySelectorAll('.export-doc-checkbox:checked');
    return Array.from(cbs).map(cb => cb.value);
}

function exportCustom(format) {
    const selectedIds = getSelectedDocIds();
    if (selectedIds.length === 0) {
        alert('กรุณาเลือกเอกสารอย่างน้อย 1 รายการเพื่อส่งออกรายงาน');
        return;
    }
    
    const url = `/api/export/${format}?doc_ids=${encodeURIComponent(selectedIds.join(','))}`;
    window.location.href = url;
}

// Audit Logs Loader
async function loadLogs() {
    try {
        const res = await fetch('/api/logs');
        const data = await res.json();
        if (data.status === 'success') {
            renderLogsTable(data.logs);
        }
    } catch (err) {
        console.error('Error fetching logs:', err);
    }
}

function renderLogsTable(logs) {
    const tbody = document.getElementById('logsTbody');
    if (!tbody) return;

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">ไม่มีบันทึกกิจกรรม</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(l => `
        <tr class="hover:bg-slate-50 transition">
            <td class="p-3 font-mono text-slate-500 whitespace-nowrap">${l.timestamp}</td>
            <td class="p-3 font-semibold text-blue-900">${l.action}</td>
            <td class="p-3 text-slate-700">${l.details}</td>
            <td class="p-3 text-slate-500">${l.user}</td>
            <td class="p-3 text-center">
                <span class="px-2 py-0.5 text-[10px] font-bold rounded ${l.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                    ${l.status}
                </span>
            </td>
        </tr>
    `).join('');
}

async function clearSystemLogs() {
    if (!confirm('คุณต้องการล้างบันทึกกิจกรรมทั้งหมดหรือไม่?')) return;
    try {
        await fetch('/api/logs', { method: 'DELETE' });
        loadLogs();
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการล้าง Log');
    }
}
