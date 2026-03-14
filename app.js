// ==========================================
// 辅助工具函数 (智能排版与解析引擎)
// ==========================================

// 智能排版：仅在相邻的大写 A, T, C, G 之间自动插入连字符。单词(如 Gene)保持完整。
function autoFormatATCG(seq) {
    if (!seq) return "";
    return seq.replace(/([ATCG])(?=[ATCG])/g, '$1-');
}

function cleanSeq(seq) { 
    return seq ? seq.replace(/-/g, "").replace(/5'/g, "").replace(/3'/g, "").trim() : ""; 
}

function getTokens(text) { 
    return (text || "").match(/5'|3'|\.{2,}|./g) || []; 
}

// 【核心修改】：更严谨的碱基互补配对算法
function isComplementary(top, bot) {
    if (!top || !bot || top.length !== bot.length || top.length === 0) return false;
    for (let i = 0; i < top.length; i++) {
        let t = top[i].toUpperCase();
        let b = bot[i].toUpperCase();
        
        let isTStandard = ['A','T','C','G'].includes(t);
        let isBStandard = ['A','T','C','G'].includes(b);
        
        if (isTStandard && isBStandard) {
            // 如果是标准碱基，必须遵循互补配对原则
            let pair = t + b;
            if (!['AT','TA','CG','GC'].includes(pair)) return false;
        } else {
            // 如果是占位符（如 'Gene' 中的字母），则要求完全一致才能对齐
            if (t !== b) return false;
        }
    }
    return true;
}

