import java.awt.*;
import java.awt.event.*;
import java.awt.geom.*;
import java.util.Arrays;
import javax.swing.*;

public class CircularGeneSelector extends JPanel {

    public interface SelectionListener {
        void onSelectionChanged(int row, String left, String mid, String right);
    }

    private SelectionListener listener;
    private String[] sequences = new String[2];
    private int[] starts = {-1, -1};
    private int[] ends = {-1, -1};
    private boolean[] isCutPerformed = {false, false};

    private final int CENTER_X = 400;
    private final int CENTER_Y = 400;
    private final double STRIP_WIDTH = 40.0; 
    private final double RADIUS_OUTER = 250.0; 
    private final double RADIUS_INNER = 210.0; 
    private final double degPerUnit = 5.2;

    private final Color vectorColor = new Color(168, 230, 207);  
    private final Color fragmentColor = new Color(255, 180, 130); 
    private final Color CUT_LINE_COLOR = Color.RED;

    public CircularGeneSelector(String topSeq, String botSeq) {
        this.sequences[0] = topSeq;
        this.sequences[1] = botSeq;
        this.setBackground(Color.WHITE);
        this.setPreferredSize(new Dimension(800, 800));

        this.addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                handleInteraction(e.getPoint());
            }
        });
    }

    public void setSelectionListener(SelectionListener listener) {
        this.listener = listener;
    }

    /**
     * 执行切割：支持单刀（mid为空）和两刀（提取片段）
     */
    public void performCut() {
        boolean anyCut = false;
        for (int row = 0; row < 2; row++) {
            // 修改点：只要选了一刀(starts != -1)就可以执行切割
            if (starts[row] != -1) {
                isCutPerformed[row] = true;
                anyCut = true;
                if (listener != null) {
                    String[] parts = getRowParts(row);
                    listener.onSelectionChanged(row, parts[0], parts[1], parts[2]);
                }
            }
        }
        if (!anyCut) {
            JOptionPane.showMessageDialog(this, "请先在圆环上点击选择切割位点！");
        }
        repaint();
    }

    public void reset() {
        Arrays.fill(starts, -1);
        Arrays.fill(ends, -1);
        Arrays.fill(isCutPerformed, false);
        repaint();
    }

    private void handleInteraction(Point p) {
        double dx = p.x - CENTER_X;
        double dy = CENTER_Y - p.y;
        double dist = Math.sqrt(dx * dx + dy * dy);

        int row = -1;
        if (dist >= 230 && dist <= 270) row = 0;
        else if (dist >= 190 && dist <= 230) row = 1;

        if (row == -1) return;

        if (isCutPerformed[row]) isCutPerformed[row] = false;

        double angleRad = Math.atan2(dx, dy);
        double angleDeg = Math.toDegrees(angleRad);
        if (angleDeg < 0) angleDeg += 360;

        int n = sequences[row].length();
        double startAngleOffset = (n * degPerUnit) / 2.0;
        double relativeAngle = angleDeg + startAngleOffset;
        if (relativeAngle >= 360) relativeAngle -= 360;
        
        int bIdx = (int) Math.round(relativeAngle / degPerUnit);

        if (bIdx >= 0 && bIdx <= n) {
            if (starts[row] == -1 || (starts[row] != -1 && ends[row] != -1)) {
                starts[row] = bIdx;
                ends[row] = -1;
            } else {
                ends[row] = bIdx;
                if (starts[row] > ends[row]) {
                    int t = starts[row]; starts[row] = ends[row]; ends[row] = t;
                }
            }
            repaint();
        }
    }

    /**
     * 核心逻辑修改：如果 ends[row] 为 -1，则 mid 返回空字符串
     */
    public String[] getRowParts(int row) {
        if (starts[row] == -1) return null;
        String s = sequences[row];
        
        if (ends[row] == -1) {
            // 情况 A：只切了一刀
            return new String[]{
                s.substring(0, starts[row]), // left
                "",                          // mid (空)
                s.substring(starts[row])     // right
            };
        } else {
            // 情况 B：切了两刀
            return new String[]{
                s.substring(0, starts[row]),
                s.substring(starts[row], ends[row]),
                s.substring(ends[row])
            };
        }
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2d = (Graphics2D) g;
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        drawFullCircle(g2d, RADIUS_OUTER);
        drawFullCircle(g2d, RADIUS_INNER);

        renderRow(g2d, 0, RADIUS_OUTER);
        renderRow(g2d, 1, RADIUS_INNER);
    }

    private void drawFullCircle(Graphics2D g2d, double radius) {
        g2d.setColor(vectorColor);
        g2d.setStroke(new BasicStroke((float) STRIP_WIDTH));
        g2d.draw(new Ellipse2D.Double(CENTER_X - radius, CENTER_Y - radius, radius * 2, radius * 2));
    }

    private void renderRow(Graphics2D g2d, int row, double radius) {
        String seq = sequences[row];
        int n = seq.length();
        double startAngleOffset = (n * degPerUnit) / 2.0;

        // 绘制高亮背景：只有当两刀都齐了才画橙色色块
        if (isCutPerformed[row] && starts[row] != -1 && ends[row] != -1) {
            double mathStart = starts[row] * degPerUnit - startAngleOffset;
            double mathExtent = (ends[row] - starts[row]) * degPerUnit;
            g2d.setColor(fragmentColor);
            g2d.setStroke(new BasicStroke((float) STRIP_WIDTH, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER));
            g2d.draw(new Arc2D.Double(CENTER_X - radius, CENTER_Y - radius, radius * 2, radius * 2, 
                                      90 - mathStart, -mathExtent, Arc2D.OPEN));
        }

        // 绘制文字逻辑
        g2d.setFont(new Font("SansSerif", Font.BOLD, 18));
        FontMetrics fm = g2d.getFontMetrics();
        for (int i = 0; i < n; i++) {
            double baseAngle = (i * degPerUnit) - startAngleOffset + (degPerUnit / 2.0);
            // 判定是否变红：如果是单刀，文字不变红；如果是两刀，中间部分变红
            boolean isSelected = isCutPerformed[row] && ends[row] != -1 && (i >= starts[row] && i < ends[row]);
            drawElement(g2d, String.valueOf(seq.charAt(i)), baseAngle, radius, fm, isSelected);

            if (i < n - 1) {
                double hyphenAngle = (i + 1) * degPerUnit - startAngleOffset;
                boolean isHyphenSelected = isCutPerformed[row] && ends[row] != -1 && ((i + 1) > starts[row] && (i + 1) < ends[row]);
                drawElement(g2d, "-", hyphenAngle, radius, fm, isHyphenSelected);
            }
        }

        // 绘制红色切割线：单刀画一条，两刀画两条
        g2d.setColor(CUT_LINE_COLOR);
        g2d.setStroke(new BasicStroke(2.5f));
        drawRadialLine(g2d, starts[row], startAngleOffset, radius);
        if (ends[row] != -1) {
            drawRadialLine(g2d, ends[row], startAngleOffset, radius);
        }
    }

    private void drawRadialLine(Graphics2D g2d, int bIdx, double offset, double radius) {
        if (bIdx == -1) return;
        double angleDeg = bIdx * degPerUnit - offset;
        double rad = Math.toRadians(angleDeg);
        double rIn = radius - STRIP_WIDTH/2;
        double rOut = radius + STRIP_WIDTH/2;
        int x1 = (int)(CENTER_X + rIn * Math.sin(rad));
        int y1 = (int)(CENTER_Y - rIn * Math.cos(rad));
        int x2 = (int)(CENTER_X + rOut * Math.sin(rad));
        int y2 = (int)(CENTER_Y - rOut * Math.cos(rad));
        g2d.drawLine(x1, y1, x2, y2);
    }

    private void drawElement(Graphics2D g2d, String text, double angleDeg, double radius, FontMetrics fm, boolean highlight) {
        double rad = Math.toRadians(angleDeg);
        double x = CENTER_X + radius * Math.sin(rad);
        double y = CENTER_Y - radius * Math.cos(rad);
        g2d.setColor(highlight ? Color.RED : Color.BLACK);
        AffineTransform old = g2d.getTransform();
        g2d.translate(x, y);
        g2d.rotate(rad);
        g2d.drawString(text, -fm.stringWidth(text) / 2, fm.getAscent() / 2 - 2);
        g2d.setTransform(old);
    }
}