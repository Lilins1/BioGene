// ==========================================
// 辅助工具函数 (智能排版与解析引擎)
// ==========================================
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

function isComplementary(top, bot) {
    if (!top || !bot || top.length !== bot.length || top.length === 0) return false;
    for (let i = 0; i < top.length; i++) {
        let t = top[i].toUpperCase();
        let b = bot[i].toUpperCase();
        
        let isTStandard = ['A','T','C','G'].includes(t);
        let isBStandard = ['A','T','C','G'].includes(b);
        
        if (isTStandard && isBStandard) {
            let pair = t + b;
            if (!['AT','TA','CG','GC'].includes(pair)) return false;
        } else {
            if (t !== b) return false;
        }
    }
    return true;
}

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
// 类：3D 形变渲染区 (带方向指针系统)
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
        this.insertDistance = 0.85; 
        
        this.rotationAngleZ = 0.0; 
        this.isRotating = false;
        this.isSelfLigating = false;
        this.selfLigationProgress = 0.0;
        
        this.isClosedCircle = true; 
        this.fragTop = ""; this.fragBot = "";
        this.vecLTop = ""; this.vecLBot = "";
        this.vecRTop = ""; this.vecRBot = "";
        this.fragOffset = 0; 
        this.fragDirection = 1; 
        this.geneLabel = ""; 
        
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
                this.fragDirection *= -1; 

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
            vTL = 90; vTR = 90;
        } else {
            let vCenter = (vTL + vTR) / 2.0;
            let shift = 90 - vCenter;
            vTL += shift; vTR += shift; fTL += shift; fTR += shift; fBL += shift; fBR += shift;
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
        
        let vR_arr = rInT - 0.15; 
        this.ctx.beginPath();
        for(let a=260; a>=190; a-=2) {
            let p = this.morphPoint(vR_arr, a, 0, 0, rMid);
            let px = this.CX + p.x*this.SCALE, py = this.CY - p.y*this.SCALE;
            if(a===260) this.ctx.moveTo(px, py); else this.ctx.lineTo(px, py);
        }
        this.ctx.strokeStyle = "rgba(46, 204, 113, 0.8)";
        this.ctx.lineWidth = 4;
        this.ctx.stroke();
        let pVE = this.morphPoint(vR_arr, 190, 0, 0, rMid);
        let pVP = this.morphPoint(vR_arr, 192, 0, 0, rMid);
        let exV = this.CX + pVE.x*this.SCALE, eyV = this.CY - pVE.y*this.SCALE;
        let px2V = this.CX + pVP.x*this.SCALE, py2V = this.CY - pVP.y*this.SCALE;
        let angleV = Math.atan2(eyV - py2V, exV - px2V);
        this.ctx.beginPath();
        this.ctx.moveTo(exV, eyV);
        this.ctx.lineTo(exV - 12*Math.cos(angleV - Math.PI/6), eyV - 12*Math.sin(angleV - Math.PI/6));
        this.ctx.moveTo(exV, eyV);
        this.ctx.lineTo(exV - 12*Math.cos(angleV + Math.PI/6), eyV - 12*Math.sin(angleV + Math.PI/6));
        this.ctx.stroke();

        this.drawMorphedText(this.vecLTop, rOutT, vL, -1, "end", 0, 0, rMid);
        this.drawMorphedText(this.vecLBot, rInT, vL_bot, -1, "end", 0, 0, rMid);
        this.drawMorphedText(this.vecRTop, rOutT, vR_text, -1, "start", 0, 0, rMid);
        this.drawMorphedText(this.vecRBot, rInT, vR_bot, -1, "start", 0, 0, rMid);

        if (lenFT > 0 || lenFB > 0) {
            this.ctx.save();
            let fCenter = this.morphPoint(rMid - w/2, 90, tMorph, currentDist, rMid);
            
            this.ctx.translate(this.CX + fCenter.x * this.SCALE, this.CY - fCenter.y * this.SCALE);
            if (this.rotationAngleZ !== 0) this.ctx.rotate(this.rotationAngleZ * Math.PI / 180);
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
                
                let arrR = rOutE + 0.15;
                let arrowSpan = fTR - fTL; 
                let midA = (fTL + fTR) / 2.0;
                let arrTL = midA - arrowSpan / 4.0; 
                let arrTR = midA + arrowSpan / 4.0; 

                this.ctx.beginPath();
                let stepsArr = 20, stepA = (arrTR - arrTL) / stepsArr;
                for(let i=0; i<=stepsArr; i++) {
                    let p = this.morphPoint(arrR, arrTL + i*stepA, tMorph, currentDist, rMid);
                    let px = this.CX + p.x*this.SCALE, py = this.CY - p.y*this.SCALE;
                    if(i===0) this.ctx.moveTo(px, py); else this.ctx.lineTo(px, py);
                }
                this.ctx.strokeStyle = "#e67e22"; this.ctx.lineWidth = 3; this.ctx.stroke();
                
                let headAng = this.fragDirection === 1 ? arrTR : arrTL;
                let preAng = this.fragDirection === 1 ? arrTR + 1.0 : arrTL - 1.0;
                let pE = this.morphPoint(arrR, headAng, tMorph, currentDist, rMid);
                let pP = this.morphPoint(arrR, preAng, tMorph, currentDist, rMid);
                let ex = this.CX + pE.x*this.SCALE, ey = this.CY - pE.y*this.SCALE;
                let px2 = this.CX + pP.x*this.SCALE, py2 = this.CY - pP.y*this.SCALE;
                let angle = Math.atan2(ey - py2, ex - px2);
                this.ctx.beginPath();
                this.ctx.moveTo(ex, ey);
                this.ctx.lineTo(ex - 6*Math.cos(angle - Math.PI/6), ey - 6*Math.sin(angle - Math.PI/6)); 
                this.ctx.moveTo(ex, ey);
                this.ctx.lineTo(ex - 6*Math.cos(angle + Math.PI/6), ey - 6*Math.sin(angle + Math.PI/6));
                this.ctx.stroke();

                if (this.geneLabel) {
                    let textP = this.morphPoint(arrR + 0.12, 90, tMorph, currentDist, rMid);
                    this.ctx.save();
                    this.ctx.translate(this.CX + textP.x * this.SCALE, this.CY - textP.y * this.SCALE);
                    this.ctx.fillStyle = "#e67e22";
                    // 【修改项】：字体放大至 24px
                    this.ctx.font = "bold 24px Arial";
                    this.ctx.fillText(this.geneLabel, 0, 0);
                    this.ctx.restore();
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
        this.canvas = document.getElementById(canvasId); 
        this.ctx = this.canvas.getContext('2d');
        this.sequences = ["", ""]; 
        this.starts = [-1, -1]; 
        this.ends = [-1, -1];
        
        this.unit = 22; 
        this.startX = 40; 
        this.cy = 250; 
        this.geneLabel = ""; 
        
        const interactionEvent = e => {
            e.preventDefault(); 
            const coords = getScaledCoords(this.canvas, e);
            this.handleInteraction(coords.x, coords.y);
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
        let row = -1; 
        if (y >= this.cy - 60 && y < this.cy) row = 0; 
        else if (y >= this.cy && y <= this.cy + 60) row = 1;
        
        if (row !== -1) {
            let seq = this.sequences[row], n = seq.length;
            let exactIdx = (x - this.startX) / this.unit;
            
            let closestDash = -1, minDist = 4.0; 
            for(let i=0; i<n; i++) {
                if(seq[i] === '-') {
                    let d = Math.abs(exactIdx - i);
                    if(d < minDist) { minDist = d; closestDash = i; }
                }
            }
            if (closestDash !== -1) {
                let idx = closestDash;
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
        let maxLen = Math.max(this.sequences[0].length, this.sequences[1].length, 1);

        this.unit = Math.max(12, Math.min(35, (this.canvas.width - 40) / maxLen));
        this.startX = (this.canvas.width - (maxLen - 1) * this.unit) / 2;

        let fontSize = this.unit < 18 ? 18 : 26;
        this.ctx.font = `bold ${fontSize}px Arial`; 
        this.ctx.textAlign = "center"; 
        this.ctx.textBaseline = "middle";
        
        for (let row = 0; row < 2; row++) {
            let seq = this.sequences[row], yPos = row === 0 ? this.cy - 30 : this.cy + 30;
            
            this.ctx.fillStyle = "rgba(168, 230, 207, 0.5)"; 
            let rectW = (seq.length > 0) ? (seq.length - 1) * this.unit + fontSize : 0;
            this.ctx.fillRect(this.startX - fontSize/2, yPos - 30, rectW, 60);

            for (let i = 0; i < seq.length; i++) {
                let x = this.startX + i * this.unit;
                let isD = (i === this.starts[row] || i === this.ends[row]);
                let st = Math.min(this.starts[row], this.ends[row]);
                let ed = Math.max(this.starts[row], this.ends[row]);
                let isS = this.ends[row] !== -1 && (i > st && i < ed);
                
                this.ctx.fillStyle = isS ? "red" : "black"; 
                if (!isD) {
                    this.ctx.fillText(seq[i], x, yPos);
                } else { 
                    this.ctx.strokeStyle = "red"; 
                    this.ctx.lineWidth = 4; 
                    this.ctx.beginPath(); 
                    this.ctx.moveTo(x, yPos - 30); 
                    this.ctx.lineTo(x, yPos + 30); 
                    this.ctx.stroke(); 
                }
            }
        }

        let seqTop = this.sequences[0];
        if (seqTop.length > 0) {
            let arrY = this.cy - 75;
            let aStartX = this.startX;
            let aEndX = this.startX + (seqTop.length - 1) * this.unit;
            
            let midX = (aStartX + aEndX) / 2;
            let halfSpan = (aEndX - aStartX) / 4; 
            let arrStartX = midX - halfSpan;
            let arrEndX = midX + halfSpan;

            this.ctx.beginPath();
            this.ctx.moveTo(arrStartX, arrY);
            this.ctx.lineTo(arrEndX, arrY);
            this.ctx.lineTo(arrEndX - 6, arrY - 4); 
            this.ctx.moveTo(arrEndX, arrY);
            this.ctx.lineTo(arrEndX - 6, arrY + 4);
            this.ctx.strokeStyle = "#e67e22"; 
            this.ctx.lineWidth = 3; 
            this.ctx.stroke();

            if (this.geneLabel) {
                this.ctx.fillStyle = "#e67e22";
                // 【修改项】：字体放大至 24px 并稍微上移以避开箭头
                this.ctx.font = "bold 24px Arial";
                this.ctx.fillText(this.geneLabel, midX, arrY - 20);
            }
        }
    }
}

// ==========================================
// 控制器：MainApp 协调全局
// ==========================================
class MainApp {
    constructor() {
        this.currentMode = "act1a"; 

        this.ACT1A_CIRC_TOP = "G-G-A-T-C-C";
        this.ACT1A_CIRC_BOT = "C-C-T-A-G-G";
        this.ACT1A_LIN_TOP = "A-A-G-C-T-T...A-A-G-C-T-T";
        this.ACT1A_LIN_BOT = "T-T-C-G-A-A...T-T-C-G-A-A";

        this.ACT1B_CIRC_TOP = "G-G-A-T-C-C";
        this.ACT1B_CIRC_BOT = "C-C-T-A-G-G";
        this.ACT1B_LIN_TOP = "-G-G-A-T-C-C...G-G-A-T-C-C-";
        this.ACT1B_LIN_BOT = "-C-C-T-A-G-G...C-C-T-A-G-G-";

        this.ACT2_CIRC_TOP = "GGATCC...AAGCTT";
        this.ACT2_CIRC_BOT = "CCTAGG...TTCGAA";
        this.ACT2_LIN_TOP = "GGATCC...AAGCTT";
        this.ACT2_LIN_BOT = "CCTAGG...TTCGAA";

        this.circTop = ""; this.circBot = "";
        this.linTop = ""; this.linBot = "";
        this.geneLabel = ""; 

        this.plasmidPanel = new PlasmidPanel('previewCanvas');
        this.circSelector = new CircularGeneSelector('circularCanvas');
        this.linSelector = new GeneSegmentSelector('linearCanvas');
        
        this.bindEvents(); 
        this.loadModeData(); 
    }

    showModal(title, body, btnText = "我知道了") {
        const overlay = document.getElementById('modal-overlay');
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = body;
        document.getElementById('modal-close').innerText = btnText;
        overlay.style.display = 'flex';
    }

    loadModeData() {
        if (this.currentMode === "act1a") {
            this.circTop = autoFormatATCG(this.ACT1A_CIRC_TOP); this.circBot = autoFormatATCG(this.ACT1A_CIRC_BOT);
            this.linTop = autoFormatATCG(this.ACT1A_LIN_TOP); this.linBot = autoFormatATCG(this.ACT1A_LIN_BOT);
            this.geneLabel = "含基因A的DNA片段";
            document.getElementById('mode-badge').innerText = "当前模式: 活动1.a";
            document.getElementById('mode-badge').style.backgroundColor = "#27ae60";
        } else if (this.currentMode === "act1b") {
            this.circTop = autoFormatATCG(this.ACT1B_CIRC_TOP); this.circBot = autoFormatATCG(this.ACT1B_CIRC_BOT);
            this.linTop = autoFormatATCG(this.ACT1B_LIN_TOP); this.linBot = autoFormatATCG(this.ACT1B_LIN_BOT);
            this.geneLabel = "含基因B的DNA片段";
            document.getElementById('mode-badge').innerText = "当前模式: 活动1.b";
            document.getElementById('mode-badge').style.backgroundColor = "#27ae60";
        } else if (this.currentMode === "act2") {
            this.circTop = autoFormatATCG(this.ACT2_CIRC_TOP); this.circBot = autoFormatATCG(this.ACT2_CIRC_BOT);
            this.linTop = autoFormatATCG(this.ACT2_LIN_TOP); this.linBot = autoFormatATCG(this.ACT2_LIN_BOT);
            this.geneLabel = "含基因B的DNA片段";
            document.getElementById('mode-badge').innerText = "当前模式: 活动2";
            document.getElementById('mode-badge').style.backgroundColor = "#27ae60";
        } else {
            this.geneLabel = "自定义基因";
            document.getElementById('mode-badge').innerText = "当前模式: 自定义";
            document.getElementById('mode-badge').style.backgroundColor = "#e67e22";
        }
        
        this.linSelector.geneLabel = this.geneLabel;
        this.resetState();
    }

    bindEvents() {
        document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal-overlay').style.display = 'none');
        document.getElementById('btn-reset').addEventListener('click', () => this.loadModeData());
        
        document.getElementById('btn-rotate-z').addEventListener('click', () => {
            let p = this.plasmidPanel.progress, m = this.plasmidPanel.mode;
            let isAway = (m === "extract" && p > 0.8) || (m === "insert" && p < 0.2);
            if (!isAway) return this.showModal("提示", "请确保待插入片段在远离载体的位置（最上方）再进行平面旋转。");
            this.plasmidPanel.startZRotationAnimation();
        });

        document.getElementById('btn-act1a').addEventListener('click', () => {
            this.currentMode = "act1a";
            this.loadModeData();
        });

        document.getElementById('btn-act1b').addEventListener('click', () => {
            this.currentMode = "act1b";
            this.loadModeData();
        });

        document.getElementById('btn-act2').addEventListener('click', () => {
            this.currentMode = "act2";
            this.loadModeData();
        });

        document.getElementById('btn-reset-seq').addEventListener('click', () => {
            this.loadModeData(); 
        });

        document.getElementById('btn-apply-seq').addEventListener('click', () => {
            let tVal = document.getElementById('input-top-seq').value.trim();
            let bVal = document.getElementById('input-bot-seq').value.trim();
            if(!tVal || !bVal) return alert("⚠️ 序列不能为空！");
            
            tVal = autoFormatATCG(tVal); 
            bVal = autoFormatATCG(bVal);
            document.getElementById('input-top-seq').value = tVal; 
            document.getElementById('input-bot-seq').value = bVal;

            this.currentMode = "custom"; 
            this.geneLabel = "自定义基因";
            document.getElementById('mode-badge').innerText = "当前模式: 自定义";
            document.getElementById('mode-badge').style.backgroundColor = "#e67e22";
            
            this.linSelector.geneLabel = this.geneLabel;

            if (this.appStep === 1) { 
                this.circTop = tVal; 
                this.circBot = bVal; 
                this.resetState(); 
            } else { 
                this.linTop = tVal; 
                this.linBot = bVal; 
                this.updateLinearSelector(); 
            }
        });

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
        document.getElementById('status-text').innerText = "请在下方圆环上点击连字符(-)选择切割位点";
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
        this.plasmidPanel.fragDirection = 1; 
        this.plasmidPanel.isClosedCircle = true; 
        this.plasmidPanel.geneLabel = ""; 
        
        this.plasmidPanel.setSequences("", "", `${vLT}`, `${vLB}`, `${vRT}`, `${vRB}`);
        this.plasmidPanel.setStaticState("extract", 0.0);
        
        document.getElementById('step-title').innerText = "交互操作区 - 步骤 1: 载体切割";
        this.showModal("提示", "请在连字符(-)位置点击打上红线，选定你要抛弃的序列，最后执行切割。");
    }

    executeCut() {
        let activeSel = (this.appStep === 1) ? this.circSelector : this.linSelector;
        let tParts = activeSel.getRowParts(0), bParts = activeSel.getRowParts(1);
        
        if (!tParts || !bParts) return this.showModal("提示", "请在上下两条链各点击出两个切割红线！");

        let getSt = (sel, row) => sel.ends[row] === -1 ? sel.starts[row] : Math.min(sel.starts[row], sel.ends[row]);
        let stT = getSt(activeSel, 0), stB = getSt(activeSel, 1);
        let structuralOffset = stB - stT; 

        if (this.appStep === 1) {
            let fT = tParts[1]; 
            let fB = bParts[1]; 
            
            this.plasmidPanel.fragOffset = structuralOffset;
            this.plasmidPanel.isClosedCircle = false; 
            this.plasmidPanel.fragDirection = 1; 
            this.plasmidPanel.geneLabel = ""; 
            
            this.plasmidPanel.setSequences("", "", `5'-${tParts[0]}-`, `3'-${bParts[0]}-`, `${tParts[2]}-3'`, `${bParts[2]}-5'`);
            this.plasmidPanel.setStaticState("insert", 0.0); 

            this.appStep = 2; 
            document.getElementById('input-step-label').innerText = "当前操作：供体片段序列";
            document.getElementById('input-top-seq').value = this.linTop;
            document.getElementById('input-bot-seq').value = this.linBot;

            this.circSelector.hide(); 
            this.updateLinearSelector();
            this.linSelector.show();
            
            document.getElementById('step-title').innerText = "交互操作区 - 步骤 2：切割目的基因";
            
            if (fT === "" && fB === "") {
                document.getElementById('status-text').innerText = "载体已被单刀切断！";
                this.showModal("提示", "载体已被单刀切开（线性化）。请继续在左侧提取您想要插入的新基因。");
            } else {
                document.getElementById('status-text').innerText = "载体已切开，废弃片段已移除！";
                this.showModal("提示", "载体已切开，抛弃的片段已被自动移除。请继续在左侧提取新基因。");
            }
        } else {
            let fT = tParts[1]; this.plasmidPanel.fragTop = fT ? fT + "-" : "";
            let fB = bParts[1]; this.plasmidPanel.fragBot = fB ? fB + "-" : "";
            this.plasmidPanel.fragOffset = structuralOffset;
            this.plasmidPanel.fragDirection = 1;
            this.plasmidPanel.geneLabel = this.geneLabel; 
            this.plasmidPanel.setStaticState("insert", 0.0);
            document.getElementById('status-text').innerText = "目标片段就绪！请向下拉拽将其嵌入。";
            this.showModal("提示", "新片段已就绪。请向下拖拽嵌入载体，并点击【拼合】按钮进行检查。");
        }
    }

    executeLigation() {
        if (this.appStep === 1) return this.showModal("提示", "请先完成剪切与提取流程！");
        let p = this.plasmidPanel;
        
        let isAway = (p.mode === "extract" && p.progress > 0.8) || (p.mode === "insert" && p.progress < 0.2);
        let isInside = (p.mode === "extract" && p.progress < 0.2) || (p.mode === "insert" && p.progress > 0.8);

        let lenFT = getTokens(p.fragTop).length, lenFB = getTokens(p.fragBot).length;

        if (isAway) {
            let vTopClean = cleanSeq(p.vecLTop) + cleanSeq(p.vecRTop);
            let vBotClean = cleanSeq(p.vecLBot) + cleanSeq(p.vecRBot);

            if (isComplementary(vTopClean, vBotClean)) {
                p.startSelfLigationAnimation();
                this.showModal("发现自连", "载体末端碱基互补，自己闭合成环了。");
            } else {
                this.showModal("提示", "载体末端不匹配，无法自连。请向下拖拽插入目标片段。");
            }
        } else if (isInside) {
            if (lenFT === 0 && lenFB === 0) return this.showModal("提示", "未检测到插入片段，拼合失败！");

            let lOffTokens = getTokens(p.vecLBot).length - getTokens(p.vecLTop).length;
            let rOffTokens = getTokens(p.vecRTop).length - getTokens(p.vecRBot).length;
            let fitsPhysically = (p.fragOffset === lOffTokens) && ((p.fragOffset + lenFB - lenFT) === rOffTokens);

            let fullTop = cleanSeq(p.vecLTop) + cleanSeq(p.fragTop) + cleanSeq(p.vecRTop);
            let fullBot = cleanSeq(p.vecLBot) + cleanSeq(p.fragBot) + cleanSeq(p.vecRBot);
            let isComp = isComplementary(fullTop, fullBot);

            if (fitsPhysically && isComp) {
                p.setStaticState(p.mode === "insert" ? "insert" : "extract", p.mode === "insert" ? 1.0 : 0.0);
                
                if (p.fragDirection === 1) {
                    this.showModal("🎉 拼接成功", "新片段完美整合进载体中，方向正确，连接成功！");
                } else {
                    this.showModal("⚠️ 拼接成功但方向反转", "切口与碱基均已正确配对，片段成功连入载体！<br><br><b>注意：</b>因为基因序列被颠倒，读取方向（箭头）与载体启动子方向不一致。这在物理上可以连接，但在生物学上<b>无法正常表达靶蛋白</b>！");
                }
            } else if (!fitsPhysically) {
                this.showModal("❌ 拼接失败：形状干涉", "插入片段的末端形状与载体缺口不一致，发生了物理干涉！");
            } else {
                this.showModal("❌ 拼接失败：碱基不互补", "插入的碱基序列无法进行互补配对！");
            }
        } else {
            this.showModal("提示", "请将片段彻底拖拽到最上方或完全拉入缺口内再进行拼合。");
        }
    }
}
window.onload = () => new MainApp();