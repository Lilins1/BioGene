/**
 * 基因克隆全流程仿真系统 - 精度增强版
 * 修复：内外环衔接间隙、强制连字符间隔
 */

// ==========================================
// 1. 增强型辅助工具函数
// ==========================================

// 将普通字符串转化为带 '-' 的规范格式
function formatSeq(seq) {
    if (!seq) return "";
    // 移除已有横杠后重新组合，确保每个碱基间仅有一个横杠
    let clean = seq.replace(/-/g, "").split("");
    return clean.join("-");
}

// 提取序列中的碱基标记（支持 5', 3' 和单个碱基或横杠）
function getTokens(text) {
    if (!text) return [];
    // 匹配 5', 3' 或单个字母/符号
    return text.match(/5'|3'|[-]|[A-Z]/g) || [];
}

// 清除所有格式化符号，仅保留碱基用于逻辑判断
function cleanForLogic(seq) {
    return seq.replace(/[^ATCG]/g, "");
}

// 互补配对检查
function isComplementary(top, bot) {
    let t = cleanForLogic(top);
    let b = cleanForLogic(bot);
    if (t.length !== b.length || t.length === 0) return false;
    for (let i = 0; i < t.length; i++) {
        let tc = t[i], bc = b[i];
        if (!((tc==='A'&&bc==='T')||(tc==='T'&&bc==='A')||(tc==='C'&&bc==='G')||(tc==='G'&&bc==='C'))) return false;
    }
    return true;
}

// ==========================================
// 2. PlasmidPanel (3D 形变渲染核心)
// ==========================================
class PlasmidPanel {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.vectorColor = "rgba(168, 230, 207, 1.0)"; // 提高不透明度
        this.fragmentColor = "rgba(255, 180, 130, 1.0)";
        this.degPerToken = 3.0; // 调小间距使序列更紧凑
        this.centerTheta = 90.0;
        this.SCALE = 220.0;
        this.CX = 400; this.CY = 400;

        this.mode = "extract";
        this.progress = 0.0;
        this.extractDistance = 0.55;
        this.insertDistance = 0.55;
        
        this.rotationAngle = 0.0;
        this.isRotating = false;
        this.isSelfLigating = false;
        this.selfLigationProgress = 0.0;

        this.fragTop = ""; this.fragBot = "";
        this.vecLTop = ""; this.vecLBot = "";
        this.vecRTop = ""; this.vecRBot = "";

