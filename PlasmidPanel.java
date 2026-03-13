import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.geom.*;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 高级质粒切割与形变可视化组件
 * 可作为普通的 JPanel 嵌入到任何 JFrame 中
 */
public class PlasmidPanel extends JPanel {

    // ==========================================
    // 1. 可配置属性 (外观与数据)
    // ==========================================
    private Color vectorColor = new Color(168, 230, 207);  // 大弧（载体骨架）颜色
    private Color fragmentColor = new Color(255, 211, 182); // 小弧（目标片段）颜色
    private Color leftEnzymeColor = new Color(139, 0, 0);   // 左侧酶文字颜色 (Dark Red)
    private Color rightEnzymeColor = new Color(0, 0, 139);  // 右侧酶文字颜色 (Dark Blue)

    private String leftEnzymeName = "";
    private String rightEnzymeName = "";
    private String fragTop = "A-G-C-T-T-   -Gene-   -G";
    private String fragBot = "A-   -Gene-   -C-C-T-A-G";
    private String vecLTop = "5'-G-";
    private String vecLBot = "3'-C-C-T-A-G-";
    private String vecRTop = "-A-G-C-T-T-3'";
    private String vecRBot = "-A-5'";

    private boolean showCutLine = false;
    private boolean showTitle = false;

    // 数学参数
    private double degPerToken = 3.0;
    private double centerTheta = 90.0;

    // ==========================================
    // 2. 内部渲染与动画状态
    // ==========================================
    // 在约 42 行左右，private boolean showTitle 之后添加：
    private double extractDistance = 0.8; // 抽出动画最终停留的高度
    private double insertDistance = 0.8;  // 插入动画开始时的高度
    private double progress = 0.0; // 0.0 到 1.0
    private String mode = "extract"; // "extract" 或 "insert"
    private Timer animationTimer;

    private final double SCALE = 250.0; 
    private final int CENTER_X = 400;
    private final int CENTER_Y = 400;

    public PlasmidPanel setExtractDistance(double dist) {
        this.extractDistance = dist;
        repaint(); // 修改后立刻重绘
        return this; // 支持链式调用
    }

    /**
     * 设置插入动画开始时的起始距离
     */
    public PlasmidPanel setInsertDistance(double dist) {
        this.insertDistance = dist;
        repaint();
        return this;
    }

    public PlasmidPanel() {
        setPreferredSize(new Dimension(800, 800));
        setBackground(Color.WHITE);
        setOpaque(true);
    }

    // ==========================================
    // 3. 开放 API：配置方法 (支持链式调用)
    // ==========================================
    
    public PlasmidPanel setColors(Color vectorCol, Color fragmentCol) {
        this.vectorColor = vectorCol;
        this.fragmentColor = fragmentCol;
        repaint();
        return this;
    }

    public PlasmidPanel setEnzymeNames(String left, String right) {
        this.leftEnzymeName = left;
        this.rightEnzymeName = right;
        repaint();
        return this;
    }

    public PlasmidPanel setSequences(String fragT, String fragB, String vLT, String vLB, String vRT, String vRB) {
        this.fragTop = fragT; this.fragBot = fragB;
        this.vecLTop = vLT; this.vecLBot = vLB;
        this.vecRTop = vRT; this.vecRBot = vRB;
        repaint();
        return this;
    }

    public PlasmidPanel setShowCutLine(boolean show) {
        this.showCutLine = show;
        repaint();
        return this;
    }

    // ==========================================
    // 4. 开放 API：动画控制引擎
    // ==========================================
    
    /**
     * 播放抽出变直动画 (Extract)
     * @param durationMs 动画总时长（毫秒）
     */
    public void playExtraction(int durationMs) {
        startAnimation("extract", durationMs);
    }

    /**
     * 播放弯曲插入动画 (Insert)
     * @param durationMs 动画总时长（毫秒）
     */
    public void playInsertion(int durationMs) {
        startAnimation("insert", durationMs);
    }

