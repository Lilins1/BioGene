import java.awt.*;
import java.awt.event.*;
import java.util.Arrays;
import javax.swing.*;

public class GeneSegmentSelector extends JPanel {

    public interface SequenceSelectionListener {
        void onSelectionComplete(String[] topParts, String[] botParts);
    }

    private SequenceSelectionListener selectionListener;

    private String[] sequences = new String[2];
    private int[] starts = {-1, -1};
    private int[] ends = {-1, -1};
    
    // 控制是否已经执行了切割动画/渲染
    private boolean isCutPerformed = false;

    // --- 渲染配置 ---
    private final int UNIT_WIDTH = 30;     
    private final int STRIP_HEIGHT = 45;   
    private final int MARGIN_LEFT = 60;    
    
    private final Color STRIP_COLOR = new Color(168, 230, 207);    
    private final Color SELECT_BG_COLOR = new Color(255, 180, 130); 
    private final Color SELECT_TEXT_COLOR = Color.RED;             
    private final Color CUT_LINE_COLOR = new Color(255, 0, 0); // 纯红切割线

    public GeneSegmentSelector(String seq1, String seq2) {
        this.sequences[0] = seq1;
        this.sequences[1] = seq2;
        this.setBackground(Color.WHITE);
        
        int maxLen = Math.max(seq1.length(), seq2.length());
        this.setPreferredSize(new Dimension(maxLen * UNIT_WIDTH + 120, STRIP_HEIGHT * 2 + 100));

        addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                handleInteraction(e.getX(), e.getY());
            }
        });
    }

    public void setSelectionListener(SequenceSelectionListener listener) {
        this.selectionListener = listener;
    }

    /**
     * 外部调用的切割方法
     */
    public void performCut() {
        // 校验：检查上下两行是否都选好了 2 个点
        if (starts[0] != -1 && ends[0] != -1 && starts[1] != -1 && ends[1] != -1) {
            isCutPerformed = true;
            repaint();
            
            if (selectionListener != null) {
                selectionListener.onSelectionComplete(getRowParts(0), getRowParts(1));
            }
        } else {
            JOptionPane.showMessageDialog(this, "请先在上下两行各选择两个分界点！");
        }
    }

    public void reset() {
        Arrays.fill(starts, -1);
        Arrays.fill(ends, -1);
        isCutPerformed = false;
        repaint();
    }

    private void handleInteraction(int x, int y) {
        int row = -1;
        int yBase = 50;
        if (y >= yBase && y < yBase + STRIP_HEIGHT) row = 0;
        else if (y >= yBase + STRIP_HEIGHT && y < yBase + STRIP_HEIGHT * 2) row = 1;

        if (row == -1) return;

        // 如果用户在已切割状态下点击，重置切割状态以便重新选择
        if (isCutPerformed) {
            isCutPerformed = false;
        }

        int bIdx = (int) Math.round((double)(x - MARGIN_LEFT) / UNIT_WIDTH);
        
        if (bIdx >= 0 && bIdx <= sequences[row].length()) {
            if (starts[row] == -1 || (starts[row] != -1 && ends[row] != -1)) {
                starts[row] = bIdx;
                ends[row] = -1;
            } else {
                ends[row] = bIdx;
                if (starts[row] > ends[row]) {
                    int temp = starts[row]; starts[row] = ends[row]; ends[row] = temp;
                }
            }
            repaint();
        }
    }

    public String[] getRowParts(int rowIndex) {
        if (starts[rowIndex] == -1 || ends[rowIndex] == -1) return null;
        String seq = sequences[rowIndex];
        return new String[]{
            seq.substring(0, starts[rowIndex]),
            seq.substring(starts[rowIndex], ends[rowIndex]),
            seq.substring(ends[rowIndex])
        };
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2d = (Graphics2D) g;
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        int yBase = 50;
        g2d.setFont(new Font("SansSerif", Font.BOLD, 18));
        FontMetrics fm = g2d.getFontMetrics();

        for (int r = 0; r < 2; r++) {
            int rowY = yBase + (r * STRIP_HEIGHT);
            int seqLen = sequences[r].length();

            // 1. 绘制背景条
            g2d.setColor(STRIP_COLOR);
            g2d.fillRect(MARGIN_LEFT, rowY, seqLen * UNIT_WIDTH, STRIP_HEIGHT);

            // 2. 绘制选中高亮 (仅在 performCut 后显示)
            if (isCutPerformed && starts[r] != -1 && ends[r] != -1) {
                int startX = MARGIN_LEFT + starts[r] * UNIT_WIDTH;
                int drawWidth = (ends[r] - starts[r]) * UNIT_WIDTH;
                g2d.setColor(SELECT_BG_COLOR);
                g2d.fillRect(startX, rowY, drawWidth, STRIP_HEIGHT);
            }

            // 3. 绘制文字
            for (int i = 0; i < seqLen; i++) {
                String base = String.valueOf(sequences[r].charAt(i));
                int baseCenterX = MARGIN_LEFT + i * UNIT_WIDTH + UNIT_WIDTH / 2;
                int textY = rowY + STRIP_HEIGHT / 2 + fm.getAscent() / 2 - 2;

                boolean isSelected = isCutPerformed && (i >= starts[r] && i < ends[r]);
                g2d.setColor(isSelected ? SELECT_TEXT_COLOR : Color.BLACK);
                g2d.drawString(base, baseCenterX - fm.stringWidth(base) / 2, textY);

                if (i < seqLen - 1) {
                    boolean isHyphenSelected = isCutPerformed && ((i + 1) > starts[r] && (i + 1) < ends[r]);
                    g2d.setColor(isHyphenSelected ? SELECT_TEXT_COLOR : Color.BLACK);
                    int hyphenX = MARGIN_LEFT + (i + 1) * UNIT_WIDTH;
                    g2d.drawString("-", hyphenX - fm.stringWidth("-") / 2, textY);
                }
            }

            // 4. 绘制红色切割线 (始终保留)
            g2d.setColor(CUT_LINE_COLOR);
            g2d.setStroke(new BasicStroke(2.5f));
            if (starts[r] != -1) {
                int x = MARGIN_LEFT + starts[r] * UNIT_WIDTH;
                g2d.drawLine(x, rowY, x, rowY + STRIP_HEIGHT);
            }
            if (ends[r] != -1) {
                int x = MARGIN_LEFT + ends[r] * UNIT_WIDTH;
                g2d.drawLine(x, rowY, x, rowY + STRIP_HEIGHT);
            }
        }

        // 5. 绘制整体边框
        g2d.setColor(STRIP_COLOR.darker());
        g2d.setStroke(new BasicStroke(1.2f));
        int totalWidth = Math.max(sequences[0].length(), sequences[1].length()) * UNIT_WIDTH;
        g2d.drawRect(MARGIN_LEFT, yBase, totalWidth, STRIP_HEIGHT * 2);
    }
}