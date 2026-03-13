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
// 类：3D 形变渲染区 (完美碰撞检测 + 绝对中心锚定)
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
        this.extractDistance = 1.0; 
        this.insertDistance = 1.0;
        
        // 旋转参数
        this.rotationAngleZ = 0.0; 
        this.rotationAngleY = 0.0; 
        this.isRotating = false;
        this.isSelfLigating = false;
        this.selfLigationProgress = 0.0;
        
        this.isClosedCircle = true; 
        
        this.fragTop = ""; this.fragBot = "";
        this.vecLTop = ""; this.vecLBot = "";
        this.vecRTop = ""; this.vecRBot = "";
        this.fragOffset = 0; 
        
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

    // 动画引擎：平面旋转 (绕Z轴)
    startZRotationAnimation() {
        if (this.isRotating || this.isSelfLigating) return;
        this.isRotating = true;
        let start = performance.now();
        const animate = (time) => {
            let p = (time - start) / 600.0;
            if (p >= 1.0) {
                this.isRotating = false;
                this.rotationAngleZ = 0;
                
                let oldFTLen = getTokens(this.fragTop).length;
                let oldFBLen = getTokens(this.fragBot).length;
                // Z轴旋转的拓扑偏移推算公式
                this.fragOffset = this.fragOffset + oldFBLen - oldFTLen;

                let nT = cleanSeq(this.fragBot).split('').reverse().join('');
                let nB = cleanSeq(this.fragTop).split('').reverse().join('');
                this.fragTop = formatSeq(nT) + (nT ? "-" : ""); 
                this.fragBot = formatSeq(nB) + (nB ? "-" : "");
                this.paint();
            } else {
                this.rotationAngleZ = p * 180;
                this.paint();
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

    // 动画引擎：水平翻转 (绕Y轴)
    startYRotationAnimation() {
        if (this.isRotating || this.isSelfLigating) return;
        this.isRotating = true;
        let start = performance.now();
        const animate = (time) => {
            let p = (time - start) / 600.0;
            if (p >= 1.0) {
                this.isRotating = false;
                this.rotationAngleY = 0;
                
                let oldFTLen = getTokens(this.fragTop).length;
                let oldFBLen = getTokens(this.fragBot).length;
                // Y轴翻转的拓扑偏移推算公式
                this.fragOffset = oldFTLen - oldFBLen - this.fragOffset;

                let nT = cleanSeq(this.fragTop).split('').reverse().join('');
                let nB = cleanSeq(this.fragBot).split('').reverse().join('');
                this.fragTop = formatSeq(nT) + (nT ? "-" : ""); 
                this.fragBot = formatSeq(nB) + (nB ? "-" : "");
                this.paint();
            } else {
                this.rotationAngleY = p * 180;
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
        const moveHandler = y => {
            if (!isDown || this.isRotating || this.isSelfLigating) return;
            let delta = (y - lastY) / 300.0; 
            this.progress += (this.mode === "extract") ? -delta : delta;
            this.progress = Math.max(0.0, Math.min(1.0, this.progress));
            lastY = y;
            this.paint();
        };
        this.canvas.addEventListener('mousedown', e => startHandler(e.clientY));
        window.addEventListener('mouseup', () => isDown = false);
        this.canvas.addEventListener('mousemove', e => moveHandler(e.clientY));
        this.canvas.addEventListener('touchstart', e => { startHandler(e.touches[0].clientY); }, {passive: false});
        window.addEventListener('touchend', () => isDown = false);
        this.canvas.addEventListener('touchmove', e => { e.preventDefault(); moveHandler(e.touches[0].clientY); }, {passive: false});
    }

    morphPoint(r, thetaDeg, t, dist, rRef) {
        const rad = thetaDeg * Math.PI / 180, radMid = this.centerTheta * Math.PI / 180;
        const xArc = r * Math.cos(rad), yArc = r * Math.sin(rad);
        const s = rRef * (radMid - rad);
        const xLine = r * Math.cos(radMid) + s * Math.sin(radMid), yLine = r * Math.sin(radMid) - s * Math.cos(radMid);
        return { x: (1 - t) * xArc + t * xLine + dist * Math.cos(radMid), y: (1 - t) * yArc + t * yLine + dist * Math.sin(radMid) };
    }

    drawMorphedLayer(r1, r2, theta1, theta2, color, t, dist, rRef) {
        this.ctx.beginPath();
        const steps = 40, stepSize = (theta2 - theta1) / steps;
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
        const tokens = getTokens(text), n = tokens.length, offset = this.degPerToken / 2.0;
        let startTh = anchor === "start" ? edgeAngle + offset*alignDir : edgeAngle - (n-1)*this.degPerToken*alignDir - offset*alignDir;
        this.ctx.fillStyle = "#000"; this.ctx.font = "bold 22px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
        for (let i = 0; i < n; i++) {
            let th = startTh + i * this.degPerToken * alignDir, p = this.morphPoint(radius, th, t, dist, rRef);
            let rot = (1 - t) * (th - 90) + t * (this.centerTheta - 90); 
            // 【修复点】：彻底移除了 if (rot < -90 || rot > 90) rot += 180;
            // 使所有字体严格自然贴合圆环排列，不再强制翻转！
            this.ctx.save(); 
            this.ctx.translate(this.CX + p.x * this.SCALE, this.CY - p.y * this.SCALE); 
            this.ctx.rotate((-rot) * Math.PI / 180); 
            this.ctx.fillText(tokens[i], 0, 0); 
            this.ctx.restore();
        }
    }

    paint() {
        this.ctx.fillStyle = "#fafafa"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        let rOutE = 1.05, w = 0.20, rMid = rOutE - w, rOutT = rOutE - w/2, rInT = rMid - w/2;   
        let deg = this.degPerToken;

        let lenFT = getTokens(this.fragTop).length;
        let lenFB = getTokens(this.fragBot).length;
        let lOffTokens = getTokens(this.vecLBot).length - getTokens(this.vecLTop).length;
        let rOffTokens = getTokens(this.vecRTop).length - getTokens(this.vecRBot).length;
        let fragOffset = this.fragOffset || 0;

        // 1. 在本地坐标系中建立片段几何
        let L_bound = Math.min(0, fragOffset);
        let R_bound = Math.max(lenFT, fragOffset + lenFB);
        let C = (L_bound + R_bound) / 2.0;

        let fTL = 90 + C * deg;                 
        let fTR = fTL - lenFT * deg;               
        let fBL = 90 + (C - fragOffset) * deg;     
        let fBR = fBL - lenFB * deg;               

        // 2. 防干涉碰撞检测（智能适应间距）
        let vTL, vTR;
        if (lenFT === 0 && lenFB === 0) {
            let minGap = this.isClosedCircle ? 0 : 1.0; 
            vTL = 90 + minGap * deg;
            vTR = 90 - minGap * deg;
        } else {
            // 当片段存在时，强制载体完美紧贴边界，不留额外空隙
            vTL = Math.max(fTL, fBL + lOffTokens * deg);
            vTR = Math.min(fTR, fBR + rOffTokens * deg);
        }

        // 3. 【核心修复】：整体锚定平移，锁死旋转中心
        // 算出载体间隙的中心，然后将所有元素反向移动，确保视觉中心永远定在 90 度
        let vCenter = (vTL + vTR) / 2.0;
        let shift = 90 - vCenter;
        
        vTL += shift; vTR += shift;
        fTL += shift; fTR += shift;
        fBL += shift; fBR += shift;

        let pSmooth = this.progress * this.progress * (3 - 2 * this.progress);
        let tMorph = this.mode === "extract" ? pSmooth : 1.0 - pSmooth;
        let currentDist = this.mode === "extract" ? this.extractDistance * pSmooth : this.insertDistance * (1.0 - pSmooth);

        let vL = vTL, vR_text = vTR;
        if (this.isSelfLigating) { 
            vL = vTL - ((vTL - 90) * this.selfLigationProgress); 
            vR_text = vTR + ((90 - vTR) * this.selfLigationProgress); 
        }
        
        let vR = 360 + vR_text; 
        let vL_bot = vL - lOffTokens * deg;
        let vR_bot = vR - rOffTokens * deg;

        this.drawMorphedLayer(rMid, rOutE, vL, vR, this.vectorColor, 0, 0, rMid);
        this.drawMorphedLayer(rMid-w, rMid, vL_bot, vR_bot, this.vectorColor, 0, 0, rMid);
        
        this.drawMorphedText(this.vecLTop, rOutT, vL, -1, "end", 0, 0, rMid);
        this.drawMorphedText(this.vecLBot, rInT, vL_bot, -1, "end", 0, 0, rMid);
        this.drawMorphedText(this.vecRTop, rOutT, vR_text, -1, "start", 0, 0, rMid);
        this.drawMorphedText(this.vecRBot, rInT, vR_bot, -1, "start", 0, 0, rMid);

        if (lenFT > 0 || lenFB > 0) {
            this.ctx.save();
            let fCenter = this.morphPoint(rMid - w/2, 90, tMorph, currentDist, rMid);
            
            // 执行真实的中心锚定翻转动画
            this.ctx.translate(this.CX + fCenter.x * this.SCALE, this.CY - fCenter.y * this.SCALE);
            if (this.rotationAngleZ !== 0) this.ctx.rotate(this.rotationAngleZ * Math.PI / 180);
            if (this.rotationAngleY !== 0) this.ctx.scale(Math.cos(this.rotationAngleY * Math.PI / 180), 1);
            this.ctx.translate(-(this.CX + fCenter.x * this.SCALE), -(this.CY - fCenter.y * this.SCALE));
            
            if (this.isSelfLigating) {
                let rSmall = 70, cx = this.CX + fCenter.x * this.SCALE, cy = this.CY - fCenter.y * this.SCALE;
                this.ctx.beginPath(); this.ctx.strokeStyle = this.fragmentColor; this.ctx.lineWidth = 45;
                let curA = 360 * this.selfLigationProgress; this.ctx.arc(cx, cy, rSmall, (-90 - curA/2)*Math.PI/180, (-90 + curA/2)*Math.PI/180); this.ctx.stroke();
                
                if (this.selfLigationProgress > 0.0) {
                    this.ctx.globalAlpha = Math.pow(this.selfLigationProgress, 2); this.ctx.fillStyle = "#000"; this.ctx.font = "bold 18px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
                    let tT = getTokens(this.fragTop), bT = getTokens(this.fragBot), n = tT.length;
                    if (n > 0) {
                        let apT = 360.0 / n;
                        for (let i = 0; i < n; i++) {
                            let th = -90 + (i + 0.5) * apT, rad = th * Math.PI / 180;
                            let tr = rSmall + 11; this.ctx.save(); this.ctx.translate(cx + tr * Math.cos(rad), cy + tr * Math.sin(rad)); this.ctx.rotate(rad + Math.PI/2); this.ctx.fillText(tT[i], 0, 0); this.ctx.restore();
                            if (i < bT.length) { let br = rSmall - 11; this.ctx.save(); this.ctx.translate(cx + br * Math.cos(rad), cy + br * Math.sin(rad)); this.ctx.rotate(rad + Math.PI/2); this.ctx.fillText(bT[i], 0, 0); this.ctx.restore(); }
                        }
                    }
                    this.ctx.globalAlpha = 1.0;
                }
            } else {
                if (lenFT > 0) {
                    this.drawMorphedLayer(rMid, rOutE, fTR, fTL, this.fragmentColor, tMorph, currentDist, rMid);
                    this.drawMorphedText(this.fragTop, rOutT, fTL, -1, "start", tMorph, currentDist, rMid);
                }
                if (lenFB > 0) {
                    this.drawMorphedLayer(rMid-w, rMid, fBR, fBL, this.fragmentColor, tMorph, currentDist, rMid);
                    this.drawMorphedText(this.fragBot, rInT, fBL, -1, "start", tMorph, currentDist, rMid);
                }
            }
            this.ctx.restore();
        }
    }
}

// ==========================================
// 类：圆环选取器
// ==========================================
class CircularGeneSelector {
    constructor(canvasId, topSeq, botSeq) {
        this.canvas = document.getElementById(canvasId); this.ctx = this.canvas.getContext('2d');
        this.sequences = [topSeq, botSeq]; this.starts = [-1, -1]; this.ends = [-1, -1];
        this.degPerUnit = 8.5; this.rOut = 190; this.rIn = 150; 
        const interactionEvent = e => {
            e.preventDefault(); const rect = this.canvas.getBoundingClientRect();
            let cX = e.touches ? e.touches[0].clientX : e.clientX, cY = e.touches ? e.touches[0].clientY : e.clientY;
            this.handleInteraction(cX - rect.left, cY - rect.top);
        };
        this.canvas.addEventListener('mousedown', interactionEvent); this.canvas.addEventListener('touchstart', interactionEvent, {passive: false});
    }
    reset() { this.starts = [-1, -1]; this.ends = [-1, -1]; this.paint(); }
    show() { this.canvas.style.display = 'block'; this.paint(); }
    hide() { this.canvas.style.display = 'none'; }
    getRowParts(row) {
        if (this.starts[row] === -1) return null;
        let s = this.sequences[row]; if (this.ends[row] === -1) return [s.substring(0, this.starts[row]), "", s.substring(this.starts[row] + 1)];
        let st = Math.min(this.starts[row], this.ends[row]), ed = Math.max(this.starts[row], this.ends[row]);
        return [s.substring(0, st), s.substring(st + 1, ed), s.substring(ed + 1)];
    }
    handleInteraction(x, y) {
        let dx = x - this.canvas.width/2, dy = this.canvas.height/2 - y, dist = Math.sqrt(dx*dx + dy*dy);
        let row = -1; if (dist >= 170 && dist <= 210) row = 0; else if (dist >= 130 && dist < 170) row = 1;
        if (row !== -1) {
            let aD = Math.atan2(dx, dy) * 180 / Math.PI; if (aD < 0) aD += 360;
            let n = this.sequences[row].length, off = (n * this.degPerUnit) / 2.0, rel = aD + off; if (rel >= 360) rel -= 360;
            let idx = Math.round(rel / this.degPerUnit); if (idx % 2 === 0) idx += (rel/this.degPerUnit > idx) ? 1 : -1;
            idx = Math.max(1, Math.min(n-2, idx));
            if (this.starts[row] === -1 || (this.starts[row] !== -1 && this.ends[row] !== -1)) { this.starts[row] = idx; this.ends[row] = -1; } else { this.ends[row] = idx; }
            this.paint();
        }
    }
    paint() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); let cx = this.canvas.width/2, cy = this.canvas.height/2;
        this.ctx.lineWidth = 40; this.ctx.strokeStyle = "rgba(168, 230, 207, 0.4)";
        this.ctx.beginPath(); this.ctx.arc(cx, cy, this.rOut, 0, Math.PI*2); this.ctx.stroke(); this.ctx.beginPath(); this.ctx.arc(cx, cy, this.rIn, 0, Math.PI*2); this.ctx.stroke();
        this.ctx.font = "bold 22px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
        for (let row = 0; row < 2; row++) {
            let seq = this.sequences[row], r = row === 0 ? this.rOut : this.rIn, off = (seq.length * this.degPerUnit) / 2.0;
            for (let i = 0; i < seq.length; i++) {
                let deg = (i * this.degPerUnit) - off + (this.degPerUnit / 2.0), rad = (deg - 90) * Math.PI / 180, x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
                let isD = (i === this.starts[row] || i === this.ends[row]), st = Math.min(this.starts[row], this.ends[row]), ed = Math.max(this.starts[row], this.ends[row]), isS = this.ends[row] !== -1 && (i > st && i < ed);
                this.ctx.fillStyle = isS ? "red" : "black"; this.ctx.save(); this.ctx.translate(x, y); this.ctx.rotate(rad + Math.PI/2); if (!isD) this.ctx.fillText(seq[i], 0, 0); this.ctx.restore();
                if (isD) {
                    let lR = ((i * this.degPerUnit) - off + (this.degPerUnit / 2.0) - 90) * Math.PI / 180;
                    this.ctx.strokeStyle = "red"; this.ctx.lineWidth = 4; this.ctx.beginPath(); this.ctx.moveTo(cx + (r-20)*Math.cos(lR), cy + (r-20)*Math.sin(lR)); this.ctx.lineTo(cx + (r+20)*Math.cos(lR), cy + (r+20)*Math.sin(lR)); this.ctx.stroke();
                }
            }
        }
    }
}

// ==========================================
// 类：线性片段选取器
// ==========================================
class GeneSegmentSelector {
    constructor(canvasId, topSeq, botSeq) {
        this.canvas = document.getElementById(canvasId); this.ctx = this.canvas.getContext('2d');
        this.sequences = [topSeq, botSeq]; this.starts = [-1, -1]; this.ends = [-1, -1];
        this.unit = 18; this.startX = 40; this.cy = 250; 
        const interactionEvent = e => {
            e.preventDefault(); const rect = this.canvas.getBoundingClientRect();
            let cX = e.touches ? e.touches[0].clientX : e.clientX, cY = e.touches ? e.touches[0].clientY : e.clientY;
            this.handleInteraction(cX - rect.left, cY - rect.top);
        };
        this.canvas.addEventListener('mousedown', interactionEvent); this.canvas.addEventListener('touchstart', interactionEvent, {passive: false});
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
            let idx = Math.round((x - this.startX) / this.unit); if (idx % 2 === 0) idx += ((x - this.startX) / this.unit > idx) ? 1 : -1;
            idx = Math.max(1, Math.min(this.sequences[row].length-2, idx));
            if (this.starts[row] === -1 || (this.starts[row] !== -1 && this.ends[row] !== -1)) { this.starts[row] = idx; this.ends[row] = -1; } else { this.ends[row] = idx; }
            this.paint();
        }
    }
    paint() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.ctx.font = "bold 22px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
        for (let row = 0; row < 2; row++) {
            let seq = this.sequences[row], yPos = row === 0 ? this.cy - 20 : this.cy + 20;
            this.ctx.fillStyle = "rgba(168, 230, 207, 0.5)"; this.ctx.fillRect(this.startX - this.unit/2, yPos - 20, seq.length * this.unit, 40);
            for (let i = 0; i < seq.length; i++) {
                let x = this.startX + i * this.unit, isD = (i === this.starts[row] || i === this.ends[row]), st = Math.min(this.starts[row], this.ends[row]), ed = Math.max(this.starts[row], this.ends[row]), isS = this.ends[row] !== -1 && (i > st && i < ed);
                this.ctx.fillStyle = isS ? "red" : "black"; if (!isD) this.ctx.fillText(seq[i], x, yPos);
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
        this.INITIAL_SEQ_TOP = "A-T-G-C-G-T-A-A-T-A-G-C"; this.INITIAL_SEQ_BOT = "T-A-C-G-C-A-T-T-A-T-C-G";
        this.LINEAR_GENE_TOP = "G-G-A-T-C-C-A-A-G-C-T-T"; this.LINEAR_GENE_BOT = "C-C-T-A-G-G-T-T-C-G-A-A";
        this.plasmidPanel = new PlasmidPanel('previewCanvas');
        this.circSelector = new CircularGeneSelector('circularCanvas', this.INITIAL_SEQ_TOP, this.INITIAL_SEQ_BOT);
        this.linSelector = new GeneSegmentSelector('linearCanvas', this.LINEAR_GENE_TOP, this.LINEAR_GENE_BOT);
        this.appStep = 1; this.bindEvents(); this.resetState();
    }

    showModal(title, body, btnText = "我知道了") {
        const overlay = document.getElementById('modal-overlay');
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = body;
        document.getElementById('modal-close').innerText = btnText;
        overlay.style.display = 'flex';
    }

    bindEvents() {
        document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal-overlay').style.display = 'none');
        document.getElementById('btn-reset').addEventListener('click', () => this.resetState());
        
        document.getElementById('btn-rotate-z').addEventListener('click', () => {
            let p = this.plasmidPanel.progress, m = this.plasmidPanel.mode;
            let isAway = (m === "extract" && p > 0.8) || (m === "insert" && p < 0.2);
            if (!isAway) return alert("⚠️ 请先将片段向上拉拽到远离载体的位置（最上方）再旋转！");
            this.plasmidPanel.startZRotationAnimation();
        });

        document.getElementById('btn-rotate-y').addEventListener('click', () => {
            let p = this.plasmidPanel.progress, m = this.plasmidPanel.mode;
            let isAway = (m === "extract" && p > 0.8) || (m === "insert" && p < 0.2);
            if (!isAway) return alert("⚠️ 请先将片段向上拉拽到远离载体的位置（最上方）再翻转！");
            this.plasmidPanel.startYRotationAnimation();
        });

        document.getElementById('btn-ligate').addEventListener('click', () => this.executeLigation());
        document.getElementById('btn-cut').addEventListener('click', () => this.executeCut());
    }

    resetState() {
        this.appStep = 1; this.circSelector.reset(); this.circSelector.show(); this.linSelector.hide();
        
        let mid = Math.floor(this.INITIAL_SEQ_TOP.length / 2);
        let vLT = this.INITIAL_SEQ_TOP.substring(0, mid), vLB = this.INITIAL_SEQ_BOT.substring(0, mid);
        let vRT = this.INITIAL_SEQ_TOP.substring(mid), vRB = this.INITIAL_SEQ_BOT.substring(mid);
        
        this.plasmidPanel.fragOffset = 0;
        this.plasmidPanel.isClosedCircle = true; 
        
        this.plasmidPanel.setSequences(
            "", "", 
            `${formatSeq(vLT)}-`, `${formatSeq(vLB)}-`, 
            `${formatSeq(vRT)}`, `${formatSeq(vRB)}`
        );
        this.plasmidPanel.setStaticState("extract", 0.0);
        
        document.getElementById('step-title').innerText = "交互操作区 - 步骤 1：圆环切割";
        document.getElementById('status-text').innerText = "请点击左侧圆环上的连字符 (-) 选择切割位点。";
        this.showModal("欢迎来到基因克隆仿真实验", "<b>第一步：准备载体</b><br>我们需要切开质粒载体。请在左侧圆环的上下两条链上分别点击一个红色的切割位点（选择一个区域），然后点击“执行切割”。");
    }

    executeCut() {
        let activeSel = (this.appStep === 1) ? this.circSelector : this.linSelector;
        let tParts = activeSel.getRowParts(0), bParts = activeSel.getRowParts(1);
        if (!tParts || !bParts) return alert("⚠️ 请先在上下链各选择两个红色的切割标识点！");

        // 【修正1】：完全正确的粘性末端符号推算 (stB - stT)，修正错位！
        let getSt = (sel, row) => sel.ends[row] === -1 ? sel.starts[row] : Math.min(sel.starts[row], sel.ends[row]);
        let stT = getSt(activeSel, 0);
        let stB = getSt(activeSel, 1);
        let structuralOffset = stB - stT; 

        if (this.appStep === 1) {
            let fT = formatSeq(tParts[1]); fT = fT ? fT + "-" : "";
            let fB = formatSeq(bParts[1]); fB = fB ? fB + "-" : "";
            
            this.plasmidPanel.fragOffset = structuralOffset;
            this.plasmidPanel.isClosedCircle = false; 
            
            this.plasmidPanel.setSequences(
                fT, fB, 
                `5'-${formatSeq(tParts[0])}-`, `3'-${formatSeq(bParts[0])}-`, 
                `${formatSeq(tParts[2])}-3'`, `${formatSeq(bParts[2])}-5'`
            );
            
            this.appStep = 2; this.circSelector.hide(); this.linSelector.reset(); this.linSelector.show();
            document.getElementById('step-title').innerText = "交互操作区 - 步骤 2：片段提取";
            
            if (fT === "" && fB === "") {
                document.getElementById('status-text').innerText = "载体已被线性化切开！请直接开始拼合操作。";
                this.showModal("载体被切开", "<b>检测到单端切割</b><br>载体环已经断开，但并没有片段被提取出来（这被称为质粒的线性化）。请在此基础上继续操作。");
            } else {
                document.getElementById('status-text').innerText = "载体已切开！请在右侧预览图上【向上拖拽】拔出旧片段。";
                this.showModal("载体已切开", "<b>第二步：提取旧片段并准备新基因</b><br>载体现在出现了缺口。请在右侧 3D 预览区<b>向上拖拽</b>把不需要的片段拔出来。如果末端有粘性突出，会被精准保留下来。");
            }
        } else {
            let fT = formatSeq(tParts[1]); this.plasmidPanel.fragTop = fT ? fT + "-" : "";
            let fB = formatSeq(bParts[1]); this.plasmidPanel.fragBot = fB ? fB + "-" : "";
            this.plasmidPanel.fragOffset = structuralOffset;
            this.plasmidPanel.setStaticState("insert", 0.0);
            document.getElementById('status-text').innerText = "新基因就绪！请在右侧预览图上【向下拖拽】将其嵌入载体。";
            this.showModal("新基因已就绪", "<b>第三步：重组拼合</b><br>你已经选择了目标基因。请在右侧 3D 预览区<b>向下拖拽</b>将新片段送入载体缺口。注意配对问题。");
        }
    }

    executeLigation() {
        if (this.appStep === 1) return alert("⚠️ 请先完成切割和提取流程！");
        let p = this.plasmidPanel;
        
        let isAway = (p.mode === "extract" && p.progress > 0.8) || (p.mode === "insert" && p.progress < 0.2);
        let isInside = (p.mode === "extract" && p.progress < 0.2) || (p.mode === "insert" && p.progress > 0.8);

        if (isAway) {
            if (isComplementary(cleanSeq(p.vecLTop)+cleanSeq(p.vecRTop), cleanSeq(p.vecLBot)+cleanSeq(p.vecRBot))) {
                p.startSelfLigationAnimation();
                this.showModal("发现自连现象！", "载体自己闭合了。在现实实验中，我们需要使用去磷酸化酶来防止这种情况发生。");
            } else alert("❌ 无法闭合：末端碱基不匹配！");
        } else if (isInside) {
            if (isComplementary(cleanSeq(p.vecLTop)+cleanSeq(p.fragTop)+cleanSeq(p.vecRTop), cleanSeq(p.vecLBot)+cleanSeq(p.fragBot)+cleanSeq(p.vecRBot))) {
                p.setStaticState(p.mode === "insert" ? "insert" : "extract", p.mode === "insert" ? 1.0 : 0.0);
                this.showModal("🎉 重组成功！", "<b>太棒了！</b> 新基因已由于粘性末端的精准配对，完美整合进载体中。<br><br>科学探索永无止境，希望你能继续保持这份好奇心！", "完成实验");
            } else alert("❌ 拼合失败：碱基不配对或发生干涉！提示：尝试使用控制栏的【旋转】或【翻转】对片段进行调整。");
        } else {
            alert("⚠️ 请将片段拖拽到最上方或缺口中心位置再点击拼合！");
        }
    }
}
window.onload = () => new MainApp();