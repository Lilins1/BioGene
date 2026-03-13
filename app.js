// ==========================================
// 辅助工具函数
// ==========================================
function formatSeq(seq) { return seq ? seq.replace(/-/g, "").split("").join("-") : ""; }
function cleanSeq(seq) { return seq ? seq.replace(/-/g, "").replace(/5'/g, "").replace(/3'/g, "").trim() : ""; }
function getTokens(text) { return (text || "").match(/5'|3'|\.{2,}|./g) || []; }
function isComplementary(top, bot) {
    if (top.length !== bot.length || top.length === 0) return false;
    for (let i = 0; i < top.length; i++) {
        let t = top[i], b = bot[i];
        if (!((t==='A'&&b==='T')||(t==='T'&&b==='A')||(t==='C'&&b==='G')||(t==='G'&&b==='C'))) return false;
    }
    return true;
}

// ==========================================
// 类：3D 形变渲染区
// ==========================================
class PlasmidPanel {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { alpha: false }); 
        
        this.vectorColor = "rgba(168, 230, 207, 0.85)";
        this.fragmentColor = "rgba(255, 180, 130, 0.85)";
        
        // 【核心修改】统一左右圆环的缩放与字体跨度
        this.degPerToken = 8.5; 
        this.centerTheta = 90.0;
        this.SCALE = 200.0; 
        this.CX = 400; this.CY = 400;

        this.mode = "extract";
        this.progress = 0.0;
        this.extractDistance = 0.5;
        this.insertDistance = 0.5;
        this.rotationAngle = 0.0;
        this.isRotating = false;
        this.isSelfLigating = false;
        this.selfLigationProgress = 0.0;

        this.fragTop = ""; this.fragBot = "";
        this.vecLTop = ""; this.vecLBot = "";
        this.vecRTop = ""; this.vecRBot = "";

        this.setupInteractions();
    }

    setSequences(fT, fB, vLT, vLB, vRT, vRB) {
        this.fragTop = fT; this.fragBot = fB;
        this.vecLTop = vLT; this.vecLBot = vLB;
        this.vecRTop = vRT; this.vecRBot = vRB;
        this.paint();
    }

    setStaticState(mode, progress) {
        this.mode = mode; this.progress = progress; this.isSelfLigating = false; this.paint();
    }

    startRotationAnimation(onComplete) {
        if (this.isRotating || this.isSelfLigating) return;
        this.isRotating = true;
        let start = performance.now();
        const animate = (time) => {
            let p = (time - start) / 600.0;
            if (p >= 1.0) {
                this.isRotating = false;
                this.rotationAngle = 0;
                let nT = getTokens(this.fragBot).reverse().join('');
                let nB = getTokens(this.fragTop).reverse().join('');
                this.fragTop = nT; this.fragBot = nB;
                if(onComplete) onComplete(nT, nB);
                this.paint();
            } else {
                this.rotationAngle = p * 180;
                this.paint();
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

    startSelfLigationAnimation() {
        if (this.isSelfLigating || this.isRotating) return;
        this.isSelfLigating = true;
        this.selfLigationProgress = 0;
        let start = performance.now();
        const animate = (time) => {
            let p = (time - start) / 1000.0;
            if (p >= 1.0) {
                this.selfLigationProgress = 1.0;
                this.paint();
            } else {
                this.selfLigationProgress = p;
                this.paint();
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

    setupInteractions() {
        let isDown = false, lastY = 0;
        this.canvas.addEventListener('mousedown', e => { isDown = true; lastY = e.clientY; });
        this.canvas.addEventListener('touchstart', e => { isDown = true; lastY = e.touches[0].clientY; }, {passive: false});
        
        window.addEventListener('mouseup', () => isDown = false);
        window.addEventListener('touchend', () => isDown = false);
        
        const moveHandler = y => {
            if (!isDown || this.isRotating || this.isSelfLigating) return;
            let delta = (y - lastY) / 300.0; 
            this.progress += (this.mode === "extract") ? -delta : delta;
            this.progress = Math.max(0.0, Math.min(1.0, this.progress));
            lastY = y;
            this.paint();
        };

        this.canvas.addEventListener('mousemove', e => moveHandler(e.clientY));
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault(); 
            moveHandler(e.touches[0].clientY);
        }, {passive: false});
    }

    morphPoint(r, thetaDeg, t, dist, rRef) {
        const rad = thetaDeg * Math.PI / 180;
        const radMid = this.centerTheta * Math.PI / 180;
        const xArc = r * Math.cos(rad);
        const yArc = r * Math.sin(rad);
        const s = rRef * (radMid - rad);
        const xLine = r * Math.cos(radMid) + s * Math.sin(radMid);
        const yLine = r * Math.sin(radMid) - s * Math.cos(radMid);
        return {
            x: (1 - t) * xArc + t * xLine + dist * Math.cos(radMid),
            y: (1 - t) * yArc + t * yLine + dist * Math.sin(radMid)
        };
    }

    drawMorphedLayer(r1, r2, theta1, theta2, color, t, dist, rRef) {
        this.ctx.beginPath();
        const steps = 40;
        const stepSize = (theta2 - theta1) / steps;
        for (let i = 0; i <= steps; i++) {
            let p = this.morphPoint(r2, theta1 + i * stepSize, t, dist, rRef);
            let px = this.CX + p.x * this.SCALE, py = this.CY - p.y * this.SCALE;
            if (i === 0) this.ctx.moveTo(px, py); else this.ctx.lineTo(px, py);
        }
        for (let i = steps; i >= 0; i--) {
            let p = this.morphPoint(r1, theta1 + i * stepSize, t, dist, rRef);
            this.ctx.lineTo(this.CX + p.x * this.SCALE, this.CY - p.y * this.SCALE);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    drawMorphedText(text, radius, edgeAngle, alignDir, anchor, t, dist, rRef) {
        if (!text) return;
        const tokens = getTokens(text);
        const n = tokens.length;
        const offset = this.degPerToken / 2.0;
        let startTh = anchor === "start" ? edgeAngle + offset*alignDir : edgeAngle - (n-1)*this.degPerToken*alignDir - offset*alignDir;

        this.ctx.fillStyle = "#000";
        this.ctx.font = "bold 22px 'Segoe UI', Arial"; // 统一字号
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        for (let i = 0; i < n; i++) {
            let th = startTh + i * this.degPerToken * alignDir;
            let p = this.morphPoint(radius, th, t, dist, rRef);
            let rot = (1 - t) * (th - 90) + t * (this.centerTheta - 90);
            if (rot < -90 || rot > 90) rot += 180;

            this.ctx.save();
            this.ctx.translate(this.CX + p.x * this.SCALE, this.CY - p.y * this.SCALE);
            this.ctx.rotate((-rot) * Math.PI / 180);
            this.ctx.fillText(tokens[i], 0, 0);
            this.ctx.restore();
        }
    }

    paint() {
        this.ctx.fillStyle = "#fafafa"; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 【核心修改】计算比例，确保与左侧的 190 和 150 半径视觉上 100% 重合
        let rOutE = 1.05, w = 0.20, rMid = rOutE - w; // 对应边界 210, 170, 130
        let rOutT = rOutE - w/2, rInT = rMid - w/2;   // 对应文字 190, 150

        let spanOuter = getTokens(this.fragTop).length * this.degPerToken;
        let cLOut = this.centerTheta + spanOuter / 2.0;
        let cROut = this.centerTheta - spanOuter / 2.0;
        let lOff = (getTokens(this.vecLBot).length - getTokens(this.vecLTop).length) * this.degPerToken;
        let rOff = (getTokens(this.vecRTop).length - getTokens(this.vecRBot).length) * this.degPerToken;

        let pSmooth = this.progress * this.progress * (3 - 2 * this.progress);
        let tMorph = this.mode === "extract" ? pSmooth : 1.0 - pSmooth;
        let currentDist = this.mode === "extract" ? this.extractDistance * pSmooth : this.insertDistance * (1.0 - pSmooth);

        let vL = cLOut, vR_text = cROut;
        
        if (this.isSelfLigating) {
            vL = cLOut - (spanOuter / 2.0) * this.selfLigationProgress;
            vR_text = cROut + (spanOuter / 2.0) * this.selfLigationProgress;
        }

        let vR = 360 + vR_text; 
        this.drawMorphedLayer(rMid, rOutE, vL, vR, this.vectorColor, 0, 0, rMid);
        this.drawMorphedLayer(rMid-w, rMid, vL - lOff, vR - rOff, this.vectorColor, 0, 0, rMid);

        this.drawMorphedText(this.vecLTop, rOutT, vL, -1, "end", 0, 0, rMid);
        this.drawMorphedText(this.vecLBot, rInT, vL - lOff, -1, "end", 0, 0, rMid);
        this.drawMorphedText(this.vecRTop, rOutT, vR_text, -1, "start", 0, 0, rMid);
        this.drawMorphedText(this.vecRBot, rInT, vR_text - rOff, -1, "start", 0, 0, rMid);

        if (getTokens(this.fragTop).length > 0) {
            this.ctx.save();
            let fCenter = this.morphPoint(rMid - w/2, this.centerTheta, tMorph, currentDist, rMid);
            
            if (this.rotationAngle !== 0) {
                this.ctx.translate(this.CX + fCenter.x * this.SCALE, this.CY - fCenter.y * this.SCALE);
                this.ctx.rotate(this.rotationAngle * Math.PI / 180);
                this.ctx.translate(-(this.CX + fCenter.x * this.SCALE), -(this.CY - fCenter.y * this.SCALE));
            }

            if (this.isSelfLigating) {
                let rSmall = 50;
                let cx = this.CX + fCenter.x * this.SCALE;
                let cy = this.CY - fCenter.y * this.SCALE;
                this.ctx.beginPath();
                this.ctx.strokeStyle = this.fragmentColor;
                this.ctx.lineWidth = 40;
                let currentAngle = 360 * this.selfLigationProgress;
                this.ctx.arc(cx, cy, rSmall, (-90 - currentAngle/2)*Math.PI/180, (-90 + currentAngle/2)*Math.PI/180);
                this.ctx.stroke();
            } else {
                this.drawMorphedLayer(rMid, rOutE, cROut, cLOut, this.fragmentColor, tMorph, currentDist, rMid);
                this.drawMorphedLayer(rMid-w, rMid, cROut - rOff, cLOut - lOff, this.fragmentColor, tMorph, currentDist, rMid);
                this.drawMorphedText(this.fragTop, rOutT, cLOut, -1, "start", tMorph, currentDist, rMid);
                this.drawMorphedText(this.fragBot, rInT, cLOut - lOff, -1, "start", tMorph, currentDist, rMid);
            }
            this.ctx.restore();
        }
    }
}

// ==========================================
// 类：圆环切割选取器 (步骤1)
// ==========================================
class CircularGeneSelector {
    constructor(canvasId, topSeq, botSeq) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.sequences = [topSeq, botSeq];
        this.starts = [-1, -1];
        this.ends = [-1, -1];
        
        this.degPerUnit = 8.5; 
        // 【核心修改】精准对应右侧面板的视觉半径
        this.rOut = 190; this.rIn = 150; 
        
        const interactionEvent = e => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            this.handleInteraction(clientX - rect.left, clientY - rect.top);
        };
        this.canvas.addEventListener('mousedown', interactionEvent);
        this.canvas.addEventListener('touchstart', interactionEvent, {passive: false});
    }

    reset() { this.starts = [-1, -1]; this.ends = [-1, -1]; this.paint(); }
    show() { this.canvas.style.display = 'block'; this.paint(); }
    hide() { this.canvas.style.display = 'none'; }

    getRowParts(row) {
        if (this.starts[row] === -1) return null;
        let s = this.sequences[row];
        if (this.ends[row] === -1) return [s.substring(0, this.starts[row]), "", s.substring(this.starts[row] + 1)];
        let st = Math.min(this.starts[row], this.ends[row]);
        let ed = Math.max(this.starts[row], this.ends[row]);
        // 【核心修改】精准切除截断位置的 '-'，避免拖泥带水
        return [s.substring(0, st), s.substring(st + 1, ed), s.substring(ed + 1)];
    }

    handleInteraction(x, y) {
        let dx = x - this.canvas.width/2;
        let dy = this.canvas.height/2 - y;
        let dist = Math.sqrt(dx*dx + dy*dy);

        let row = -1;
        if (dist >= 170 && dist <= 210) row = 0;
        else if (dist >= 130 && dist < 170) row = 1;

        if (row !== -1) {
            let angleDeg = Math.atan2(dx, dy) * 180 / Math.PI;
            if (angleDeg < 0) angleDeg += 360;
            let n = this.sequences[row].length;
            let offset = (n * this.degPerUnit) / 2.0;
            let rel = angleDeg + offset;
            if (rel >= 360) rel -= 360;
            
            let idx = Math.round(rel / this.degPerUnit);

            // 【核心修改】强制吸附到 '-' 的位置（奇数索引）
            if (idx % 2 === 0) {
                if (rel / this.degPerUnit > idx) idx += 1;
                else idx -= 1;
            }
            // 限制首尾边界
            if (idx < 1) idx = 1;
            if (idx > n - 2) idx = n - 2;

            if (idx >= 1 && idx <= n - 2) {
                if (this.starts[row] === -1 || (this.starts[row] !== -1 && this.ends[row] !== -1)) {
                    this.starts[row] = idx; this.ends[row] = -1;
                } else {
                    this.ends[row] = idx;
                }
                this.paint();
            }
        }
    }

    paint() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        let cx = this.canvas.width/2, cy = this.canvas.height/2;

        this.ctx.lineWidth = 40;
        this.ctx.strokeStyle = "rgba(168, 230, 207, 0.4)";
        this.ctx.beginPath(); this.ctx.arc(cx, cy, this.rOut, 0, Math.PI*2); this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.arc(cx, cy, this.rIn, 0, Math.PI*2); this.ctx.stroke();

        this.ctx.font = "bold 22px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        for (let row = 0; row < 2; row++) {
            let seq = this.sequences[row];
            let r = row === 0 ? this.rOut : this.rIn;
            let offset = (seq.length * this.degPerUnit) / 2.0;

            for (let i = 0; i < seq.length; i++) {
                let deg = (i * this.degPerUnit) - offset + (this.degPerUnit / 2.0);
                let rad = (deg - 90) * Math.PI / 180;
                let x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);

                let isSelectedDash = (i === this.starts[row] || i === this.ends[row]);
                let st = Math.min(this.starts[row], this.ends[row]);
                let ed = Math.max(this.starts[row], this.ends[row]);
                let isSelected = this.ends[row] !== -1 && (i > st && i < ed);

                this.ctx.fillStyle = isSelected ? "red" : "black";
                this.ctx.save();
                this.ctx.translate(x, y); this.ctx.rotate(rad + Math.PI/2);
                
                // 【核心修改】如果是选中的切口处，用红线代替 '-' 字符
                if (!isSelectedDash) {
                    this.ctx.fillText(seq[i], 0, 0);
                }
                this.ctx.restore();

                if (isSelectedDash) {
                    let lineRad = ((i * this.degPerUnit) - offset + (this.degPerUnit / 2.0) - 90) * Math.PI / 180;
                    this.ctx.strokeStyle = "red"; this.ctx.lineWidth = 4;
                    this.ctx.beginPath();
                    this.ctx.moveTo(cx + (r-20)*Math.cos(lineRad), cy + (r-20)*Math.sin(lineRad));
                    this.ctx.lineTo(cx + (r+20)*Math.cos(lineRad), cy + (r+20)*Math.sin(lineRad));
                    this.ctx.stroke();
                }
            }
        }
    }
}

