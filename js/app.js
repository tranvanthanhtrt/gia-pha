// ===== MAIN APP =====
const App = {
    members: [],
    zoom: 1,
    isPanning: false,
    startX: 0, startY: 0,
    scrollLeft: 0, scrollTop: 0,

    async init() {
        DataStore.init();
        await this.loadData();
        this.setupEvents();
        this.updateStats();
        this.loadSettings();
    },

    async loadData() {
        this.members = await DataStore.getMembers();
        TreeRenderer.render(this.members, 'treeContainer');
        this.updateStats();
    },

    loadSettings() {
        const settings = DataStore.getSettings();
        document.getElementById('familyName').textContent = settings.familyName || 'Gia Phả';
        document.getElementById('settingFamilyName').value = settings.familyName || '';
        document.getElementById('settingDataMode').value = settings.mode || 'local';
        document.getElementById('settingSupabaseUrl').value = settings.supabaseUrl || '';
        document.getElementById('settingSupabaseKey').value = settings.supabaseKey || '';
        document.getElementById('supabaseSettings').style.display = settings.mode === 'supabase' ? 'block' : 'none';
    },

    updateStats() {
        document.getElementById('statTotal').textContent = this.members.length;
        const gens = new Set(this.members.map(m => m.generation).filter(Boolean));
        document.getElementById('statGenerations').textContent = gens.size || 0;
        const alive = this.members.filter(m => !m.death_date).length;
        document.getElementById('statAlive').textContent = alive;
    },

    // ===== EVENTS =====
    setupEvents() {
        // Zoom
        document.getElementById('btnZoomIn').onclick = () => this.setZoom(this.zoom + 0.15);
        document.getElementById('btnZoomOut').onclick = () => this.setZoom(this.zoom - 0.15);
        document.getElementById('btnFitView').onclick = () => this.setZoom(1);

        // Pan (drag to scroll)
        const wrapper = document.getElementById('treeWrapper');
        wrapper.addEventListener('mousedown', (e) => {
            if (e.target.closest('.member-card')) return;
            this.isPanning = true;
            this.startX = e.pageX - wrapper.offsetLeft;
            this.startY = e.pageY - wrapper.offsetTop;
            this.scrollLeft = wrapper.scrollLeft;
            this.scrollTop = wrapper.scrollTop;
        });
        wrapper.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;
            e.preventDefault();
            const x = e.pageX - wrapper.offsetLeft;
            const y = e.pageY - wrapper.offsetTop;
            wrapper.scrollLeft = this.scrollLeft - (x - this.startX);
            wrapper.scrollTop = this.scrollTop - (y - this.startY);
        });
        wrapper.addEventListener('mouseup', () => this.isPanning = false);
        wrapper.addEventListener('mouseleave', () => this.isPanning = false);

        // Mouse wheel zoom
        wrapper.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                this.setZoom(this.zoom + (e.deltaY > 0 ? -0.1 : 0.1));
            }
        }, { passive: false });

        // Add member
        document.getElementById('btnAddMember').onclick = () => this.openAddModal();

        // Modal
        document.getElementById('btnCloseModal').onclick = () => this.closeModal();
        document.getElementById('btnCancelModal').onclick = () => this.closeModal();
        document.getElementById('modalOverlay').onclick = (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        };
        document.getElementById('btnSaveMember').onclick = () => this.saveMember();
        document.getElementById('btnDeleteMember').onclick = () => this.deleteMember();

        // Panel
        document.getElementById('btnClosePanel').onclick = () => this.closePanel();
        document.getElementById('panelOverlay').onclick = () => this.closePanel();

        // Settings
        document.getElementById('btnSettings').onclick = () => this.openSettings();
        document.getElementById('btnCloseSettings').onclick = () => this.closeSettings();
        document.getElementById('settingsOverlay').onclick = (e) => {
            if (e.target === e.currentTarget) this.closeSettings();
        };
        document.getElementById('btnSaveSettings').onclick = () => this.saveSettings();
        document.getElementById('btnLoadDemo').onclick = () => this.loadDemo();
        document.getElementById('settingSupabaseUrl').oninput = (e) => {
            if (document.getElementById('settingDataMode').value === 'supabase') {
                DataStore.supabaseUrl = e.target.value;
            }
        };
        document.getElementById('settingSupabaseKey').oninput = (e) => {
            if (document.getElementById('settingDataMode').value === 'supabase') {
                DataStore.supabaseKey = e.target.value;
            }
        };
        document.getElementById('btnExportData').onclick = () => this.exportData();
        document.getElementById('btnImportData').onclick = () => document.getElementById('importFile').click();
        document.getElementById('importFile').onchange = (e) => this.importData(e);

        document.getElementById('settingDataMode').onchange = (e) => {
            document.getElementById('supabaseSettings').style.display =
                e.target.value === 'supabase' ? 'block' : 'none';
        };
    },

    setZoom(val) {
        this.zoom = Math.max(0.3, Math.min(2, val));
        document.getElementById('treeContainer').style.transform = `scale(${this.zoom})`;
        // With absolute positioning, SVG coordinates are fixed — no redraw needed
    },

    // ===== MEMBER DETAIL PANEL =====
    showMemberDetail(id) {
        const m = this.members.find(x => x.id === id);
        if (!m) return;

        const spouse = m.spouse_id ? this.members.find(x => x.id === m.spouse_id) : null;
        const parent = m.parent_id ? this.members.find(x => x.id === m.parent_id) : null;
        const children = this.members.filter(x => x.parent_id === m.id);

        const birthStr = m.birth_date ? this.formatDate(m.birth_date) : 'Không rõ';
        const deathStr = m.death_date ? this.formatDate(m.death_date) : (m.death_date === null ? '' : 'Không rõ');
        const age = this.calcAge(m.birth_date, m.death_date);

        const avatarContent = m.photo_url
            ? `<img src="${m.photo_url}" alt="${m.name}">`
            : `<i class="fas fa-${m.gender === 'male' ? 'mars' : 'venus'} avatar-icon"></i>`;

        const statusBadge = m.death_date
            ? `<span class="status-badge dead"><i class="fas fa-cross"></i> Đã mất</span>`
            : `<span class="status-badge alive"><i class="fas fa-heart"></i> Còn sống</span>`;

        const childrenLinks = children.map(c =>
            `<a onclick="App.showMemberDetail('${c.id}')">${c.name}</a>`
        ).join(', ');

        const spouseLink = spouse
            ? `<a onclick="App.showMemberDetail('${spouse.id}')">${spouse.name}</a>`
            : '';
        const parentLink = parent
            ? `<a onclick="App.showMemberDetail('${parent.id}')">${parent.name}</a>`
            : '';

        document.getElementById('panelBody').innerHTML = `
            <div class="detail-avatar ${m.gender}">${avatarContent}</div>
            <div class="detail-name">${m.name}</div>
            <div class="detail-dates">
                ${birthStr}${deathStr ? ' — ' + deathStr : ''}
                ${age ? ` · ${age} tuổi` : ''}
            </div>
            <div class="detail-status">${statusBadge}</div>
            <div class="detail-info">
                <div class="info-row"><span class="label">Giới tính</span><span class="value">${m.gender === 'male' ? '♂ Nam' : '♀ Nữ'}</span></div>
                <div class="info-row"><span class="label">Đời thứ</span><span class="value">${m.generation || '—'}</span></div>
                ${parentLink ? `<div class="info-row"><span class="label">Cha/Mẹ</span><span class="value">${parentLink}</span></div>` : ''}
                ${spouseLink ? `<div class="info-row"><span class="label">Vợ/Chồng</span><span class="value">${spouseLink}</span></div>` : ''}
                ${children.length ? `<div class="info-row"><span class="label">Con (${children.length})</span><span class="value">${childrenLinks}</span></div>` : ''}
            </div>
            ${m.bio ? `<div class="detail-bio"><strong>📝 Ghi chú:</strong> ${m.bio}</div>` : ''}
            <div class="detail-actions">
                <button class="btn btn-primary btn-block" onclick="App.openEditModal('${m.id}')">
                    <i class="fas fa-edit"></i> Chỉnh sửa thông tin
                </button>
            </div>
        `;

        document.getElementById('detailPanel').classList.add('active');
        document.getElementById('panelOverlay').classList.add('active');
    },

    closePanel() {
        document.getElementById('detailPanel').classList.remove('active');
        document.getElementById('panelOverlay').classList.remove('active');
    },

    // ===== ADD/EDIT MODAL =====
    openAddModal() {
        document.getElementById('modalTitle').textContent = 'Thêm Thành Viên';
        document.getElementById('memberForm').reset();
        document.getElementById('memberId').value = '';
        document.getElementById('btnDeleteMember').style.display = 'none';
        this.populateParentSelect();
        this.populateSpouseSelect();
        document.getElementById('modalOverlay').classList.add('active');
    },

    openEditModal(id) {
        this.closePanel();
        const m = this.members.find(x => x.id === id);
        if (!m) return;

        document.getElementById('modalTitle').textContent = 'Chỉnh Sửa Thành Viên';
        document.getElementById('memberId').value = m.id;
        document.getElementById('memberName').value = m.name;
        document.getElementById('memberGender').value = m.gender;
        document.getElementById('memberBirth').value = m.birth_date || '';
        document.getElementById('memberDeath').value = m.death_date || '';
        document.getElementById('memberGeneration').value = m.generation || 1;
        document.getElementById('memberPhoto').value = m.photo_url || '';
        document.getElementById('memberBio').value = m.bio || '';

        this.populateParentSelect(m.id);
        this.populateSpouseSelect(m.id);

        document.getElementById('memberParent').value = m.parent_id || '';
        document.getElementById('memberSpouse').value = m.spouse_id || '';
        document.getElementById('btnDeleteMember').style.display = 'inline-flex';

        document.getElementById('modalOverlay').classList.add('active');
    },

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('active');
    },

    populateParentSelect(excludeId) {
        const select = document.getElementById('memberParent');
        select.innerHTML = '<option value="">-- Không có (gốc) --</option>';
        this.members.forEach(m => {
            if (m.id === excludeId) return;
            select.innerHTML += `<option value="${m.id}">${m.name} (Đời ${m.generation || '?'})</option>`;
        });
    },

    populateSpouseSelect(excludeId) {
        const select = document.getElementById('memberSpouse');
        select.innerHTML = '<option value="">-- Chưa có --</option>';
        this.members.forEach(m => {
            if (m.id === excludeId) return;
            // Only show members without spouse, or current spouse
            const currentMember = excludeId ? this.members.find(x => x.id === excludeId) : null;
            if (!m.spouse_id || (currentMember && m.spouse_id === currentMember.id)) {
                select.innerHTML += `<option value="${m.id}">${m.name}</option>`;
            }
        });
    },

    async saveMember() {
        const name = document.getElementById('memberName').value.trim();
        if (!name) {
            this.toast('Vui lòng nhập họ tên', 'error');
            return;
        }

        const id = document.getElementById('memberId').value || null;
        const member = {
            id,
            name,
            gender: document.getElementById('memberGender').value,
            birth_date: document.getElementById('memberBirth').value || null,
            death_date: document.getElementById('memberDeath').value || null,
            parent_id: document.getElementById('memberParent').value || null,
            spouse_id: document.getElementById('memberSpouse').value || null,
            generation: parseInt(document.getElementById('memberGeneration').value) || 1,
            photo_url: document.getElementById('memberPhoto').value || '',
            bio: document.getElementById('memberBio').value || '',
        };

        const saved = await DataStore.saveMember(member);

        // NOTE: spouse_id is ONE-WAY. Only this member points to the spouse.
        // Do NOT set spouse.spouse_id back — that would create bidirectional links
        // which breaks findRoots().

        this.closeModal();
        await this.loadData();
        this.toast(id ? 'Đã cập nhật thành công!' : 'Đã thêm thành viên mới!', 'success');
    },

    async deleteMember() {
        const id = document.getElementById('memberId').value;
        if (!id) return;

        const m = this.members.find(x => x.id === id);
        const children = this.members.filter(x => x.parent_id === id);

        if (children.length > 0) {
            if (!confirm(`${m.name} có ${children.length} con. Xóa sẽ mất liên kết cha/mẹ với các con. Tiếp tục?`)) return;
        } else {
            if (!confirm(`Xóa ${m.name}?`)) return;
        }

        await DataStore.deleteMember(id);
        this.closeModal();
        await this.loadData();
        this.toast('Đã xóa thành viên', 'success');
    },

    // ===== SETTINGS =====
    openSettings() {
        const settings = DataStore.getSettings();
        document.getElementById('settingFamilyName').value = settings.familyName || '';
        document.getElementById('settingDataMode').value = settings.mode || 'local';
        document.getElementById('settingSupabaseUrl').value = settings.supabaseUrl || '';
        document.getElementById('settingSupabaseKey').value = settings.supabaseKey || '';
        document.getElementById('supabaseSettings').style.display = settings.mode === 'supabase' ? 'block' : 'none';
        document.getElementById('settingsOverlay').classList.add('active');
    },

    closeSettings() {
        document.getElementById('settingsOverlay').classList.remove('active');
    },

    saveSettings() {
        const settings = {
            familyName: document.getElementById('settingFamilyName').value || 'Gia Phả',
            mode: document.getElementById('settingDataMode').value,
            supabaseUrl: document.getElementById('settingSupabaseUrl').value,
            supabaseKey: document.getElementById('settingSupabaseKey').value,
        };
        DataStore.saveSettings(settings);
        document.getElementById('familyName').textContent = settings.familyName;
        document.getElementById('supabaseSettings').style.display = settings.mode === 'supabase' ? 'block' : 'none';
        this.closeSettings();
        this.loadData();
        this.toast('Đã lưu cài đặt!', 'success');
    },

    async loadDemo() {
        if (!confirm('Tải dữ liệu mẫu sẽ thay thế dữ liệu hiện tại. Tiếp tục?')) return;
        await DataStore.loadDemoData();
        this.closeSettings();
        await this.loadData();
        this.loadSettings();
        this.toast('Đã tải dữ liệu mẫu (3 đời, 15 thành viên)!', 'success');
    },

    async exportData() {
        const json = await DataStore.exportData();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gia-pha-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast('Đã xuất file JSON!', 'success');
    },

    async importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const ok = await DataStore.importData(text);
        if (ok) {
            this.closeSettings();
            await this.loadData();
            this.loadSettings();
            this.toast('Đã nhập dữ liệu thành công!', 'success');
        } else {
            this.toast('File không hợp lệ!', 'error');
        }
        e.target.value = '';
    },

    // ===== UTILS =====
    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    calcAge(birth, death) {
        if (!birth) return null;
        const b = new Date(birth);
        const d = death ? new Date(death) : new Date();
        let age = d.getFullYear() - b.getFullYear();
        if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--;
        return age > 0 ? age : null;
    },

    toast(msg, type = '') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${msg}`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => App.init());