// 【核心修复：坐标缩放转换】
function getScaledCoords(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
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
        
        this.SCALE = 230.0; 
        this.CX = 400; 
        this.CY = 520; 
        
        this.centerTheta = 90.0;
        this.mode = "extract";
        this.progress = 0.0;
        this.extractDistance = 1.0; 
        this.insertDistance = 1.0;
        
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
                this.fragOffset = this.fragOffset + oldFBLen - oldFTLen;

                let nT = cleanSeq(this.fragBot).split('').reverse().join('');
                let nB = cleanSeq(this.fragTop).split('').reverse().join('');
                this.fragTop = autoFormatATCG(nT) + (nT ? "-" : ""); 
                this.fragBot = autoFormatATCG(nB) + (nB ? "-" : "");
                this.paint();
            } else {
                this.rotationAngleZ = p * 180;
                this.paint();
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

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
                this.fragOffset = oldFTLen - oldFBLen - this.fragOffset;

                let nT = cleanSeq(this.fragTop).split('').reverse().join('');
                let nB = cleanSeq(this.fragBot).split('').reverse().join('');
                this.fragTop = autoFormatATCG(nT) + (nT ? "-" : ""); 
                this.fragBot = autoFormatATCG(nB) + (nB ? "-" : "");
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
        this.ctx.fillStyle = "#000"; this.ctx.font = "bold 26px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
        for (let i = 0; i < n; i++) {
            let th = startTh + i * this.degPerToken * alignDir, p = this.morphPoint(radius, th, t, dist, rRef);
            let rot = (1 - t) * (th - 90) + t * (this.centerTheta - 90); 
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

        let L_bound = Math.min(0, fragOffset);
        let R_bound = Math.max(lenFT, fragOffset + lenFB);
        let C = (L_bound + R_bound) / 2.0;

        let fTL = 90 + C * deg;                 
        let fTR = fTL - lenFT * deg;               
        let fBL = 90 + (C - fragOffset) * deg;     
        let fBR = fBL - lenFB * deg;               

        let vTL, vTR;
        if (lenFT === 0 && lenFB === 0) {
            let totalGap = this.isClosedCircle ? 0 : (Math.abs(lOffTokens) + 1.0); 
            vTL = 90 + (totalGap / 2.0) * deg;
            vTR = 90 - (totalGap / 2.0) * deg;
        } else {
            vTL = Math.max(fTL, fBL + lOffTokens * deg);
            vTR = Math.min(fTR, fBR + rOffTokens * deg);
        }

        if (this.isClosedCircle) {
            vTL = 90;
            vTR = 90;
        } else {
            let vCenter = (vTL + vTR) / 2.0;
            let shift = 90 - vCenter;
            vTL += shift; vTR += shift;
            fTL += shift; fTR += shift;
            fBL += shift; fBR += shift;
        }

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
            
            this.ctx.translate(this.CX + fCenter.x * this.SCALE, this.CY - fCenter.y * this.SCALE);
            if (this.rotationAngleZ !== 0) this.ctx.rotate(this.rotationAngleZ * Math.PI / 180);
            if (this.rotationAngleY !== 0) this.ctx.scale(Math.cos(this.rotationAngleY * Math.PI / 180), 1);
            this.ctx.translate(-(this.CX + fCenter.x * this.SCALE), -(this.CY - fCenter.y * this.SCALE));
            
            if (this.isSelfLigating) {
                let rSmall = 85, cx = this.CX + fCenter.x * this.SCALE, cy = this.CY - fCenter.y * this.SCALE;
                this.ctx.beginPath(); this.ctx.strokeStyle = this.fragmentColor; this.ctx.lineWidth = 55;
                let curA = 360 * this.selfLigationProgress; this.ctx.arc(cx, cy, rSmall, (-90 - curA/2)*Math.PI/180, (-90 + curA/2)*Math.PI/180); this.ctx.stroke();
                
                if (this.selfLigationProgress > 0.0) {
                    this.ctx.globalAlpha = Math.pow(this.selfLigationProgress, 2); this.ctx.fillStyle = "#000"; this.ctx.font = "bold 22px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
                    let tT = getTokens(this.fragTop), bT = getTokens(this.fragBot), n = tT.length;
                    if (n > 0) {
                        let apT = 360.0 / n;
                        for (let i = 0; i < n; i++) {
                            let th = -90 + (i + 0.5) * apT, rad = th * Math.PI / 180;
                            let tr = rSmall + 14; this.ctx.save(); this.ctx.translate(cx + tr * Math.cos(rad), cy + tr * Math.sin(rad)); this.ctx.rotate(rad + Math.PI/2); this.ctx.fillText(tT[i], 0, 0); this.ctx.restore();
                            if (i < bT.length) { let br = rSmall - 14; this.ctx.save(); this.ctx.translate(cx + br * Math.cos(rad), cy + br * Math.sin(rad)); this.ctx.rotate(rad + Math.PI/2); this.ctx.fillText(bT[i], 0, 0); this.ctx.restore(); }
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
// 类：圆环选取器 (左侧步骤1)
// ==========================================
class CircularGeneSelector {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId); this.ctx = this.canvas.getContext('2d');
        this.sequences = ["", ""]; this.starts = [-1, -1]; this.ends = [-1, -1];
        this.degPerUnit = 8.5; 
        
        this.rOut = 215; 
        this.rIn = 165; 
        
        const interactionEvent = e => {
            e.preventDefault(); 
            const coords = getScaledCoords(this.canvas, e);
            this.handleInteraction(coords.x, coords.y);
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
        let row = -1; 
        if (dist >= 190 && dist <= 250) row = 0; 
        else if (dist >= 120 && dist < 190) row = 1;
        
        if (row !== -1) {
            let aD = Math.atan2(dx, dy) * 180 / Math.PI; if (aD < 0) aD += 360;
            let seq = this.sequences[row], n = seq.length, off = (n * this.degPerUnit) / 2.0, rel = aD + off; if (rel >= 360) rel -= 360;
            let exactIdx = rel / this.degPerUnit;
            
            let closestDash = -1, minDist = 3.0; 
            for(let i=0; i<n; i++) {
                if(seq[i] === '-') {
                    let d = Math.abs(exactIdx - i);
                    let dW1 = Math.abs(exactIdx - (i + n));
                    let dW2 = Math.abs((exactIdx + n) - i);
                    d = Math.min(d, dW1, dW2);
                    if(d < minDist) { minDist = d; closestDash = i; }
                }
            }
            if (closestDash !== -1) {
                let idx = closestDash;
                if (this.starts[row] === -1 || (this.starts[row] !== -1 && this.ends[row] !== -1)) { this.starts[row] = idx; this.ends[row] = -1; } else { this.ends[row] = idx; }
                this.paint();
            }
        }
    }
    paint() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); let cx = this.canvas.width/2, cy = this.canvas.height/2;
        this.ctx.lineWidth = 50; this.ctx.strokeStyle = "rgba(168, 230, 207, 0.4)";
        this.ctx.beginPath(); this.ctx.arc(cx, cy, this.rOut, 0, Math.PI*2); this.ctx.stroke(); this.ctx.beginPath(); this.ctx.arc(cx, cy, this.rIn, 0, Math.PI*2); this.ctx.stroke();
        this.ctx.font = "bold 26px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
        for (let row = 0; row < 2; row++) {
            let seq = this.sequences[row], r = row === 0 ? this.rOut : this.rIn, off = (seq.length * this.degPerUnit) / 2.0;
            for (let i = 0; i < seq.length; i++) {
                let deg = (i * this.degPerUnit) - off + (this.degPerUnit / 2.0), rad = (deg - 90) * Math.PI / 180, x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
                let isD = (i === this.starts[row] || i === this.ends[row]), st = Math.min(this.starts[row], this.ends[row]), ed = Math.max(this.starts[row], this.ends[row]), isS = this.ends[row] !== -1 && (i > st && i < ed);
                this.ctx.fillStyle = isS ? "red" : "black"; this.ctx.save(); this.ctx.translate(x, y); this.ctx.rotate(rad + Math.PI/2); 
                if (!isD) this.ctx.fillText(seq[i], 0, 0); 
                this.ctx.restore();
                if (isD) {
                    let lR = ((i * this.degPerUnit) - off + (this.degPerUnit / 2.0) - 90) * Math.PI / 180;
                    this.ctx.strokeStyle = "red"; this.ctx.lineWidth = 4; this.ctx.beginPath(); this.ctx.moveTo(cx + (r-25)*Math.cos(lR), cy + (r-25)*Math.sin(lR)); this.ctx.lineTo(cx + (r+25)*Math.cos(lR), cy + (r+25)*Math.sin(lR)); this.ctx.stroke();
                }
            }
        }
    }
}

// ==========================================
// 类：线性片段选取器 (左侧步骤2)
// ==========================================
class GeneSegmentSelector {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId); this.ctx = this.canvas.getContext('2d');
        this.sequences = ["", ""]; this.starts = [-1, -1]; this.ends = [-1, -1];
        
        this.unit = 22; 
        this.startX = 40; this.cy = 250; 
        
        const interactionEvent = e => {
            e.preventDefault(); 
            const coords = getScaledCoords(this.canvas, e);
            this.handleInteraction(coords.x, coords.y);
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
        let row = -1; 
        if (y >= this.cy - 50 && y < this.cy) row = 0; 
        else if (y >= this.cy && y <= this.cy + 50) row = 1;
        
        if (row !== -1) {
            let seq = this.sequences[row], n = seq.length, exactIdx = (x - this.startX) / this.unit;
            let closestDash = -1, minDist = 3.0;
            for(let i=0; i<n; i++) {
                if(seq[i] === '-') {
                    let d = Math.abs(exactIdx - i);
                    if(d < minDist) { minDist = d; closestDash = i; }
                }
            }
            if (closestDash !== -1) {
                let idx = closestDash;
                if (this.starts[row] === -1 || (this.starts[row] !== -1 && this.ends[row] !== -1)) { this.starts[row] = idx; this.ends[row] = -1; } else { this.ends[row] = idx; }
                this.paint();
            }
        }
    }
    paint() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); 
        this.ctx.font = "bold 26px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle";
        
        for (let row = 0; row < 2; row++) {
            let seq = this.sequences[row], yPos = row === 0 ? this.cy - 25 : this.cy + 25;
            this.ctx.fillStyle = "rgba(168, 230, 207, 0.5)"; 
            this.ctx.fillRect(this.startX - this.unit/2, yPos - 25, seq.length * this.unit, 50);
            for (let i = 0; i < seq.length; i++) {
                let x = this.startX + i * this.unit, isD = (i === this.starts[row] || i === this.ends[row]), st = Math.min(this.starts[row], this.ends[row]), ed = Math.max(this.starts[row], this.ends[row]), isS = this.ends[row] !== -1 && (i > st && i < ed);
                this.ctx.fillStyle = isS ? "red" : "black"; 
                if (!isD) this.ctx.fillText(seq[i], x, yPos);
                else { this.ctx.strokeStyle = "red"; this.ctx.lineWidth = 4; this.ctx.beginPath(); this.ctx.moveTo(x, yPos - 25); this.ctx.lineTo(x, yPos + 25); this.ctx.stroke(); }
            }
        }
    }
}