// ==========================================
// 类：线性片段选取器 (步骤2)
// ==========================================
class GeneSegmentSelector {
    constructor(canvasId, topSeq, botSeq) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.sequences = [topSeq, botSeq];
        this.starts = [-1, -1];
        this.ends = [-1, -1];
        
        this.unit = 18; this.startX = 40; this.cy = 250; 
        
        const interactionEvent = e => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            this.handleInteraction(clientX - rect.left, clientY - rect.top);
        };
        this.canvas.addEventListener('mousedown', interactionEvent);
        this.canvas.addEventListener('touchstart', interactionEvent, {passive: false});
    }

    reset() { this.starts = [-1, -1]; this.ends = [-1, -1]; this.paint(); }
    show() { this.canvas.style.display = 'block'; this.paint(); }
    hide() { this.canvas.style.display = 'none'; }

    getRowParts(row) {
        if (this.starts[row] === -1 || this.ends[row] === -1) return null;
        let s = this.sequences[row];
        let st = Math.min(this.starts[row], this.ends[row]);
        let ed = Math.max(this.starts[row], this.ends[row]);
        return [s.substring(0, st), s.substring(st + 1, ed), s.substring(ed + 1)];
    }

    handleInteraction(x, y) {
        let row = -1;
        if (y >= this.cy - 40 && y < this.cy) row = 0;
        else if (y >= this.cy && y <= this.cy + 40) row = 1;

        if (row !== -1) {
            let idx = Math.round((x - this.startX) / this.unit);
            let n = this.sequences[row].length;

            // 强制吸附到 '-'
            if (idx % 2 === 0) {
                if ((x - this.startX) / this.unit > idx) idx += 1;
                else idx -= 1;
            }

            if (idx < 1) idx = 1;
            if (idx > n - 2) idx = n - 2;

            if (idx >= 1 && idx <= n - 2) {
                if (this.starts[row] === -1 || (this.starts[row] !== -1 && this.ends[row] !== -1)) {
                    this.starts[row] = idx; this.ends[row] = -1;
                } else {
                    this.ends[row] = idx;
                }
                this.paint();
            }
        }
    }

    paint() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = "bold 22px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        for (let row = 0; row < 2; row++) {
            let seq = this.sequences[row];
            let yPos = row === 0 ? this.cy - 20 : this.cy + 20;
            
            this.ctx.fillStyle = "rgba(168, 230, 207, 0.5)";
            this.ctx.fillRect(this.startX - this.unit/2, yPos - 20, seq.length * this.unit, 40);

            for (let i = 0; i < seq.length; i++) {
                let x = this.startX + i * this.unit;
                let isSelectedDash = (i === this.starts[row] || i === this.ends[row]);
                let st = Math.min(this.starts[row], this.ends[row]);
                let ed = Math.max(this.starts[row], this.ends[row]);
                let isSelected = this.ends[row] !== -1 && (i > st && i < ed);

                this.ctx.fillStyle = isSelected ? "red" : "black";
                
                // 与圆环一致，用红线代替字符
                if (!isSelectedDash) {
                    this.ctx.fillText(seq[i], x, yPos);
                } else {
                    this.ctx.strokeStyle = "red"; this.ctx.lineWidth = 4;
                    this.ctx.beginPath(); 
                    this.ctx.moveTo(x, yPos - 20); 
                    this.ctx.lineTo(x, yPos + 20); 
                    this.ctx.stroke();
                }
            }
        }
    }
}

