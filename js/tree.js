// ===== TREE RENDERER — Bottom-Up Layout =====
// Layout algorithm:
//   1. Build a recursive tree of family nodes
//   2. Calculate subtree widths BOTTOM-UP (leaves first)
//   3. Assign X positions TOP-DOWN using calculated widths
//   4. Parents are always centered above their children
//   5. Draw connectors: child top-center → horizontal bar → parent bottom-center

const TreeRenderer = {
    members: [],
    container: null,
    svgNS: 'http://www.w3.org/2000/svg',

    // Layout constants (match CSS)
    CARD_W: 120,
    CARD_H: 190,
    SPOUSE_GAP: 24,     // horizontal gap for spouse connector
    SIBLING_GAP: 30,    // gap between sibling couple-units
    ROW_GAP: 60,        // vertical gap between generation rows
    PADDING: 40,        // container padding

    render(members, containerId) {
        this.members = members;
        this.container = document.getElementById(containerId);
        this.container.innerHTML = '';

        if (!members.length) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-sitemap"></i>
                    <h3>Chưa có thành viên nào</h3>
                    <p>Bấm <b>"+ Thêm"</b> để thêm thành viên đầu tiên<br>
                    hoặc vào <b>⚙️ Cài đặt → Tải dữ liệu mẫu</b></p>
                    <button class="btn btn-primary" onclick="App.openAddModal()">
                        <i class="fas fa-user-plus"></i> Thêm thành viên
                    </button>
                </div>`;
            return;
        }

        // 1. Build recursive tree
        const roots = this.buildTree();

        // 2. Calculate subtree widths (bottom-up)
        roots.forEach(r => this.calcSubtreeWidth(r));

        // 3. Assign X positions (top-down, centering parents above children)
        let currentX = this.PADDING;
        roots.forEach(r => {
            this.assignX(r, currentX);
            currentX += r.subtreeW + this.SIBLING_GAP * 2;
        });

        // 4. Assign Y positions based on generation
        roots.forEach(r => this.assignY(r));

        // 5. Calculate total dimensions
        const maxGen = Math.max(...this.members.map(m => m.generation || 1));
        const totalW = currentX - this.SIBLING_GAP * 2 + this.PADDING;
        const totalH = maxGen * (this.CARD_H + this.ROW_GAP) + this.PADDING;

        // 6. Create positioned container
        const wrap = document.createElement('div');
        wrap.className = 'gen-rows';
        wrap.style.position = 'relative';
        wrap.style.width = totalW + 'px';
        wrap.style.minHeight = totalH + 'px';

        // 7. Render generation labels
        for (let g = 1; g <= maxGen; g++) {
            const label = document.createElement('div');
            label.className = 'gen-label-abs';
            label.style.top = ((g - 1) * (this.CARD_H + this.ROW_GAP) + this.CARD_H / 2 - 12) + 'px';
            label.innerHTML = `<span>ĐỜI ${g}</span>`;
            wrap.appendChild(label);
        }

        // 8. Render cards recursively with absolute positioning
        this.renderNodes(roots, wrap);

        // 9. SVG overlay for connectors (inside wrap, same coordinate space)
        const svg = document.createElementNS(this.svgNS, 'svg');
        svg.setAttribute('class', 'tree-svg-overlay');
        svg.setAttribute('width', totalW);
        svg.setAttribute('height', totalH);
        svg.style.width = totalW + 'px';
        svg.style.height = totalH + 'px';
        wrap.appendChild(svg);

        this.container.appendChild(wrap);

        // 10. Draw connectors recursively
        this.drawConnectors(roots, svg);
    },

    // ===== BUILD TREE =====
    buildTree() {
        const placed = new Set();
        const roots = this.findRoots();
        return roots.map(root => this.buildNode(root, placed));
    },

    buildNode(member, placed) {
        if (placed.has(member.id)) return null;
        placed.add(member.id);

        const spouse = this.getSpouse(member);
        if (spouse) placed.add(spouse.id);

        const children = this.getChildrenOf(member, spouse);
        const childNodes = children
            .map(child => this.buildNode(child, placed))
            .filter(Boolean);

        return {
            member,
            spouse,
            children: childNodes,
            // Calculated by layout:
            unitW: spouse ? (this.CARD_W * 2 + this.SPOUSE_GAP) : this.CARD_W,
            subtreeW: 0,
            x: 0,      // center-x of the couple unit
            y: 0,       // top-y
        };
    },

    // ===== BOTTOM-UP: Calculate subtree widths =====
    calcSubtreeWidth(node) {
        if (node.children.length === 0) {
            node.subtreeW = node.unitW;
            return;
        }

        // Calculate children first (bottom-up!)
        node.children.forEach(child => this.calcSubtreeWidth(child));

        // Total width of all children side by side
        const childrenW = node.children.reduce((sum, c) => sum + c.subtreeW, 0)
            + (node.children.length - 1) * this.SIBLING_GAP;

        // Subtree = max of own width and children width
        node.subtreeW = Math.max(node.unitW, childrenW);
    },

    // ===== TOP-DOWN: Assign X positions (parents centered above children) =====
    assignX(node, startX) {
        // This node's couple is centered within its subtree width
        node.x = startX + node.subtreeW / 2;

        // Position children within the subtree span
        if (node.children.length > 0) {
            const childrenW = node.children.reduce((sum, c) => sum + c.subtreeW, 0)
                + (node.children.length - 1) * this.SIBLING_GAP;
            let childX = startX + (node.subtreeW - childrenW) / 2;

            node.children.forEach(child => {
                this.assignX(child, childX);
                childX += child.subtreeW + this.SIBLING_GAP;
            });
        }
    },

    // ===== Assign Y based on generation =====
    assignY(node) {
        const gen = node.member.generation || 1;
        node.y = (gen - 1) * (this.CARD_H + this.ROW_GAP);
        node.children.forEach(child => this.assignY(child));
    },

    // ===== RENDER CARDS =====
    renderNodes(nodes, container) {
        nodes.forEach(node => {
            const coupleEl = document.createElement('div');
            coupleEl.className = 'couple-unit-abs';
            coupleEl.style.left = (node.x - node.unitW / 2) + 'px';
            coupleEl.style.top = node.y + 'px';
            coupleEl.style.width = node.unitW + 'px';

            // Main member card
            coupleEl.appendChild(this.createCard(node.member));

            // Spouse connector + card
            if (node.spouse) {
                const conn = document.createElement('div');
                conn.className = 'spouse-connector';
                coupleEl.appendChild(conn);
                coupleEl.appendChild(this.createCard(node.spouse));
            }

            container.appendChild(coupleEl);

            // Recurse into children
            if (node.children.length > 0) {
                this.renderNodes(node.children, container);
            }
        });
    },

    createCard(member) {
        const card = document.createElement('div');
        card.className = `member-card ${member.gender}`;
        if (member.death_date) card.classList.add('deceased');
        card.dataset.id = member.id;
        card.onclick = (e) => { e.stopPropagation(); App.showMemberDetail(member.id); };

        const avatarContent = member.photo_url
            ? `<img src="${member.photo_url}" alt="${member.name}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user avatar-icon\\'></i>'">`
            : `<i class="fas fa-user avatar-icon"></i>`;

        const birthStr = member.birth_date ? 'NS: ' + new Date(member.birth_date).toLocaleDateString('vi-VN') : 'NS: —';
        const deathStr = member.death_date ? 'MT: ' + new Date(member.death_date).toLocaleDateString('vi-VN') : 'MT: —';

        card.innerHTML = `
            ${member.death_date ? '<span class="deceased-badge">✝</span>' : ''}
            <div class="member-avatar">${avatarContent}</div>
            <div class="card-info">
                <div class="member-gen"><span>ĐỜI ${member.generation || '?'}</span></div>
                <div class="member-name">${member.name}</div>
                <div class="member-dates">${birthStr}</div>
                <div class="member-dates">${deathStr}</div>
            </div>
        `;
        return card;
    },

    // ===== DRAW CONNECTORS =====
    drawConnectors(nodes, svg) {
        nodes.forEach(node => {
            if (node.children.length > 0) {
                this.drawFamilyConnector(node, svg);
            }
            // Recurse
            this.drawConnectors(node.children, svg);
        });
    },

    drawFamilyConnector(node, svg) {
        // Parent connection point: bottom-center of couple unit
        const parentBottomY = node.y + this.CARD_H;
        const parentCX = node.x; // center of couple

        // Children connection points: top-center of each child
        const childTopY = node.children[0].y;
        const midY = parentBottomY + (childTopY - parentBottomY) / 2;

        // 1. Vertical from parent bottom to midY
        this.addLine(svg, parentCX, parentBottomY - this.CARD_H / 2, parentCX, midY);

        if (node.children.length === 1) {
            const child = node.children[0];
            if (Math.abs(child.x - parentCX) < 2) {
                // Straight down
                this.addLine(svg, parentCX, midY, child.x, childTopY);
            } else {
                this.addLine(svg, parentCX, midY, child.x, midY);
                this.addLine(svg, child.x, midY, child.x, childTopY);
            }
        } else {
            // 2. Horizontal bar spanning all children
            const leftX = Math.min(...node.children.map(c => c.x));
            const rightX = Math.max(...node.children.map(c => c.x));
            this.addLine(svg, leftX, midY, rightX, midY);

            // Extend bar to parent if parent center is outside children range
            if (parentCX < leftX) this.addLine(svg, parentCX, midY, leftX, midY);
            else if (parentCX > rightX) this.addLine(svg, parentCX, midY, rightX, midY);

            // 3. Vertical from bar to each child's top-center
            node.children.forEach(child => {
                this.addLine(svg, child.x, midY, child.x, childTopY);
            });
        }
    },

    // ===== SVG HELPERS =====
    addLine(svg, x1, y1, x2, y2) {
        const line = document.createElementNS(this.svgNS, 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('stroke', '#c0392b');
        line.setAttribute('stroke-width', '2.5');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
    },

    // ===== TREE HELPERS =====
    findRoots() {
        const referencedAsSpouse = new Set();
        this.members.forEach(m => { if (m.spouse_id) referencedAsSpouse.add(m.spouse_id); });
        return this.members.filter(m => {
            if (m.parent_id) return false;
            if (referencedAsSpouse.has(m.id)) return false;
            return true;
        });
    },

    getSpouse(member) {
        if (member.spouse_id) {
            return this.members.find(m => m.id === member.spouse_id) || null;
        }
        return this.members.find(m => m.spouse_id === member.id) || null;
    },

    getChildrenOf(member, spouse) {
        const ids = new Set([member.id]);
        if (spouse) ids.add(spouse.id);
        if (!spouse) {
            const reverseSpouse = this.members.find(m => m.spouse_id === member.id);
            if (reverseSpouse) ids.add(reverseSpouse.id);
        }
        return this.members.filter(m => ids.has(m.parent_id))
            .sort((a, b) => (a.birth_date || '9999').localeCompare(b.birth_date || '9999'));
    },

    // ===== REDRAW (called on zoom) =====
    drawSVGConnectors() {
        // For zoom redraw — connectors use absolute coords, no need to recalc
        // The SVG is inside gen-rows which is inside the scaled container
        // offsetLeft/offsetTop don't change with CSS transform, so nothing to do
    }
};
