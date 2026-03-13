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
        this.degPerToken = 8.5; 
        this.centerTheta = 90.0;
        this.SCALE = 200.0; 
        this.CX = 400; this.CY = 460;
        this.mode = "extract";
        this.progress = 0.0;
        this.extractDistance = 1.0; // 调高高度
        this.insertDistance = 1.0;
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
                let nT = cleanSeq(this.fragBot).split('').reverse().join('');
                let nB = cleanSeq(this.fragTop).split('').reverse().join('');
                nT = formatSeq(nT); if (nT) nT += "-";
                nB = formatSeq(nB); if (nB) nB += "-";
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
        const startHandler = y => { isDown = true; lastY = y; };
        const endHandler = () => isDown = false;
        const moveHandler = y => {
            if (!isDown || this.isRotating || this.isSelfLigating) return;
            let delta = (y - lastY) / 300.0; 
            this.progress += (this.mode === "extract") ? -delta : delta;
            this.progress = Math.max(0.0, Math.min(1.0, this.progress));
            lastY = y;
            this.paint();
        };

        this.canvas.addEventListener('mousedown', e => startHandler(e.clientY));
        window.addEventListener('mouseup', endHandler);
        this.canvas.addEventListener('mousemove', e => moveHandler(e.clientY));

        this.canvas.addEventListener('touchstart', e => { startHandler(e.touches[0].clientY); }, {passive: false});
        window.addEventListener('touchend', endHandler);
        this.canvas.addEventListener('touchmove', e => { e.preventDefault(); moveHandler(e.touches[0].clientY); }, {passive: false});
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
        this.ctx.closePath(); this.ctx.fillStyle = color; this.ctx.fill();
    }

    drawMorphedText(text, radius, edgeAngle, alignDir, anchor, t, dist, rRef) {
        if (!text) return;
        const tokens = getTokens(text);
        const n = tokens.length;
        const offset = this.degPerToken / 2.0;
        let startTh = anchor === "start" ? edgeAngle + offset*alignDir : edgeAngle - (n-1)*this.degPerToken*alignDir - offset*alignDir;
        this.ctx.fillStyle = "#000"; this.ctx.font = "bold 22px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
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
        this.ctx.fillStyle = "#fafafa"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        let rOutE = 1.05, w = 0.20, rMid = rOutE - w; 
        let rOutT = rOutE - w/2, rInT = rMid - w/2;   
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
                let rSmall = 70, cx = this.CX + fCenter.x * this.SCALE, cy = this.CY - fCenter.y * this.SCALE;
                this.ctx.beginPath(); this.ctx.strokeStyle = this.fragmentColor; this.ctx.lineWidth = 45;
                let currentAngle = 360 * this.selfLigationProgress;
                this.ctx.arc(cx, cy, rSmall, (-90 - currentAngle/2)*Math.PI/180, (-90 + currentAngle/2)*Math.PI/180);
                this.ctx.stroke();
                if (this.selfLigationProgress > 0.0) {
                    this.ctx.globalAlpha = Math.pow(this.selfLigationProgress, 2);
                    this.ctx.fillStyle = "#000"; this.ctx.font = "bold 18px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
                    let tTokens = getTokens(this.fragTop), bTokens = getTokens(this.fragBot), n = tTokens.length;
                    if (n > 0) {
                        let anglePerToken = 360.0 / n;
                        for (let i = 0; i < n; i++) {
                            let th = -90 + (i + 0.5) * anglePerToken, rad = th * Math.PI / 180;
                            let tr = rSmall + 11; this.ctx.save(); this.ctx.translate(cx + tr * Math.cos(rad), cy + tr * Math.sin(rad)); this.ctx.rotate(rad + Math.PI/2); this.ctx.fillText(tTokens[i], 0, 0); this.ctx.restore();
                            if (i < bTokens.length) {
                                let br = rSmall - 11; this.ctx.save(); this.ctx.translate(cx + br * Math.cos(rad), cy + br * Math.sin(rad)); this.ctx.rotate(rad + Math.PI/2); this.ctx.fillText(bTokens[i], 0, 0); this.ctx.restore();
                            }
                        }
                    }
                    this.ctx.globalAlpha = 1.0;
                }
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
        this.starts = [-1, -1]; this.ends = [-1, -1];
        this.degPerUnit = 8.5; this.rOut = 190; this.rIn = 150; 
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
        let st = Math.min(this.starts[row], this.ends[row]), ed = Math.max(this.starts[row], this.ends[row]);
        return [s.substring(0, st), s.substring(st + 1, ed), s.substring(ed + 1)];
    }
    handleInteraction(x, y) {
        let dx = x - this.canvas.width/2, dy = this.canvas.height/2 - y, dist = Math.sqrt(dx*dx + dy*dy);
        let row = -1;
        if (dist >= 170 && dist <= 210) row = 0; else if (dist >= 130 && dist < 170) row = 1;
        if (row !== -1) {
            let angleDeg = Math.atan2(dx, dy) * 180 / Math.PI; if (angleDeg < 0) angleDeg += 360;
            let n = this.sequences[row].length, offset = (n * this.degPerUnit) / 2.0, rel = angleDeg + offset;
            if (rel >= 360) rel -= 360;
            let idx = Math.round(rel / this.degPerUnit);
            if (idx % 2 === 0) idx += (rel/this.degPerUnit > idx) ? 1 : -1;
            idx = Math.max(1, Math.min(n-2, idx));
            if (this.starts[row] === -1 || (this.starts[row] !== -1 && this.ends[row] !== -1)) { this.starts[row] = idx; this.ends[row] = -1; }
            else { this.ends[row] = idx; }
            this.paint();
        }
    }
    paint() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        let cx = this.canvas.width/2, cy = this.canvas.height/2;
        this.ctx.lineWidth = 40; this.ctx.strokeStyle = "rgba(168, 230, 207, 0.4)";
        this.ctx.beginPath(); this.ctx.arc(cx, cy, this.rOut, 0, Math.PI*2); this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.arc(cx, cy, this.rIn, 0, Math.PI*2); this.ctx.stroke();
        this.ctx.font = "bold 22px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
        for (let row = 0; row < 2; row++) {
            let seq = this.sequences[row], r = row === 0 ? this.rOut : this.rIn, offset = (seq.length * this.degPerUnit) / 2.0;
            for (let i = 0; i < seq.length; i++) {
                let deg = (i * this.degPerUnit) - offset + (this.degPerUnit / 2.0), rad = (deg - 90) * Math.PI / 180, x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
                let isSelectedDash = (i === this.starts[row] || i === this.ends[row]), st = Math.min(this.starts[row], this.ends[row]), ed = Math.max(this.starts[row], this.ends[row]), isSelected = this.ends[row] !== -1 && (i > st && i < ed);
                this.ctx.fillStyle = isSelected ? "red" : "black"; this.ctx.save(); this.ctx.translate(x, y); this.ctx.rotate(rad + Math.PI/2);
                if (!isSelectedDash) this.ctx.fillText(seq[i], 0, 0); this.ctx.restore();
                if (isSelectedDash) {
                    let lineRad = ((i * this.degPerUnit) - offset + (this.degPerUnit / 2.0) - 90) * Math.PI / 180;
                    this.ctx.strokeStyle = "red"; this.ctx.lineWidth = 4; this.ctx.beginPath(); this.ctx.moveTo(cx + (r-20)*Math.cos(lineRad), cy + (r-20)*Math.sin(lineRad)); this.ctx.lineTo(cx + (r+20)*Math.cos(lineRad), cy + (r+20)*Math.sin(lineRad)); this.ctx.stroke();
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
        this.starts = [-1, -1]; this.ends = [-1, -1];
        this.unit = 18; this.startX = 40; this.cy = 250; 
        const interactionEvent = e => {
            e.preventDefault(); const rect = this.canvas.getBoundingClientRect();
            let clientX = e.touches ? e.touches[0].clientX : e.clientX, clientY = e.touches ? e.touches[0].clientY : e.clientY;
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
        let s = this.sequences[row], st = Math.min(this.starts[row], this.ends[row]), ed = Math.max(this.starts[row], this.ends[row]);
        return [s.substring(0, st), s.substring(st + 1, ed), s.substring(ed + 1)];
    }
    handleInteraction(x, y) {
        let row = -1; if (y >= this.cy - 40 && y < this.cy) row = 0; else if (y >= this.cy && y <= this.cy + 40) row = 1;
        if (row !== -1) {
            let idx = Math.round((x - this.startX) / this.unit);
            if (idx % 2 === 0) idx += ((x - this.startX) / this.unit > idx) ? 1 : -1;
            idx = Math.max(1, Math.min(this.sequences[row].length-2, idx));
            if (this.starts[row] === -1 || (this.starts[row] !== -1 && this.ends[row] !== -1)) { this.starts[row] = idx; this.ends[row] = -1; }
            else { this.ends[row] = idx; }
            this.paint();
        }
    }
    paint() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = "bold 22px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
        for (let row = 0; row < 2; row++) {
            let seq = this.sequences[row], yPos = row === 0 ? this.cy - 20 : this.cy + 20;
            this.ctx.fillStyle = "rgba(168, 230, 207, 0.5)"; this.ctx.fillRect(this.startX - this.unit/2, yPos - 20, seq.length * this.unit, 40);
            for (let i = 0; i < seq.length; i++) {
                let x = this.startX + i * this.unit, isSelectedDash = (i === this.starts[row] || i === this.ends[row]), st = Math.min(this.starts[row], this.ends[row]), ed = Math.max(this.starts[row], this.ends[row]), isSelected = this.ends[row] !== -1 && (i > st && i < ed);
                this.ctx.fillStyle = isSelected ? "red" : "black";
                if (!isSelectedDash) this.ctx.fillText(seq[i], x, yPos);
                else { this.ctx.strokeStyle = "red"; this.ctx.lineWidth = 4; this.ctx.beginPath(); this.ctx.moveTo(x, yPos - 20); this.ctx.lineTo(x, yPos + 20); this.ctx.stroke(); }
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

    showModal(title, body, btnText = "我知道了") {
        const overlay = document.getElementById('modal-overlay');
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = body;
        document.getElementById('modal-close').innerText = btnText;
        overlay.style.display = 'flex';
    }

    bindEvents() {
        document.getElementById('modal-close').addEventListener('click', () => {
            document.getElementById('modal-overlay').style.display = 'none';
        });
        document.getElementById('btn-reset').addEventListener('click', () => this.resetState());
        document.getElementById('btn-rotate').addEventListener('click', () => {
            let p = this.plasmidPanel.progress;
            if (p < 0.6) return alert("⚠️ 请先将片段向上拉拽到远离载体的位置！");
            this.plasmidPanel.startRotationAnimation();
        });
        document.getElementById('btn-ligate').addEventListener('click', () => this.executeLigation());
        document.getElementById('btn-cut').addEventListener('click', () => this.executeCut());
    }

    resetState() {
        this.appStep = 1;
        this.circSelector.reset(); this.circSelector.show(); this.linSelector.hide();
        let mid = Math.floor(this.INITIAL_SEQ_TOP.length / 2);
        let vLT = this.INITIAL_SEQ_TOP.substring(0, mid), vLB = this.INITIAL_SEQ_BOT.substring(0, mid);
        let vRT = this.INITIAL_SEQ_TOP.substring(mid), vRB = this.INITIAL_SEQ_BOT.substring(mid);
        this.plasmidPanel.setSequences("", "", `5'-${formatSeq(vLT)}-`, `3'-${formatSeq(vLB)}-`, `${formatSeq(vRT)}-3'`, `${formatSeq(vRB)}-5'`);
        this.plasmidPanel.setStaticState("extract", 0.0);
        document.getElementById('step-title').innerText = "交互操作区 - 步骤 1：圆环切割";
        document.getElementById('status-text').innerText = "请点击左侧圆环上的连字符 (-) 选择切割位点。";
        
        this.showModal("欢迎来到基因克隆仿真实验", "<b>第一步：准备载体</b><br>我们需要切开质粒载体。请在左侧圆环的上下两条链上分别点击一个红色的切割位点（选择一个区域），然后点击“执行切割”。");
    }

    executeCut() {
        let activeSel = (this.appStep === 1) ? this.circSelector : this.linSelector;
        let tParts = activeSel.getRowParts(0), bParts = activeSel.getRowParts(1);
        if (!tParts || !bParts) return alert("⚠️ 请先在上下链各选择两个红色的切割标识点！");

        if (this.appStep === 1) {
            let fT = formatSeq(tParts[1]); fT = fT ? fT + "-" : "";
            let fB = formatSeq(bParts[1]); fB = fB ? fB + "-" : "";
            this.plasmidPanel.setSequences(fT, fB, `5'-${formatSeq(tParts[0])}-`, `3'-${formatSeq(bParts[0])}-`, `${formatSeq(tParts[2])}-3'`, `${formatSeq(bParts[2])}-5'`);
            this.appStep = 2;
            this.circSelector.hide(); this.linSelector.reset(); this.linSelector.show();
            document.getElementById('step-title').innerText = "交互操作区 - 步骤 2：片段提取";
            document.getElementById('status-text').innerText = "载体已切开！请在右侧预览图上【向上拖拽】拔出旧片段。";
            
            this.showModal("载体已切开", "<b>第二步：提取旧片段并准备新基因</b><br>载体现在出现了缺口。请在右侧 3D 预览区<b>向上拖拽</b>把不需要的片段拔出来。然后回到左侧选择要插入的新基因片段。");
        } else {
            let fT = formatSeq(tParts[1]); this.plasmidPanel.fragTop = fT ? fT + "-" : "";
            let fB = formatSeq(bParts[1]); this.plasmidPanel.fragBot = fB ? fB + "-" : "";
            this.plasmidPanel.setStaticState("insert", 0.0);
            document.getElementById('status-text').innerText = "新基因就绪！请在右侧预览图上【向下拖拽】将其嵌入载体。";
            this.showModal("新基因已就绪", "<b>第三步：重组拼合</b><br>你已经选择了目标基因。请在右侧 3D 预览区<b>向下拖拽</b>将新片段送入载体缺口。如果方向不对，可以使用“旋转片段”按钮。");
        }
    }

    executeLigation() {
        if (this.appStep === 1) return alert("⚠️ 请先完成切割和提取流程！");
        let p = this.plasmidPanel;
        let isDetached = (p.mode === "extract" && p.progress > 0.6) || (p.mode === "insert" && p.progress < 0.2);
        let isInserted = (p.mode === "extract" && p.progress < 0.2) || (p.mode === "insert" && p.progress > 0.6);

        if (isDetached) {
            if (isComplementary(cleanSeq(p.vecLTop)+cleanSeq(p.vecRTop), cleanSeq(p.vecLBot)+cleanSeq(p.vecRBot))) {
                p.startSelfLigationAnimation();
                this.showModal("发现自连现象！", "载体在没有插入片段的情况下自己闭合了。在现实实验中，我们需要使用去磷酸化酶来防止这种情况发生。");
            } else alert("❌ 无法闭合：末端碱基不匹配！");
        } else if (isInserted) {
            if (isComplementary(cleanSeq(p.vecLTop)+cleanSeq(p.fragTop)+cleanSeq(p.vecRTop), cleanSeq(p.vecLBot)+cleanSeq(p.fragBot)+cleanSeq(p.vecRBot))) {
                p.setStaticState(p.mode === "insert" ? "insert" : "extract", p.mode === "insert" ? 1.0 : 0.0);
                this.showModal("🎉 重组成功！", "<b>太棒了！</b> 你已经成功完成了一个完整的基因克隆流程。新片段已完美整合进载体中。<br><br>科学探索永无止境，希望你能继续保持这份好奇心，深入研究生物技术的奥秘！", "完成实验");
            } else {
                alert("❌ 拼合失败：碱基不配对！提示：尝试点击“旋转片段”后再放入。");
            }
        } else {
            alert("⚠️ 请将片段拖拽到最上方或缺口中心再点击拼合！");
        }
    }
}

window.onload = () => new MainApp();