// ==========================================
// 控制器：MainApp 协调全局
// ==========================================
class MainApp {
    constructor() {
        this.DEFAULT_CIRC_TOP = "ATGCGTAATAGC"; 
        this.DEFAULT_CIRC_BOT = "TACGCATTATCG";
        this.DEFAULT_LIN_TOP = "GGATCCAAGCTT"; 
        this.DEFAULT_LIN_BOT = "CCTAGGTTCGAA";

        this.circTop = autoFormatATCG(this.DEFAULT_CIRC_TOP);
        this.circBot = autoFormatATCG(this.DEFAULT_CIRC_BOT);
        this.linTop = autoFormatATCG(this.DEFAULT_LIN_TOP);
        this.linBot = autoFormatATCG(this.DEFAULT_LIN_BOT);

        this.plasmidPanel = new PlasmidPanel('previewCanvas');
        this.circSelector = new CircularGeneSelector('circularCanvas');
        this.linSelector = new GeneSegmentSelector('linearCanvas');
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
        document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal-overlay').style.display = 'none');
        document.getElementById('btn-reset').addEventListener('click', () => this.resetState());
        
        document.getElementById('btn-rotate-z').addEventListener('click', () => {
            let p = this.plasmidPanel.progress, m = this.plasmidPanel.mode;
            let isAway = (m === "extract" && p > 0.8) || (m === "insert" && p < 0.2);
            if (!isAway) return this.showModal("操作无效", "⚠️ 请先将片段向上拉拽到远离载体的位置（最上方）再进行平面旋转！");
            this.plasmidPanel.startZRotationAnimation();
        });

        document.getElementById('btn-rotate-y').addEventListener('click', () => {
            let p = this.plasmidPanel.progress, m = this.plasmidPanel.mode;
            let isAway = (m === "extract" && p > 0.8) || (m === "insert" && p < 0.2);
            if (!isAway) return this.showModal("操作无效", "⚠️ 请先将片段向上拉拽到远离载体的位置（最上方）再进行水平翻转！");
            this.plasmidPanel.startYRotationAnimation();
        });

        document.getElementById('btn-reset-seq').addEventListener('click', () => {
            if (this.appStep === 1) {
                this.circTop = autoFormatATCG(this.DEFAULT_CIRC_TOP);
                this.circBot = autoFormatATCG(this.DEFAULT_CIRC_BOT);
                document.getElementById('input-top-seq').value = this.circTop;
                document.getElementById('input-bot-seq').value = this.circBot;
                this.resetState();
            } else {
                this.linTop = autoFormatATCG(this.DEFAULT_LIN_TOP);
                this.linBot = autoFormatATCG(this.DEFAULT_LIN_BOT);
                document.getElementById('input-top-seq').value = this.linTop;
                document.getElementById('input-bot-seq').value = this.linBot;
                this.updateLinearSelector();
            }
        });

        document.getElementById('btn-apply-seq').addEventListener('click', () => {
            let tVal = document.getElementById('input-top-seq').value.trim();
            let bVal = document.getElementById('input-bot-seq').value.trim();
            if(!tVal || !bVal) return alert("⚠️ 序列不能为空！");
            
            tVal = autoFormatATCG(tVal);
            bVal = autoFormatATCG(bVal);
            document.getElementById('input-top-seq').value = tVal;
            document.getElementById('input-bot-seq').value = bVal;

            if (this.appStep === 1) {
                this.circTop = tVal; this.circBot = bVal;
                this.resetState();
            } else {
                this.linTop = tVal; this.linBot = bVal;
                this.updateLinearSelector();
            }
        });

        // 绑定拼合事件
        document.getElementById('btn-ligate').addEventListener('click', () => this.executeLigation());
        document.getElementById('btn-cut').addEventListener('click', () => this.executeCut());
    }