        this.setupInteractions();
    }

    setupInteractions() {
        let isDown = false, lastY = 0;
        this.canvas.addEventListener('mousedown', e => { isDown = true; lastY = e.clientY; });
        window.addEventListener('mouseup', () => isDown = false);
        this.canvas.addEventListener('mousemove', e => {
            if (!isDown || this.isRotating || this.isSelfLigating) return;
            let delta = (e.clientY - lastY) / 300.0;
            this.progress += (this.mode === "extract") ? -delta : delta;
            this.progress = Math.max(0.0, Math.min(1.0, this.progress));
            lastY = e.clientY;
            this.paint();
        });
    }

    // 映射极坐标到形变坐标
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

    // 绘制形变色块（核心：闭合路径消除间隙）
    drawMorphedLayer(r1, r2, theta1, theta2, color, t, dist, rRef) {
        this.ctx.beginPath();
        this.ctx.fillStyle = color;
        this.ctx.lineJoin = 'round'; // 圆润衔接

        const steps = 60; // 增加步长提高圆滑度
        const stepSize = (theta2 - theta1) / steps;
        
        // 外沿
        for (let i = 0; i <= steps; i++) {
            let p = this.morphPoint(r2, theta1 + i * stepSize, t, dist, rRef);
            if (i === 0) this.ctx.moveTo(this.CX + p.x * this.SCALE, this.CY - p.y * this.SCALE);
            else this.ctx.lineTo(this.CX + p.x * this.SCALE, this.CY - p.y * this.SCALE);
        }
        // 内沿
        for (let i = steps; i >= 0; i--) {
            let p = this.morphPoint(r1, theta1 + i * stepSize, t, dist, rRef);
            this.ctx.lineTo(this.CX + p.x * this.SCALE, this.CY - p.y * this.SCALE);
        }
        this.ctx.closePath();
        this.ctx.fill();
        // 描边以彻底掩盖微小缝隙
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 0.5;
        this.ctx.stroke();
    }

    drawMorphedText(text, radius, edgeAngle, alignDir, anchor, t, dist, rRef) {
        if (!text) return;
        const tokens = getTokens(text);
        const n = tokens.length;
        const offset = this.degPerToken / 2.0;
        let startTh = anchor === "start" ? edgeAngle + offset*alignDir : edgeAngle - (n-1)*this.degPerToken*alignDir - offset*alignDir;

        this.ctx.fillStyle = "#000";
        this.ctx.font = "bold 14px 'Segoe UI', Arial";
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

    setSequences(fT, fB, vLT, vLB, vRT, vRB) {
        this.fragTop = fT; this.fragBot = fB;
        this.vecLTop = vLT; this.vecLBot = vLB;
        this.vecRTop = vRT; this.vecRBot = vRB;
        this.paint();
    }

    setStaticState(mode, progress) {
        this.mode = mode; this.progress = progress; this.isSelfLigating = false;
        this.paint();
    }

    startRotationAnimation(onComplete) {
        if (this.isRotating || this.isSelfLigating) return;
        this.isRotating = true;
        let start = performance.now();
        const animate = (time) => {
            let p = (time - start) / 600.0;
            if (p >= 1.0) {
                this.isRotating = false; this.rotationAngle = 0;
                let nT = getTokens(this.fragBot).reverse().join('');
                let nB = getTokens(this.fragTop).reverse().join('');
                this.fragTop = nT; this.fragBot = nB;
                if(onComplete) onComplete(nT, nB);
                this.paint();
            } else {
                this.rotationAngle = p * 180; this.paint();
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

    startSelfLigationAnimation() {
        this.isSelfLigating = true;
        this.selfLigationProgress = 0;
        let start = performance.now();
        const animate = (time) => {
            let p = (time - start) / 800.0;
            if (p >= 1.0) { this.selfLigationProgress = 1.0; this.paint(); }
            else { this.selfLigationProgress = p; this.paint(); requestAnimationFrame(animate); }
        };
        requestAnimationFrame(animate);
    }

    paint() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "#fafafa";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        let rOutE = 1.0, w = 0.16, rMid = rOutE - w;
        let rOutT = rOutE - w/2, rInT = rMid - w/2;

        let spanOuter = getTokens(this.fragTop).length * this.degPerToken;
        let cLOut = this.centerTheta + spanOuter / 2.0;
        let cROut = this.centerTheta - spanOuter / 2.0;
        let lOff = (getTokens(this.vecLBot).length - getTokens(this.vecLTop).length) * this.degPerToken;
        let rOff = (getTokens(this.vecRTop).length - getTokens(this.vecRBot).length) * this.degPerToken;

        let pSmooth = this.progress * this.progress * (3 - 2 * this.progress);
        let tMorph = this.mode === "extract" ? pSmooth : 1.0 - pSmooth;
        let dist = this.mode === "extract" ? this.extractDistance * pSmooth : this.insertDistance * (1.0 - pSmooth);

        let vL = cLOut, vR_text = cROut;
        if (this.isSelfLigating) {
            vL = cLOut - (spanOuter / 2.0) * this.selfLigationProgress;
            vR_text = cROut + (spanOuter / 2.0) * this.selfLigationProgress;
        }

        // 1. 载体主体（闭环或开环）
        let vR = 360 + vR_text; 
        this.drawMorphedLayer(rMid, rOutE, vL, vR, this.vectorColor, 0, 0, rMid);
        this.drawMorphedLayer(rMid-w, rMid, vL - lOff, vR - rOff, this.vectorColor, 0, 0, rMid);

        this.drawMorphedText(this.vecLTop, rOutT, vL, -1, "end", 0, 0, rMid);
        this.drawMorphedText(this.vecLBot, rInT, vL - lOff, -1, "end", 0, 0, rMid);
        this.drawMorphedText(this.vecRTop, rOutT, vR_text, -1, "start", 0, 0, rMid);
        this.drawMorphedText(this.vecRBot, rInT, vR_text - rOff, -1, "start", 0, 0, rMid);

        // 2. 目标片段
        if (getTokens(this.fragTop).length > 0) {
            this.ctx.save();
            let fCenter = this.morphPoint(rMid - w/2, this.centerTheta, tMorph, dist, rMid);
            if (this.rotationAngle !== 0) {
                this.ctx.translate(this.CX + fCenter.x * this.SCALE, this.CY - fCenter.y * this.SCALE);
                this.ctx.rotate(this.rotationAngle * Math.PI / 180);
                this.ctx.translate(-(this.CX + fCenter.x * this.SCALE), -(this.CY - fCenter.y * this.SCALE));
            }

            if (this.isSelfLigating) {
                let rSmall = 45;
                let cx = this.CX + fCenter.x * this.SCALE, cy = this.CY - fCenter.y * this.SCALE;
                this.ctx.beginPath();
                this.ctx.strokeStyle = this.fragmentColor;
                this.ctx.lineWidth = 36;
                let angle = 360 * this.selfLigationProgress;
                this.ctx.arc(cx, cy, rSmall, (-90 - angle/2)*Math.PI/180, (-90 + angle/2)*Math.PI/180);
                this.ctx.stroke();
            } else {
                this.drawMorphedLayer(rMid, rOutE, cROut, cLOut, this.fragmentColor, tMorph, dist, rMid);
                this.drawMorphedLayer(rMid-w, rMid, cROut - rOff, cLOut - lOff, this.fragmentColor, tMorph, dist, rMid);
                this.drawMorphedText(this.fragTop, rOutT, cLOut, -1, "start", tMorph, dist, rMid);
                this.drawMorphedText(this.fragBot, rInT, cLOut - lOff, -1, "start", tMorph, dist, rMid);
            }
            this.ctx.restore();
        }
    }
}

// ==========================================
// 3. CircularGeneSelector (步骤1)
// ==========================================
class CircularGeneSelector {
    constructor(canvasId, topSeq, botSeq) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.sequences = [topSeq, botSeq];
        this.starts = [-1, -1]; this.ends = [-1, -1];
        this.degPerUnit = 5.2; this.rOut = 180; this.rIn = 140;
        this.canvas.addEventListener('mousedown', e => this.handleInteraction(e));
    }

    reset() { this.starts = [-1, -1]; this.ends = [-1, -1]; this.paint(); }
    show() { this.canvas.style.display = 'block'; this.paint(); }
    hide() { this.canvas.style.display = 'none'; }

    getRowParts(row) {
        if (this.starts[row] === -1) return null;
        let s = this.sequences[row];
        let mid = (this.ends[row] === -1) ? "" : s.substring(this.starts[row], this.ends[row]);
        return [s.substring(0, this.starts[row]), mid, s.substring(this.ends[row] === -1 ? this.starts[row] : this.ends[row])];
    }

    handleInteraction(e) {
        const rect = this.canvas.getBoundingClientRect();
        let dx = (e.clientX - rect.left) - this.canvas.width/2;
        let dy = this.canvas.height/2 - (e.clientY - rect.top);
        let dist = Math.sqrt(dx*dx + dy*dy);
        let row = (dist >= this.rOut-20 && dist <= this.rOut+20) ? 0 : (dist >= this.rIn-20 && dist <= this.rIn+20 ? 1 : -1);

        if (row !== -1) {
            let angleDeg = Math.atan2(dx, dy) * 180 / Math.PI;
            if (angleDeg < 0) angleDeg += 360;
            let offset = (this.sequences[row].length * this.degPerUnit) / 2.0;
            let idx = Math.round((angleDeg + offset) % 360 / this.degPerUnit);
            
            if (idx >= 0 && idx <= this.sequences[row].length) {
                if (this.starts[row] === -1 || (this.starts[row] !== -1 && this.ends[row] !== -1)) {
                    this.starts[row] = idx; this.ends[row] = -1;
                } else {
                    this.ends[row] = idx;
                    if (this.starts[row] > this.ends[row]) [this.starts[row], this.ends[row]] = [this.ends[row], this.starts[row]];
                }
                this.paint();
            }
        }
    }

    paint() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        let cx = this.canvas.width/2, cy = this.canvas.height/2;

        this.ctx.strokeStyle = "rgba(168, 230, 207, 0.4)";
        this.ctx.lineWidth = 35;
        this.ctx.beginPath(); this.ctx.arc(cx, cy, this.rOut, 0, Math.PI*2); this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.arc(cx, cy, this.rIn, 0, Math.PI*2); this.ctx.stroke();

        this.ctx.font = "bold 14px Arial";
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

                let isSelected = this.ends[row] !== -1 && (i >= this.starts[row] && i < this.ends[row]);
                this.ctx.fillStyle = isSelected ? "red" : "black";
                this.ctx.save();
                this.ctx.translate(x, y); this.ctx.rotate(rad + Math.PI/2);
                this.ctx.fillText(seq[i], 0, 0);
                this.ctx.restore();

                if (i === this.starts[row] || i === this.ends[row]) {
                    this.ctx.strokeStyle = "red"; this.ctx.lineWidth = 3;
                    let lRad = ((i * this.degPerUnit) - offset - 90) * Math.PI / 180;
                    this.ctx.beginPath();
                    this.ctx.moveTo(cx + (r-18)*Math.cos(lRad), cy + (r-18)*Math.sin(lRad));
                    this.ctx.lineTo(cx + (r+18)*Math.cos(lRad), cy + (r+18)*Math.sin(lRad));
                    this.ctx.stroke();
                }
            }
        }
    }
}

