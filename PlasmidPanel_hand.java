import java.awt.*;
import java.awt.event.*;
import java.awt.geom.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.swing.*;

public class PlasmidPanel_hand extends JPanel {
    private Color vectorColor = new Color(168, 230, 207);  
    private Color fragmentColor = new Color(255, 180, 130); 
    private String fragTop = "", fragBot = "", vecLTop = "", vecLBot = "", vecRTop = "", vecRBot = "";
    
    private double degPerToken = 3.0;
    private double centerTheta = 90.0;
    private final double SCALE = 250.0; 
    private final int CENTER_X = 400;
    private final int CENTER_Y = 400;

    private double extractDistance = 0.5; 
    private double insertDistance = 0.5;  
    private double progress = 0.0; 
    private String mode = "extract"; 

    private Point lastMousePoint;
    private final int DRAG_SENSITIVITY = 300;

    // --- 旋转变量 ---
    private double rotationAngle = 0.0;
    private boolean isRotating = false;

    // --- 自环变量 ---
    private boolean isSelfLigating = false;
    private double selfLigationProgress = 0.0; // 0.0 到 1.0

    public interface RotationListener {
        void onRotationComplete(String newFragTop, String newFragBot);
    }
    private RotationListener rotationListener;
    public void setRotationListener(RotationListener l) { this.rotationListener = l; }