    updateLinearSelector() {
        this.linSelector.sequences = [this.linTop, this.linBot];
        this.linSelector.reset();
    }

    resetState() {
        this.appStep = 1; 
        
        document.getElementById('input-step-label').innerText = "当前操作：载体序列";
        document.getElementById('status-text').innerText = "请在下方圆环上点击选择切割位点（红线）";
        document.getElementById('input-top-seq').value = this.circTop;
        document.getElementById('input-bot-seq').value = this.circBot;

        this.circSelector.sequences = [this.circTop, this.circBot];
        this.circSelector.reset(); 
        this.circSelector.show(); 
        this.linSelector.hide();
        
        let mid = Math.floor(this.circTop.length / 2);
        let vLT = this.circTop.substring(0, mid), vLB = this.circBot.substring(0, mid);
        let vRT = this.circTop.substring(mid), vRB = this.circBot.substring(mid);
        
        this.plasmidPanel.fragOffset = 0;
        this.plasmidPanel.isClosedCircle = true; 
        
        this.plasmidPanel.setSequences(
            "", "", 
            `${vLT}`, `${vLB}`, 
            `${vRT}`, `${vRB}`
        );
        this.plasmidPanel.setStaticState("extract", 0.0);
        
        document.getElementById('step-title').innerText = "交互操作区 - 步骤 1: 载体切割";
        this.showModal(
            "欢迎来到基因克隆仿真实验", 
            "<b>第一步：切割载体质粒</b><br><br>1. 左侧面板显示了环状的载体序列。您可以在输入框自定义序列。<br>2. 请在双链的<b>连字符(-)</b>上分别点击，选择您想切断的位置（会标记红线）。<br>3. 选好后点击【执行切割】按钮。"
        );
    }