// ==========================================
// 4. GeneSegmentSelector (步骤2)
// ==========================================
class GeneSegmentSelector {
    constructor(canvasId, topSeq, botSeq) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.sequences = [topSeq, botSeq];
        this.starts = [-1, -1]; this.ends = [-1, -1];
        this.unit = 32; this.startX = 50; this.cy = 250;
        this.canvas.addEventListener('mousedown', e => this.handleInteraction(e));
    }

    reset() { this.starts = [-1, -1]; this.ends = [-1, -1]; this.paint(); }
    show() { this.canvas.style.display = 'block'; this.paint(); }
    hide() { this.canvas.style.display = 'none'; }

    getRowParts(row) {
        if (this.starts[row] === -1 || this.ends[row] === -1) return null;
        let s = this.sequences[row];
        return [s.substring(0, this.starts[row]), s.substring(this.starts[row], this.ends[row]), s.substring(this.ends[row])];
    }

    handleInteraction(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x = e.clientX - rect.left, y = e.clientY - rect.top;
        let row = (y >= this.cy - 60 && y <= this.cy - 10) ? 0 : (y >= this.cy + 10 && y <= this.cy + 60 ? 1 : -1);

        if (row !== -1) {
            let idx = Math.round((x - this.startX) / this.unit);
            if (idx >= 0 && idx <= this.sequences[row].length) {
                if (this.starts[row] === -1 || (this.starts[row] !== -1 && this.ends[row] !== -1)) {
                    this.starts[row] = idx; this.ends[row] = -1;
                } else {
                    this.ends[row] = idx;
                    if (this.starts[row] > this.ends[row]) [this.starts[row], this.ends[row]] = [this.ends[row], this.starts[row]];
                }
                this.paint();
            }
        }
    }

    paint() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = "bold 16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        for (let row = 0; row < 2; row++) {
            let seq = this.sequences[row];
            let yPos = row === 0 ? this.cy - 35 : this.cy + 35;
            this.ctx.fillStyle = "rgba(168, 230, 207, 0.6)";
            this.ctx.fillRect(this.startX - 16, yPos - 25, seq.length * this.unit, 50);

            for (let i = 0; i < seq.length; i++) {
                let x = this.startX + i * this.unit;
                let isSel = this.ends[row] !== -1 && (i >= this.starts[row] && i < this.ends[row]);
                this.ctx.fillStyle = isSel ? "red" : "black";
                this.ctx.fillText(seq[i], x, yPos);

                if (i === this.starts[row] || i === this.ends[row]) {
                    this.ctx.strokeStyle = "red"; this.ctx.lineWidth = 3;
                    this.ctx.beginPath(); 
                    this.ctx.moveTo(x - this.unit/2, yPos - 25); 
                    this.ctx.lineTo(x - this.unit/2, yPos + 25); 
                    this.ctx.stroke();
                }
            }
        }
    }
}

