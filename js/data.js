// ===== DATA LAYER =====
// Supports localStorage (default) and Supabase

const DEFAULT_SETTINGS = {
    familyName: 'Gia phả Họ Trần Văn',
    mode: 'supabase',
    supabaseUrl: 'https://gyidiiqtutzakotfxnlm.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aWRpaXF0dXR6YWtvdGZ4bmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjM3NzQsImV4cCI6MjA4OTM5OTc3NH0.OyO_D1QAJCwYKtHd40tREmtLlPuTjYwpkKdwniB5eyg'
};

const DataStore = {
    mode: 'supabase', // forced supabase
    supabaseUrl: '',
    supabaseKey: '',
    supabase: null,

    init() {
        const settings = localStorage.getItem('giapha_settings');
        if (settings) {
            const s = JSON.parse(settings);
            this.mode = 'supabase';
            this.supabaseUrl = s.supabaseUrl || DEFAULT_SETTINGS.supabaseUrl;
            this.supabaseKey = s.supabaseKey || DEFAULT_SETTINGS.supabaseKey;
            if (this.supabaseUrl && this.supabaseKey) {
                this._initSupabase();
            }
        } else {
            // first run: use defaults and persist
            this.saveSettings(DEFAULT_SETTINGS);
            this._initSupabase();
        }
    },

    _initSupabase() {
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase SDK not loaded');
            return;
        }
        this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
    },

    // ===== MEMBERS CRUD =====
    async getMembers() {
        if (this.mode === 'supabase' && this.supabase) {
            const { data, error } = await this.supabase
                .from('family_members')
                .select('*')
                .order('generation', { ascending: true })
                .order('name', { ascending: true });
            if (error) {
                console.error('Supabase getMembers error:', error);
                return [];
            }
            return data || [];
        }
        const data = localStorage.getItem('giapha_members');
        return data ? JSON.parse(data) : [];
    },

    async saveMember(member) {
        if (this.mode === 'supabase' && this.supabase) {
            const payload = { ...member };
            if (!payload.id) {
                payload.id = this.generateId();
                payload.created_at = new Date().toISOString();
            }
            const { data, error } = await this.supabase
                .from('family_members')
                .upsert(payload, { onConflict: 'id' })
                .select()
                .single();
            if (error) {
                console.error('Supabase saveMember error:', error);
                return member;
            }
            return data;
        }

        const members = await this.getMembers();
        if (member.id) {
            const idx = members.findIndex(m => m.id === member.id);
            if (idx >= 0) members[idx] = { ...members[idx], ...member };
            else members.push(member);
        } else {
            member.id = this.generateId();
            member.created_at = new Date().toISOString();
            members.push(member);
        }
        this._saveLocal(members);
        return member;
    },

    async deleteMember(id) {
        if (this.mode === 'supabase' && this.supabase) {
            // clear spouse/parent refs then delete
            await this.supabase.from('family_members').update({ spouse_id: null }).eq('spouse_id', id);
            await this.supabase.from('family_members').update({ parent_id: null }).eq('parent_id', id);
            await this.supabase.from('family_members').delete().eq('id', id);
            return;
        }
        let members = await this.getMembers();
        members.forEach(m => {
            if (m.spouse_id === id) m.spouse_id = null;
            if (m.parent_id === id) m.parent_id = null;
        });
        members = members.filter(m => m.id !== id);
        this._saveLocal(members);
    },

    _saveLocal(members) {
        localStorage.setItem('giapha_members', JSON.stringify(members));
    },

    // ===== SETTINGS =====
    getSettings() {
        const data = localStorage.getItem('giapha_settings');
        return data ? JSON.parse(data) : { ...DEFAULT_SETTINGS };
    },

    saveSettings(settings) {
        localStorage.setItem('giapha_settings', JSON.stringify(settings));
        this.mode = 'supabase';
        this.supabaseUrl = settings.supabaseUrl || DEFAULT_SETTINGS.supabaseUrl;
        this.supabaseKey = settings.supabaseKey || DEFAULT_SETTINGS.supabaseKey;
        if (this.supabaseUrl && this.supabaseKey) {
            this._initSupabase();
        }
    },

    // ===== IMPORT/EXPORT =====
    async exportData() {
        const members = await this.getMembers();
        const settings = this.getSettings();
        return JSON.stringify({ settings, members }, null, 2);
    },

    async importData(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (this.mode === 'supabase' && this.supabase) {
                if (data.members) {
                    await this.supabase.from('family_members').delete().neq('id', '');
                    if (data.members.length) {
                        await this.supabase.from('family_members').upsert(data.members);
                    }
                }
                if (data.settings) this.saveSettings(data.settings);
                return true;
            }
            if (data.members) this._saveLocal(data.members);
            if (data.settings) this.saveSettings(data.settings);
            return true;
        } catch (e) {
            console.error('Import failed:', e);
            return false;
        }
    },

    // ===== DEMO DATA =====
    // RULE: spouse_id is ONE-WAY. Only the blood-line member sets spouse_id.
    //       The married-in spouse has spouse_id: null, parent_id: null.
    async loadDemoData() {
        return; // disabled demo seed
        const demo = [
            // ══════ ĐỜI 1 — Ông Bà Thủy Tổ ══════
            { id: '1',  name: 'Chu Văn Long',     gender: 'male',   birth_date: '1935-02-10', death_date: '2005-08-15', parent_id: null, spouse_id: '2',  generation: 1, bio: 'Ông Thủy Tổ dòng họ Chu. Thầy đồ Nho học.', photo_url: '' },
            { id: '2',  name: 'Trần Thị Mai',     gender: 'female', birth_date: '1938-06-20', death_date: '2012-11-03', parent_id: null, spouse_id: null, generation: 1, bio: 'Bà Thủy Tổ. Nữ hộ sinh.', photo_url: '' },

            // ══════ ĐỜI 2 — Con (4 người) ══════
            { id: '3',  name: 'Chu Văn Lâm',      gender: 'male',   birth_date: '1960-01-15', death_date: null, parent_id: '1', spouse_id: '4',  generation: 2, bio: 'Con trưởng. Giáo viên cấp 3.', photo_url: '' },
            { id: '4',  name: 'Nguyễn Thị Hằng',  gender: 'female', birth_date: '1962-04-22', death_date: null, parent_id: null, spouse_id: null, generation: 2, bio: 'Vợ anh Lâm. Kế toán trưởng.', photo_url: '' },

            { id: '5',  name: 'Chu Thị Thảo',     gender: 'female', birth_date: '1963-09-08', death_date: null, parent_id: '1', spouse_id: '6',  generation: 2, bio: 'Con gái thứ hai. Bác sĩ đa khoa.', photo_url: '' },
            { id: '6',  name: 'Lê Văn Sơn',       gender: 'male',   birth_date: '1961-12-05', death_date: null, parent_id: null, spouse_id: null, generation: 2, bio: 'Chồng chị Thảo. Kiến trúc sư.', photo_url: '' },

            { id: '7',  name: 'Chu Văn Minh',     gender: 'male',   birth_date: '1967-05-30', death_date: null, parent_id: '1', spouse_id: '8',  generation: 2, bio: 'Con trai thứ ba. Doanh nhân.', photo_url: '' },
            { id: '8',  name: 'Phạm Thị Hoa',     gender: 'female', birth_date: '1970-03-18', death_date: null, parent_id: null, spouse_id: null, generation: 2, bio: 'Vợ anh Minh. Dược sĩ.', photo_url: '' },

            { id: '9',  name: 'Chu Thị Hương',    gender: 'female', birth_date: '1972-11-12', death_date: null, parent_id: '1', spouse_id: '10', generation: 2, bio: 'Con gái út. Nhà báo.', photo_url: '' },
            { id: '10', name: 'Võ Văn Tâm',       gender: 'male',   birth_date: '1970-07-25', death_date: null, parent_id: null, spouse_id: null, generation: 2, bio: 'Chồng chị Hương. Luật sư.', photo_url: '' },

            // ══════ ĐỜI 3 — Cháu ══════
            // --- Con của Lâm & Hằng (3 con) ---
            { id: '11', name: 'Chu Minh Tuấn',    gender: 'male',   birth_date: '1988-03-12', death_date: null, parent_id: '3', spouse_id: '12', generation: 3, bio: 'Kỹ sư phần mềm.', photo_url: '' },
            { id: '12', name: 'Hoàng Thị Nga',    gender: 'female', birth_date: '1990-08-01', death_date: null, parent_id: null, spouse_id: null, generation: 3, bio: 'Vợ Tuấn. Nhân viên ngân hàng.', photo_url: '' },
            { id: '13', name: 'Chu Thị Hạnh',     gender: 'female', birth_date: '1991-06-22', death_date: null, parent_id: '3', spouse_id: null, generation: 3, bio: 'Bác sĩ nha khoa.', photo_url: '' },
            { id: '14', name: 'Chu Văn Đạt',      gender: 'male',   birth_date: '1995-10-05', death_date: null, parent_id: '3', spouse_id: null, generation: 3, bio: 'Sinh viên du học Nhật Bản.', photo_url: '' },

            // --- Con của Thảo & Sơn (2 con) ---
            { id: '15', name: 'Lê Thị Ngọc',      gender: 'female', birth_date: '1990-01-15', death_date: null, parent_id: '5', spouse_id: '16', generation: 3, bio: 'Giảng viên đại học.', photo_url: '' },
            { id: '16', name: 'Trịnh Văn Khôi',   gender: 'male',   birth_date: '1988-05-20', death_date: null, parent_id: null, spouse_id: null, generation: 3, bio: 'Chồng Ngọc. Phi công.', photo_url: '' },
            { id: '17', name: 'Lê Văn Khoa',      gender: 'male',   birth_date: '1993-07-18', death_date: null, parent_id: '5', spouse_id: null, generation: 3, bio: 'Lập trình viên AI.', photo_url: '' },

            // --- Con của Minh & Hoa (2 con) ---
            { id: '18', name: 'Chu Văn Phong',    gender: 'male',   birth_date: '1996-09-10', death_date: null, parent_id: '7', spouse_id: '19', generation: 3, bio: 'Marketing Manager.', photo_url: '' },
            { id: '19', name: 'Đỗ Thị Thúy',      gender: 'female', birth_date: '1998-12-28', death_date: null, parent_id: null, spouse_id: null, generation: 3, bio: 'Vợ Phong. Designer.', photo_url: '' },
            { id: '20', name: 'Chu Thị Uyên',     gender: 'female', birth_date: '2000-03-14', death_date: null, parent_id: '7', spouse_id: null, generation: 3, bio: 'Sinh viên Y khoa.', photo_url: '' },

            // --- Con của Hương & Tâm (1 con) ---
            { id: '21', name: 'Võ Minh Hoàng',    gender: 'male',   birth_date: '1998-02-08', death_date: null, parent_id: '9', spouse_id: null, generation: 3, bio: 'Nhiếp ảnh gia.', photo_url: '' },

            // ══════ ĐỜI 4 — Chắt ══════
            // --- Con của Tuấn & Nga ---
            { id: '22', name: 'Chu Gia Bảo',      gender: 'male',   birth_date: '2016-04-15', death_date: null, parent_id: '11', spouse_id: null, generation: 4, bio: 'Học sinh tiểu học.', photo_url: '' },
            { id: '23', name: 'Chu Ngọc Anh',     gender: 'female', birth_date: '2019-07-20', death_date: null, parent_id: '11', spouse_id: null, generation: 4, bio: 'Mầm non.', photo_url: '' },

            // --- Con của Ngọc & Khôi ---
            { id: '24', name: 'Trịnh Minh Châu',  gender: 'female', birth_date: '2018-11-02', death_date: null, parent_id: '15', spouse_id: null, generation: 4, bio: 'Học sinh.', photo_url: '' },

            // --- Con của Phong & Thúy ---
            { id: '25', name: 'Chu Minh Khôi',    gender: 'male',   birth_date: '2023-01-08', death_date: null, parent_id: '18', spouse_id: null, generation: 4, bio: 'Em bé.', photo_url: '' },
        ];

        if (this.mode === 'supabase' && this.supabase) {
            await this.supabase.from('family_members').delete().neq('id', '');
            await this.supabase.from('family_members').insert(demo);
            this.saveSettings({ familyName: 'Gia phả Họ Trần Văn', mode: 'supabase', supabaseUrl: this.supabaseUrl, supabaseKey: this.supabaseKey });
            return;
        }
        this._saveLocal(demo);
        this.saveSettings({ familyName: 'Gia phả Họ Trần Văn', mode: 'local' });
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
};