    public PlasmidPanel_hand() {
        setPreferredSize(new Dimension(800, 800));
        setBackground(Color.WHITE);
        setOpaque(true);

        MouseAdapter mouseAdapter = new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) { lastMousePoint = e.getPoint(); }
            @Override
            public void mouseDragged(MouseEvent e) {
                if (lastMousePoint == null || isRotating || isSelfLigating) return;
                int deltaY = e.getPoint().y - lastMousePoint.y;
                if ("extract".equals(mode)) {
                    progress -= (double) deltaY / DRAG_SENSITIVITY;
                } else {
                    progress += (double) deltaY / DRAG_SENSITIVITY;
                }
                progress = Math.max(0.0, Math.min(1.0, progress));
                lastMousePoint = e.getPoint();
                repaint();
            }
        };
        addMouseListener(mouseAdapter);
        addMouseMotionListener(mouseAdapter);
    }

    // --- 旋转动画 ---
    public void startRotationAnimation() {
        if (isRotating || isSelfLigating) return;
        isRotating = true;
        Timer timer = new Timer(16, null);
        long startTime = System.currentTimeMillis();
        timer.addActionListener(e -> {
            double p = (double) (System.currentTimeMillis() - startTime) / 800;
            if (p >= 1.0) {
                timer.stop();
                finalizeRotation();
            } else {
                rotationAngle = p * 180.0;
                repaint();
            }
        });
        timer.start();
    }

    private void finalizeRotation() {
        String nT = reverseDnaString(fragBot);
        String nB = reverseDnaString(fragTop);
        this.fragTop = nT; this.fragBot = nB;
        this.rotationAngle = 0.0;
        this.isRotating = false;
        if (rotationListener != null) rotationListener.onRotationComplete(nT, nB);
        repaint();
    }

    // --- 自环动画 ---
    public void startSelfLigationAnimation() {
        if (isSelfLigating || isRotating) return;
        isSelfLigating = true;
        selfLigationProgress = 0.0;
        Timer timer = new Timer(16, null);
        long startTime = System.currentTimeMillis();
        timer.addActionListener(e -> {
            double p = (System.currentTimeMillis() - startTime) / 1200.0;
            if (p >= 1.0) {
                selfLigationProgress = 1.0;
                timer.stop();
            } else {
                selfLigationProgress = p;
                repaint();
            }
        });
        timer.start();
    }

    public void resetSelfLigation() {
        isSelfLigating = false;
        selfLigationProgress = 0.0;
        repaint();
    }

    // --- 辅助函数 ---
    private String reverseDnaString(String seq) {
        List<String> tokens = getTokens(seq);
        Collections.reverse(tokens);
        StringBuilder sb = new StringBuilder();
        for (String t : tokens) sb.append(t);
        return sb.toString();
    }

    public PlasmidPanel_hand setMode(String newMode) { this.mode = newMode; this.progress = 0.0; this.isSelfLigating=false; repaint(); return this; }
    public void setProgress(double p) { this.progress = p; repaint(); }
    public String getMode() { return mode; }
    public double getProgress() { return progress; }

    public PlasmidPanel_hand setSequences(String fragT, String fragB, String vLT, String vLB, String vRT, String vRB) {
        this.fragTop = fragT; this.fragBot = fragB;
        this.vecLTop = vLT; this.vecLBot = vLB;
        this.vecRTop = vRT; this.vecRBot = vRB;
        repaint();
        return this;
    }

    public void setStaticState(String mode, double progress) {
        this.mode = mode; this.progress = progress; this.isSelfLigating=false; repaint();
    }

    public PlasmidPanel_hand setExtractDistance(double d) { this.extractDistance = d; return this; }
    public PlasmidPanel_hand setInsertDistance(double d) { this.insertDistance = d; return this; }
    public PlasmidPanel_hand setColors(Color v, Color f) { this.vectorColor = v; this.fragmentColor = f; return this; }

    private List<String> getTokens(String text) {
        List<String> tokens = new ArrayList<>();
        Pattern pattern = Pattern.compile("5'|3'|\\.{2,}|.");
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) tokens.add(matcher.group());
        return tokens;
    }

    private double screenX(double x) { return CENTER_X + x * SCALE; }
    private double screenY(double y) { return CENTER_Y - y * SCALE; }

    private Point2D.Double morphPoint(double r, double thetaDeg, double t, double dist, double rRef) {
        double rad = Math.toRadians(thetaDeg);
        double radMid = Math.toRadians(centerTheta);
        double xArc = r * Math.cos(rad);
        double yArc = r * Math.sin(rad);
        double s = rRef * (radMid - rad);
        double xLine = r * Math.cos(radMid) + s * Math.sin(radMid);
        double yLine = r * Math.sin(radMid) - s * Math.cos(radMid);
        double x = (1 - t) * xArc + t * xLine + dist * Math.cos(radMid);
        double y = (1 - t) * yArc + t * yLine + dist * Math.sin(radMid);
        return new Point2D.Double(x, y);
    }

    private void drawMorphedLayer(Graphics2D g2d, double r1, double r2, double theta1, double theta2, Color color, double t, double dist, double rRef) {
        Path2D path = new Path2D.Double();
        int steps = 40;
        double stepSize = (theta2 - theta1) / steps;
        for (int i = 0; i <= steps; i++) {
            Point2D.Double p = morphPoint(r2, theta1 + i * stepSize, t, dist, rRef);
            if (i == 0) path.moveTo(screenX(p.x), screenY(p.y));
            else path.lineTo(screenX(p.x), screenY(p.y));
        }
        for (int i = steps; i >= 0; i--) {
            Point2D.Double p = morphPoint(r1, theta1 + i * stepSize, t, dist, rRef);
            path.lineTo(screenX(p.x), screenY(p.y));
        }
        path.closePath();
        g2d.setColor(new Color(color.getRed(), color.getGreen(), color.getBlue(), 180));
        g2d.fill(path);
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2d = (Graphics2D) g;
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        double rOutE = 1.0, w = 0.15, rMid = rOutE - w;
        double rOutT = rOutE - w/2, rInT = rMid - w/2;

        double spanOuter = getTokens(fragTop).size() * degPerToken;
        double cLOut = centerTheta + spanOuter / 2.0;
        double cROut = centerTheta - spanOuter / 2.0;
        double lOff = (getTokens(vecLBot).size() - getTokens(vecLTop).size()) * degPerToken;
        double rOff = (getTokens(vecRTop).size() - getTokens(vecRBot).size()) * degPerToken;

        double pSmooth = progress * progress * (3 - 2 * progress); 
        double tMorph = mode.equals("extract") ? pSmooth : 1.0 - pSmooth;
        double currentDist = mode.equals("extract") ? extractDistance * pSmooth : insertDistance * (1.0 - pSmooth);

        // --- 1. 绘制载体骨架 ---
        double vL = cLOut;
        double vR_text = cROut;
        
        // 【关键修复1】：计算闭合动画坐标
        if (isSelfLigating) {
            vL = cLOut - (spanOuter/2.0) * selfLigationProgress;
            vR_text = cROut + (spanOuter/2.0) * selfLigationProgress;
        }
        double vR = 360 + vR_text; // 背景弧的右侧角度需要+360

        drawMorphedLayer(g2d, rMid, rOutE, vL, vR, vectorColor, 0, 0, rMid);
        drawMorphedLayer(g2d, rMid-w, rMid, vL - lOff, vR - rOff, vectorColor, 0, 0, rMid);

        // --- 2. 绘制载体文字 ---
        // 【关键修复2】：移除了 !isSelfLigating 限制，使用动态 vL 和 vR_text 让文字跟随缺口移动
        drawMorphedText(g2d, vecLTop, rOutT, vL, -1, "end", 0, 0, rMid);
        drawMorphedText(g2d, vecLBot, rInT, vL - lOff, -1, "end", 0, 0, rMid);
        drawMorphedText(g2d, vecRTop, rOutT, vR_text, -1, "start", 0, 0, rMid);
        drawMorphedText(g2d, vecRBot, rInT, vR_text - rOff, -1, "start", 0, 0, rMid);

        // --- 3. 绘制目标片段 ---
        AffineTransform old = g2d.getTransform();
        Point2D.Double fCenter = morphPoint(rMid - w/2, centerTheta, tMorph, currentDist, rMid);
        
        if (rotationAngle != 0) {
            g2d.rotate(Math.toRadians(rotationAngle), screenX(fCenter.x), screenY(fCenter.y));
        }

        if (isSelfLigating) {
            // 【关键修复3】：传入正确参数进行小环渲染
            drawSelfLigatedFragment(g2d, fCenter, 0, selfLigationProgress);
        } else {
            drawMorphedLayer(g2d, rMid, rOutE, cROut, cLOut, fragmentColor, tMorph, currentDist, rMid);
            drawMorphedLayer(g2d, rMid-w, rMid, cROut - rOff, cLOut - lOff, fragmentColor, tMorph, currentDist, rMid);
            drawMorphedText(g2d, fragTop, rOutT, cLOut, -1, "start", tMorph, currentDist, rMid);
            drawMorphedText(g2d, fragBot, rInT, cLOut - lOff, -1, "start", tMorph, currentDist, rMid);
        }
        
        g2d.setTransform(old);
    }

    private void drawSelfLigatedFragment(Graphics2D g2d, Point2D.Double center, double maxRadius, double p) {
        double currentAngle = 360 * p;
        double cx = screenX(center.x);
        double cy = screenY(center.y);
        
        // 设定小质粒的固定中心半径
        double r = 45; 
        
        // 1. 画背景环：加粗线条以彻底覆盖内部文字
        g2d.setColor(new Color(fragmentColor.getRed(), fragmentColor.getGreen(), fragmentColor.getBlue(), 180));
        // 【关键修复4】：线条宽度从 15f 增加到 36f，确保将两行碱基都包裹在颜色带内
        g2d.setStroke(new BasicStroke(36f));
        g2d.draw(new Arc2D.Double(cx - r, cy - r, r*2, r*2, 90 + currentAngle/2, -currentAngle, Arc2D.OPEN));

        // 2. 绘制环上基因序列 (进度过半时显示)
        if (p > 0.5) {
            g2d.setFont(new Font("SansSerif", Font.BOLD, 12)); // 字号微调
            g2d.setColor(Color.BLACK);
            
            // 【关键修复5】：小圆的周长短，需要调大步进角度（16度），防止字符粘连
            double smallRingStep = 16.0; 
            
            // 外链半径 45+8=53，内链半径 45-8=37。都被 36px 粗细的线条(27到63)完美覆盖
            drawSimpleCircleText(g2d, fragTop, cx, cy, r + 8, smallRingStep); 
            drawSimpleCircleText(g2d, fragBot, cx, cy, r - 8, smallRingStep); 
        }
    }

    // 独立于 morphPoint 的极坐标文字渲染，专用于正圆形小质粒
    private void drawSimpleCircleText(Graphics2D g2d, String text, double cx, double cy, double radius, double step) {
        List<String> tokens = getTokens(text);
        int n = tokens.size();
        double totalSpan = n * step;
        double startAngle = 90 + totalSpan / 2.0;
        FontMetrics fm = g2d.getFontMetrics();

        for (int i = 0; i < n; i++) {
            double angle = startAngle - i * step;
            double rad = Math.toRadians(angle);
            double tx = cx + radius * Math.cos(rad);
            double ty = cy - radius * Math.sin(rad);

            AffineTransform old = g2d.getTransform();
            g2d.translate(tx, ty);
            g2d.rotate(Math.toRadians(-angle + 90));
            String t = tokens.get(i);
            
            // 确保字符在当前坐标点绝对居中
            g2d.drawString(t, -fm.stringWidth(t) / 2, (fm.getAscent() - fm.getDescent()) / 2);
            g2d.setTransform(old);
        }
    }

    private void drawMorphedText(Graphics2D g2d, String text, double radius, double edgeAngle, int alignDir, String anchor, double t, double dist, double rRef) {
        List<String> tokens = getTokens(text);
        int n = tokens.size();
        double offset = degPerToken / 2.0;
        double startTheta = (anchor.equals("start")) ? edgeAngle + offset * alignDir : edgeAngle - (n - 1) * degPerToken * alignDir - offset * alignDir;

        g2d.setColor(Color.BLACK);
        g2d.setFont(new Font("SansSerif", Font.BOLD, 18));
        for (int i = 0; i < n; i++) {
            double theta = startTheta + i * degPerToken * alignDir;
            Point2D.Double p = morphPoint(radius, theta, t, dist, rRef);
            double rot = (1 - t) * (theta - 90) + t * (centerTheta - 90);
            if (rot < -90 || rot > 90) rot += 180;
            AffineTransform old = g2d.getTransform();
            g2d.translate(screenX(p.x), screenY(p.y));
            g2d.rotate(Math.toRadians(-rot));
            FontMetrics fm = g2d.getFontMetrics();
            g2d.drawString(tokens.get(i), -fm.stringWidth(tokens.get(i)) / 2, (fm.getAscent() - fm.getDescent()) / 2);
            g2d.setTransform(old);
        }
    }
}