// ==========================================
// 控制器：MainApp 协调全局
// ==========================================
class MainApp {
    constructor() {
        this.INITIAL_SEQ_TOP = "A-T-G-C-G-T-A-A-T-A-G-C"; 
        this.INITIAL_SEQ_BOT = "T-A-C-G-C-A-T-T-A-T-C-G";
        this.LINEAR_GENE_TOP = "G-G-A-T-C-C-A-A-G-C-T-T"; 
        this.LINEAR_GENE_BOT = "C-C-T-A-G-G-T-T-C-G-A-A";

        this.plasmidPanel = new PlasmidPanel('previewCanvas');
        this.circSelector = new CircularGeneSelector('circularCanvas', this.INITIAL_SEQ_TOP, this.INITIAL_SEQ_BOT);
        this.linSelector = new GeneSegmentSelector('linearCanvas', this.LINEAR_GENE_TOP, this.LINEAR_GENE_BOT);

        this.appStep = 1;
        this.bindEvents();
        this.resetState();
    }

    bindEvents() {
        document.getElementById('btn-reset').addEventListener('click', () => this.resetState());
        document.getElementById('btn-rotate').addEventListener('click', () => {
            let p = this.plasmidPanel.progress, m = this.plasmidPanel.mode;
            if ((m === "extract" && p < 0.8) || (m === "insert" && p > 0.2)) {
                alert("⚠️ 请将片段完全拉拽到屏幕上方位置才能旋转！"); return;
            }
            this.plasmidPanel.startRotationAnimation((nT, nB) => {
                this.plasmidPanel.fragTop = nT; this.plasmidPanel.fragBot = nB;
            });
        });

        document.getElementById('btn-ligate').addEventListener('click', () => this.executeLigation());
        document.getElementById('btn-cut').addEventListener('click', () => this.executeCut());
    }

