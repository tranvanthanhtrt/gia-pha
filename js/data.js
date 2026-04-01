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
        const maleNames = ['Văn An', 'Văn Bình', 'Văn Cường', 'Văn Dũng', 'Văn Đức', 'Văn Hòa', 'Văn Khoa', 'Văn Lâm', 'Văn Minh', 'Văn Nam', 'Văn Phong', 'Văn Quang', 'Văn Sơn', 'Văn Thái', 'Văn Trung'];
        const femaleNames = ['Thị Anh', 'Thị Bình', 'Thị Chi', 'Thị Dung', 'Thị Giang', 'Thị Hạnh', 'Thị Hoa', 'Thị Hồng', 'Thị Lan', 'Thị Mai', 'Thị Ngọc', 'Thị Oanh', 'Thị Phương', 'Thị Thu', 'Thị Yến'];

        const demo = [];
        let idCounter = 1;

        const makeDate = (year, index) => {
            const month = ((index % 12) + 1).toString().padStart(2, '0');
            const day = (((index * 3) % 27) + 1).toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const createPerson = ({ name, gender, generation, parentId = null, spouseId = null, birthYear = 1980, deceased = false }) => {
            const id = String(idCounter++);
            const birth_date = makeDate(birthYear, idCounter);
            const death_date = deceased ? makeDate(birthYear + 68, idCounter + 2) : null;
            demo.push({
                id,
                name,
                gender,
                birth_date,
                death_date,
                parent_id: parentId,
                spouse_id: spouseId,
                generation,
                bio: `Thành viên đời ${generation}`,
                photo_url: ''
            });
            return id;
        };

        // Đời 1: 1 cặp vợ chồng
        const rootMaleId = createPerson({ name: 'Trần Văn Tổ', gender: 'male', generation: 1, birthYear: 1928, deceased: true });
        const rootFemaleId = createPerson({ name: 'Lê Thị Tổ', gender: 'female', generation: 1, birthYear: 1932, deceased: true });
        demo.find(m => m.id === rootMaleId).spouse_id = rootFemaleId;

        let bloodline = [rootMaleId];
        const childrenPlan = [4, 8, 12, 14, 16]; // tổng 54 người huyết thống (đời 1→6)

        for (let gen = 2; gen <= 6; gen++) {
            const targetChildren = childrenPlan[gen - 2];
            const nextBloodline = [];
            let idx = 0;

            for (let i = 0; i < targetChildren; i++) {
                const parentId = bloodline[idx % bloodline.length];
                idx++;
                const isMale = i % 2 === 0;
                const firstName = isMale
                    ? maleNames[(i + gen) % maleNames.length]
                    : femaleNames[(i + gen) % femaleNames.length];

                const memberId = createPerson({
                    name: `Trần ${firstName} ${gen}${(i + 1).toString().padStart(2, '0')}`,
                    gender: isMale ? 'male' : 'female',
                    generation: gen,
                    parentId,
                    birthYear: 1928 + (gen - 1) * 24 + i,
                    deceased: gen <= 3 && i % 4 === 0
                });

                nextBloodline.push(memberId);

                // khoảng 30% thành viên có vợ/chồng ngoài họ (không parent)
                if ((i + gen) % 3 === 0) {
                    const spouseIsFemale = isMale;
                    const spouseName = spouseIsFemale
                        ? `Nguyễn ${femaleNames[(i + gen + 2) % femaleNames.length]} ${gen}${(i + 1).toString().padStart(2, '0')}`
                        : `Phạm ${maleNames[(i + gen + 3) % maleNames.length]} ${gen}${(i + 1).toString().padStart(2, '0')}`;

                    const spouseId = createPerson({
                        name: spouseName,
                        gender: spouseIsFemale ? 'female' : 'male',
                        generation: gen,
                        parentId: null,
                        birthYear: 1930 + (gen - 1) * 24 + i,
                        deceased: gen <= 2 && i % 5 === 0
                    });

                    demo.find(m => m.id === memberId).spouse_id = spouseId;
                }
            }

            bloodline = nextBloodline;
        }

        // Chốt đúng khoảng 70 thành viên
        const targetSize = 70;
        if (demo.length > targetSize) {
            const keepIds = new Set(demo.slice(0, targetSize).map(m => m.id));
            demo.length = targetSize;
            demo.forEach(m => {
                if (m.spouse_id && !keepIds.has(m.spouse_id)) m.spouse_id = null;
                if (m.parent_id && !keepIds.has(m.parent_id)) m.parent_id = null;
            });
        }

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