    executeCut() {
        let activeSel = (this.appStep === 1) ? this.circSelector : this.linSelector;
        let tParts = activeSel.getRowParts(0), bParts = activeSel.getRowParts(1);
        
        if (!tParts || !bParts) {
            return this.showModal("选择不完整", "⚠️ 请先在<b>上下两条链</b>各选择两个红色的切割标识点！<br><br>注意：必须点在连字符(-)上，字母内部无法切断。");
        }

        let getSt = (sel, row) => sel.ends[row] === -1 ? sel.starts[row] : Math.min(sel.starts[row], sel.ends[row]);
        let stT = getSt(activeSel, 0);
        let stB = getSt(activeSel, 1);
        let structuralOffset = stB - stT; 

        if (this.appStep === 1) {
            let fT = tParts[1]; fT = fT ? fT + "-" : "";
            let fB = bParts[1]; fB = fB ? fB + "-" : "";
            
            this.plasmidPanel.fragOffset = structuralOffset;
            this.plasmidPanel.isClosedCircle = false; 
            
            this.plasmidPanel.setSequences(
                fT, fB, 
                `5'-${tParts[0]}-`, `3'-${bParts[0]}-`, 
                `${tParts[2]}-3'`, `${bParts[2]}-5'`
            );
            
            this.appStep = 2; 
            document.getElementById('input-step-label').innerText = "当前操作：供体片段序列";
            document.getElementById('input-top-seq').value = this.linTop;
            document.getElementById('input-bot-seq').value = this.linBot;

            this.circSelector.hide(); 
            this.updateLinearSelector();
            this.linSelector.show();
            
            document.getElementById('step-title').innerText = "交互操作区 - 步骤 2：提取目标片段";
            
            if (fT === "" && fB === "") {
                document.getElementById('status-text').innerText = "载体已被单刀切开（线性化）！";
                this.showModal("载体已被线性化", "<b>检测到单刀切割</b><br><br>载体环已经断开并暴露出粘性/平末端，但并没有多余的片段被拿掉。请继续在左侧提取您想要插入的供体基因。");
            } else {
                document.getElementById('status-text').innerText = "载体已切开！请向上拖拽拔出旧片段。";
                this.showModal("载体切割成功！", "<b>第二步：移出旧片段并提取新片段</b><br><br>1. 载体现在出现了缺口。请在右侧 3D 预览区<b>按住鼠标向上拖拽</b>，把切下来的废弃片段拔出来。<br>2. 拔出后，在左侧的直线供体序列上打上红线，提取您需要的目标基因。");
            }
        } else {
            let fT = tParts[1]; this.plasmidPanel.fragTop = fT ? fT + "-" : "";
            let fB = bParts[1]; this.plasmidPanel.fragBot = fB ? fB + "-" : "";
            this.plasmidPanel.fragOffset = structuralOffset;
            this.plasmidPanel.setStaticState("insert", 0.0);
            document.getElementById('status-text').innerText = "目标片段就绪！请向下拉拽将其嵌入。";
            this.showModal("目标基因已就绪！", "<b>第三步：重组拼合</b><br><br>1. 您提取的新片段已经悬浮在右侧质粒的上方了。<br>2. 请<b>按住鼠标向下拖拽</b>将片段降入载体缺口。<br>3. 检查末端是否贴合，然后点击【检查并拼合】完成连接！");
        }
    }