// ==========================================
// 5. MainApp 控制逻辑
// ==========================================
class MainApp {
    constructor() {
        this.INITIAL_SEQ_TOP = "ATGCGTAATAGC"; 
        this.INITIAL_SEQ_BOT = "TACGCATTATCG";
        this.LINEAR_GENE_TOP = "GGATCCAAGCTT"; 
        this.LINEAR_GENE_BOT = "CCTAGGTTCGAA";

        this.plasmidPanel = new PlasmidPanel('previewCanvas');
        this.circSelector = new CircularGeneSelector('circularCanvas', this.INITIAL_SEQ_TOP, this.INITIAL_SEQ_BOT);
        this.linSelector = new GeneSegmentSelector('linearCanvas', this.LINEAR_GENE_TOP, this.LINEAR_GENE_BOT);

        this.appStep = 1;
        this.bindEvents();
        this.resetState();
    }

    bindEvents() {
        document.getElementById('btn-reset').onclick = () => this.resetState();
        document.getElementById('btn-rotate').onclick = () => {
            if ((this.plasmidPanel.mode === "extract" && this.plasmidPanel.progress < 0.8) || 
                (this.plasmidPanel.mode === "insert" && this.plasmidPanel.progress > 0.2)) {
                alert("⚠️ 请将片段完全拉拽到屏幕上方位置才能旋转！"); return;
            }
            this.plasmidPanel.startRotationAnimation((nT, nB) => {
                this.plasmidPanel.fragTop = nT; this.plasmidPanel.fragBot = nB;
            });
        };
        document.getElementById('btn-ligate').onclick = () => this.executeLigation();
        document.getElementById('btn-cut').onclick = () => this.executeCut();
    }