    /**
     * 直接跳转到某个状态（不播放动画）
     */
    public void setStaticState(String mode, double progress) {
        if (animationTimer != null && animationTimer.isRunning()) {
            animationTimer.stop();
        }
        this.mode = mode;
        this.progress = Math.max(0.0, Math.min(1.0, progress));
        repaint();
    }

    private void startAnimation(String targetMode, int durationMs) {
        if (animationTimer != null && animationTimer.isRunning()) {
            animationTimer.stop();
        }

        this.mode = targetMode;
        this.progress = 0.0;
        
        long startTime = System.currentTimeMillis();
        int delay = 16; // 约 60 FPS

        animationTimer = new Timer(delay, new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                long elapsed = System.currentTimeMillis() - startTime;
                double p = (double) elapsed / durationMs;

                if (p >= 1.0) {
                    p = 1.0;
                    progress = p;
                    repaint();
                    animationTimer.stop();
                } else {
                    progress = p;
                    repaint();
                }
            }
        });
        animationTimer.start();
    }

    // ==========================================
    // 5. 核心渲染逻辑 (私有)
    // ==========================================
    
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
        int steps = 50;
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

    private void drawMorphedZCut(Graphics2D g2d, double angleOuter, double angleInner, double rOuter, double rMid, double rInner, double t, double dist) {
        if (!showCutLine) return;
        Point2D.Double[] pts = {
            morphPoint(rOuter, angleOuter, t, dist, rMid),
            morphPoint(rMid, angleOuter, t, dist, rMid),
            morphPoint(rMid, angleInner, t, dist, rMid),
            morphPoint(rInner, angleInner, t, dist, rMid)
        };
        g2d.setColor(Color.RED);
        g2d.setStroke(new BasicStroke(2f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10f, new float[]{5f}, 0f));
        for (int i = 0; i < pts.length - 1; i++) {
            g2d.drawLine((int)screenX(pts[i].x), (int)screenY(pts[i].y), (int)screenX(pts[i+1].x), (int)screenY(pts[i+1].y));
        }
        g2d.setStroke(new BasicStroke(1f));
    }

    private void drawMorphedText(Graphics2D g2d, String text, double radius, double edgeAngle, int alignDir, String anchor, double t, double dist, double rRef, Color color) {
        List<String> tokens = getTokens(text);
        int n = tokens.size();
        double offset = degPerToken / 2.0;
        double startTheta = 0;

        if (anchor.equals("start")) startTheta = edgeAngle + offset * alignDir;
        else if (anchor.equals("end")) startTheta = edgeAngle - (n - 1) * degPerToken * alignDir - offset * alignDir;

        g2d.setColor(color);
        g2d.setFont(new Font("SansSerif", Font.BOLD, 18));

        for (int i = 0; i < n; i++) {
            String token = tokens.get(i);
            double theta = startTheta + i * degPerToken * alignDir;
            Point2D.Double p = morphPoint(radius, theta, t, dist, rRef);

            double rotArc = theta - 90;
            double rotLine = centerTheta - 90;
            double rot = (1 - t) * rotArc + t * rotLine;
            if (rot < -90 || rot > 90) rot += 180;

            AffineTransform old = g2d.getTransform();
            g2d.translate(screenX(p.x), screenY(p.y));
            g2d.rotate(Math.toRadians(-rot));

            FontMetrics fm = g2d.getFontMetrics();
            g2d.drawString(token, -fm.stringWidth(token) / 2, (fm.getAscent() - fm.getDescent()) / 2);
            g2d.setTransform(old);
        }
    }


    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2d = (Graphics2D) g;
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        double rOutE = 1.0, w = 0.15, rMid = rOutE - w, rInE = rMid - w;
        double rOutT = rOutE - w / 2, rInT = rMid - w / 2;

        // --- 核心修改部分：计算缺口跨度 ---
        int actualTokens = getTokens(fragTop).size();
        // 如果序列为空，强制设置最小缺口为 3 个单位宽度
        int displayTokens = (actualTokens == 0) ? 3 : actualTokens;
        double spanOuter = displayTokens * degPerToken;
        // --------------------------------

        double cLOut = centerTheta + spanOuter / 2.0;
        double cROut = centerTheta - spanOuter / 2.0;
        
        // 计算内环偏移
        double lOff = getTokens(vecLBot).size() - getTokens(vecLTop).size();
        double rOff = getTokens(vecRTop).size() - getTokens(vecRBot).size();
        double cLIn = cLOut - lOff * degPerToken;
        double cRIn = cROut - rOff * degPerToken;

        double pVal = progress;
        if (progress < 0.1) pVal = 0.0;
        else if (progress > 0.9) pVal = 1.0;
        else pVal = (progress - 0.1) / 0.8;
        
        double pSmooth = pVal * pVal * (3 - 2 * pVal);

        double tMorph = mode.equals("extract") ? pSmooth : 1.0 - pSmooth;
        double dist = mode.equals("extract") ? 
                    extractDistance * pSmooth : 
                    insertDistance * (1.0 - pSmooth);

        // 1. 画载体骨架 (Static)
        drawMorphedLayer(g2d, rMid, rOutE, cLOut, 360 + cROut, vectorColor, 0, 0, rMid);
        drawMorphedLayer(g2d, rInE, rMid, cLIn, 360 + cRIn, vectorColor, 0, 0, rMid);
        drawMorphedZCut(g2d, cLOut, cLIn, rOutE, rMid, rInE, 0, 0);
        drawMorphedZCut(g2d, cROut, cRIn, rOutE, rMid, rInE, 0, 0);
        
        drawMorphedText(g2d, vecLTop, rOutT, cLOut, -1, "end", 0, 0, rMid, Color.BLACK);
        drawMorphedText(g2d, vecLBot, rInT, cLIn, -1, "end", 0, 0, rMid, Color.BLACK);
        drawMorphedText(g2d, vecRTop, rOutT, cROut, -1, "start", 0, 0, rMid, Color.BLACK);
        drawMorphedText(g2d, vecRBot, rInT, cRIn, -1, "start", 0, 0, rMid, Color.BLACK);

        // 2. 画形变目标片段 (Animated)
        // 只有当实际有序列时，才绘制片段的颜色背景和文字
        if (actualTokens > 0) {
            drawMorphedLayer(g2d, rMid, rOutE, cROut, cLOut, fragmentColor, tMorph, dist, rMid);
            drawMorphedLayer(g2d, rInE, rMid, cRIn, cLIn, fragmentColor, tMorph, dist, rMid);
            
            drawMorphedText(g2d, fragTop, rOutT, cLOut, -1, "start", tMorph, dist, rMid, Color.BLACK);
            drawMorphedText(g2d, fragBot, rInT, cLIn, -1, "start", tMorph, dist, rMid, Color.BLACK);
        } else {
            // 如果实际序列为空，但正在执行“插入”或“抽出”动画，
            // 依然绘制 Z 型切割虚线以表示“断裂处的边缘”正在移动
            drawMorphedZCut(g2d, cLOut, cLIn, rOutE, rMid, rInE, tMorph, dist);
            drawMorphedZCut(g2d, cROut, cRIn, rOutE, rMid, rInE, tMorph, dist);
        }
        
        // 3. 酶切位点提示文字跟随
        if (!leftEnzymeName.isEmpty())
            drawMorphedText(g2d, leftEnzymeName, rOutE + 0.1, cLOut, -1, "start", tMorph, dist, rMid, leftEnzymeColor);
        if (!rightEnzymeName.isEmpty())
            drawMorphedText(g2d, rightEnzymeName, rOutE + 0.1, cROut, 1, "start", tMorph, dist, rMid, rightEnzymeColor);

        // 标题
        if (showTitle) {
            g2d.setColor(Color.DARK_GRAY);
            g2d.setFont(new Font("SansSerif", Font.BOLD, 22));
            String title = mode.equals("extract") ? "Break Point Morphing" : "Fragment Insertion";
            g2d.drawString(title, 20, 40);
        }
    }
}