    resetState() {
        this.appStep = 1;
        this.circSelector.reset(); this.circSelector.show();
        this.linSelector.hide();

        let mid = Math.floor(this.INITIAL_SEQ_TOP.length / 2);
        let vLT = this.INITIAL_SEQ_TOP.substring(0, mid), vLB = this.INITIAL_SEQ_BOT.substring(0, mid);
        let vRT = this.INITIAL_SEQ_TOP.substring(mid), vRB = this.INITIAL_SEQ_BOT.substring(mid);

        this.plasmidPanel.setSequences("", "", `5'-${formatSeq(vLT)}-`, `3'-${formatSeq(vLB)}-`, `-${formatSeq(vRT)}-3'`, `-${formatSeq(vRB)}-5'`);
        this.plasmidPanel.setStaticState("extract", 0.0);

        document.getElementById('step-title').innerText = "交互操作区 - 步骤 1：圆环切割";
        document.getElementById('status-text').innerText = "请在上方圆环上点击选择切割边界（红线）。";
        document.getElementById('btn-cut').innerText = "✂️ 执行切割";
    }

    executeCut() {
        let activeSel = this.appStep === 1 ? this.circSelector : this.linSelector;
        let tParts = activeSel.getRowParts(0), bParts = activeSel.getRowParts(1);

        if (!tParts || !bParts) {
            alert("⚠️ 请在上下链各选择切割位点！(需要用红线圈出片段范围)"); return;
        }

        if (this.appStep === 1) {
            this.plasmidPanel.setSequences(
                formatSeq(tParts[1]), formatSeq(bParts[1]),
                `5'-${formatSeq(tParts[0])}-`, `3'-${formatSeq(bParts[0])}-`,
                `-${formatSeq(tParts[2])}-3'`, `-${formatSeq(bParts[2])}-5'`
            );
            this.appStep = 2;
            this.circSelector.hide();
            this.linSelector.reset(); this.linSelector.show();

            document.getElementById('step-title').innerText = "交互操作区 - 步骤 2：片段提取";
            document.getElementById('status-text').innerText = "载体已切开！请在右侧按住鼠标【向上拖拽】拔出片段。";
            document.getElementById('btn-cut').innerText = "🧬 提取新基因";
        } else {
            this.plasmidPanel.fragTop = formatSeq(tParts[1]);
            this.plasmidPanel.fragBot = formatSeq(bParts[1]);
            this.plasmidPanel.setStaticState("insert", 0.0);
            document.getElementById('status-text').innerText = "新基因已就绪！请在右侧按住鼠标【向下拖拽】嵌入缺口。";
        }
    }