    // 【核心更新逻辑】：严格的验证判定与详尽的错误提示
    executeLigation() {
        if (this.appStep === 1) return this.showModal("流程未完成", "⚠️ 请先在左侧完成“载体切割”和“目标片段提取”流程！");
        let p = this.plasmidPanel;
        
        let isAway = (p.mode === "extract" && p.progress > 0.8) || (p.mode === "insert" && p.progress < 0.2);
        let isInside = (p.mode === "extract" && p.progress < 0.2) || (p.mode === "insert" && p.progress > 0.8);

        let lenFT = getTokens(p.fragTop).length;
        let lenFB = getTokens(p.fragBot).length;

        if (isAway) {
            // 场景 1：片段在最上方，检查载体自己能否闭合（自环化）
            let vTopClean = cleanSeq(p.vecLTop) + cleanSeq(p.vecRTop);
            let vBotClean = cleanSeq(p.vecLBot) + cleanSeq(p.vecRBot);

            if (isComplementary(vTopClean, vBotClean)) {
                p.startSelfLigationAnimation();
                this.showModal(
                    "⚠️ 发生载体自连！", 
                    "<b>载体由于末端互补，自己闭合了环！</b><br><br>载体两端的粘性或平末端由于碱基完美配对，在连接酶作用下重新接合在了一起。拔出的片段由于无处可去，也可能首尾相连形成游离环。<br><br>💡 <b>真实实验贴士：</b>为了防止载体自连产生假阳性，通常我们会对切开的载体进行<b>去磷酸化处理（CIP/SAP）</b>，或采用<b>不相容的双酶切策略</b>。"
                );
            } else {
                this.showModal(
                    "💡 无法自连 (这是好事)", 
                    "<b>载体末端碱基不互补，无法自行闭合！</b><br><br>这是非常棒的实验设计！您创造的不相容粘性末端成功地阻止了载体自连。现在请提取您的目标基因进行插入吧。"
                );
            }
        } else if (isInside) {
            // 场景 2：片段被拉进缺口内部，检查重组

            // 规则 A：空片段检查
            if (lenFT === 0 && lenFB === 0) {
                return this.showModal(
                    "❌ 拼合失败：片段为空",
                    "<b>未检测到目标片段插入！</b><br><br>您尝试嵌入的片段序列为空。请返回第二步（左侧面板），确保从供体序列中正确框选并切出了实际的碱基序列。"
                );
            }

            // 规则 B：物理形状干涉检查
            let lOffTokens = getTokens(p.vecLBot).length - getTokens(p.vecLTop).length;
            let rOffTokens = getTokens(p.vecRTop).length - getTokens(p.vecRBot).length;
            let fitsPhysically = (p.fragOffset === lOffTokens) && ((p.fragOffset + lenFB - lenFT) === rOffTokens);

            // 规则 C：碱基序列严格互补检查
            let fullTop = cleanSeq(p.vecLTop) + cleanSeq(p.fragTop) + cleanSeq(p.vecRTop);
            let fullBot = cleanSeq(p.vecLBot) + cleanSeq(p.fragBot) + cleanSeq(p.vecRBot);
            let isComp = isComplementary(fullTop, fullBot);

            if (fitsPhysically && isComp) {
                p.setStaticState(p.mode === "insert" ? "insert" : "extract", p.mode === "insert" ? 1.0 : 0.0);
                this.showModal(
                    "🎉 重组质粒构建成功！", 
                    "<b>恭喜！新基因已完美整合进载体中。</b><br><br>插入片段不仅物理外形与载体缺口契合，且接缝处的碱基（A-T, C-G）也满足了严格的互补配对原则。<br><br>在连接酶（Ligase）的帮助下，糖磷酸骨架已被修复。您顺利完成了一次完美的基因克隆！", 
                    "完成实验"
                );
            } else if (!fitsPhysically) {
                this.showModal(
                    "❌ 拼合失败：末端形状干涉",
                    "<b>发生了物理形状干涉！</b><br><br>插入片段的粘性末端形状（5'突出还是3'突出，以及突出的长度）与载体留下的缺口完全不一致。<br><br>💡 <b>建议：</b>尝试点击右侧面板的【🔄 旋转】或【↔️ 翻转】按钮调整片段方向，或者重置实验重新切出匹配的末端。"
                );
            } else {
                this.showModal(
                    "❌ 拼合失败：碱基不互补",
                    "<b>形状贴合，但碱基配对引发排斥！</b><br><br>虽然片段的末端长度刚好能塞进缺口，但连接处的具体序列无法遵循 A-T、C-G 的互补配对原则。<br><br>💡 <b>建议：</b>尝试使用【旋转/翻转】来调换两端，或者检查您最初的切割位点是否设计有误。"
                );
            }
        } else {
            this.showModal(
                "⚠️ 位置不正确",
                "请在右侧 3D 预览区将片段<b>彻底拖拽到最上方</b>（检查是否会发生载体自环），或者<b>完全拉入缺口中心</b>（检查是否能完成基因重组），然后再点击此按钮。"
            );
        }
    }
}
window.onload = () => new MainApp();