    resetState() {
        this.appStep = 1;
        this.circSelector.reset(); this.circSelector.show();
        this.linSelector.hide();
        let mid = Math.floor(this.INITIAL_SEQ_TOP.length / 2);
        let vLT = this.INITIAL_SEQ_TOP.substring(0, mid), vRT = this.INITIAL_SEQ_TOP.substring(mid);
        let vLB = this.INITIAL_SEQ_BOT.substring(0, mid), vRB = this.INITIAL_SEQ_BOT.substring(mid);

        this.plasmidPanel.setSequences("", "", 
            `5'-${formatSeq(vLT)}-`, `3'-${formatSeq(vLB)}-`, 
            `-${formatSeq(vRT)}-3'`, `-${formatSeq(vRB)}-5'`);
        this.plasmidPanel.setStaticState("extract", 0.0);
        document.getElementById('step-title').innerText = "交互操作区 - 步骤 1：圆环切割";
        document.getElementById('btn-cut').innerText = "✂️ 执行切割";
    }

    executeCut() {
        let activeSel = this.appStep === 1 ? this.circSelector : this.linSelector;
        let tParts = activeSel.getRowParts(0), bParts = activeSel.getRowParts(1);
        if (!tParts || !bParts) { alert("⚠️ 请在上下链各选择切割区域！"); return; }

        if (this.appStep === 1) {
            this.plasmidPanel.setSequences(
                formatSeq(tParts[1]), formatSeq(bParts[1]),
                `5'-${formatSeq(tParts[0])}-`, `3'-${formatSeq(bParts[0])}-`,
                `-${formatSeq(tParts[2])}-3'`, `-${formatSeq(bParts[2])}-5'`
            );
            this.appStep = 2;
            this.circSelector.hide(); this.linSelector.reset(); this.linSelector.show();
            document.getElementById('step-title').innerText = "交互操作区 - 步骤 2：片段提取";
            document.getElementById('btn-cut').innerText = "🧬 提取新基因";
        } else {
            this.plasmidPanel.fragTop = formatSeq(tParts[1]);
            this.plasmidPanel.fragBot = formatSeq(bParts[1]);
            this.plasmidPanel.setStaticState("insert", 0.0);
        }
    }

    executeLigation() {
        if (this.appStep === 1) return alert("⚠️ 请先完成切割和提取！");
        let p = this.plasmidPanel;
        let isDetached = (p.mode === "extract" && p.progress > 0.8) || (p.mode === "insert" && p.progress < 0.2);
        let isInserted = (p.mode === "extract" && p.progress < 0.2) || (p.mode === "insert" && p.progress > 0.8);

        if (isDetached) {
            if (isComplementary(p.vecLTop+p.vecRTop, p.vecLBot+p.vecRBot)) p.startSelfLigationAnimation();
            else alert("❌ 自连失败：末端碱基不匹配！");
        } else if (isInserted) {
            if (isComplementary(p.vecLTop+p.fragTop+p.vecRTop, p.vecLBot+p.fragBot+p.vecRBot)) {
                p.setStaticState(p.mode === "insert" ? "insert" : "extract", p.mode === "insert" ? 1.0 : 0.0);
                alert("🎉 重组成功！片段已插入。");
            } else alert("❌ 嵌入失败：碱基不配对！建议翻转片段。");
        } else alert("⚠️ 请拖动到缺口或顶端再拼合！");
    }
}

window.onload = () => new MainApp();