    executeLigation() {
        if (this.appStep === 1) return alert("⚠️ 请先完成切割和提取！");
        let p = this.plasmidPanel;
        let isDetached = (p.mode === "extract" && p.progress > 0.8) || (p.mode === "insert" && p.progress < 0.2);
        let isInserted = (p.mode === "extract" && p.progress < 0.2) || (p.mode === "insert" && p.progress > 0.8);

        if (isDetached) {
            if (isComplementary(cleanSeq(p.vecLTop)+cleanSeq(p.vecRTop), cleanSeq(p.vecLBot)+cleanSeq(p.vecRBot))) {
                p.startSelfLigationAnimation();
            } else alert("❌ 自连失败：末端碱基不匹配！");
        } else if (isInserted) {
            if (isComplementary(cleanSeq(p.vecLTop)+cleanSeq(p.fragTop)+cleanSeq(p.vecRTop), cleanSeq(p.vecLBot)+cleanSeq(p.fragBot)+cleanSeq(p.vecRBot))) {
                p.setStaticState(p.mode === "insert" ? "insert" : "extract", p.mode === "insert" ? 1.0 : 0.0);
                alert("🎉 重组成功！片段已完美插入载体。");
            } else alert("❌ 嵌入失败：碱基不配对！建议翻转片段再试。");
        } else {
            alert("⚠️ 请将片段拖拽到最上方或缺口内部再执行拼合！");
        }
    }
}

window.onload = () => new MainApp();