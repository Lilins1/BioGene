import java.awt.*;
import javax.swing.*;

public class MainApp_hand extends JFrame {
    private PlasmidPanel_hand plasmidPanel;
    private CircularGeneSelector circularSelector;
    private GeneSegmentSelector linearSelector;
    private JPanel controlCards; 
    private CardLayout cardLayout;
    
    // 初始序列配置
    private final String INITIAL_SEQ_TOP = "ATGCGTAATAGC";
    private final String INITIAL_SEQ_BOT = "TACGCATTATCG"; 
    private final String LINEAR_GENE_TOP = "GGATCCAAGCTT"; 
    private final String LINEAR_GENE_BOT = "CCTAGGTTCGAA";

    private String currentFragTop, currentFragBot;
    private String vecLTop, vecLBot, vecRTop, vecRBot;

    public MainApp_hand() {
        setTitle("基因克隆全流程仿真交互系统 - Dashboard");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(1600, 950); 
        setLayout(new BorderLayout());

        // --- 1. 右侧预览区域 ---
        plasmidPanel = new PlasmidPanel_hand();
        plasmidPanel.setPreferredSize(new Dimension(800, 800));
        plasmidPanel.setColors(new Color(168, 230, 207), new Color(255, 180, 130))
                    .setExtractDistance(0.5).setInsertDistance(0.5);
        
        plasmidPanel.setRotationListener((newTop, newBot) -> {
            this.currentFragTop = newTop;
            this.currentFragBot = newBot;
        });

        JPanel rightContainer = new JPanel(new BorderLayout());
        rightContainer.setBorder(BorderFactory.createTitledBorder("3D 仿真预览 (向上/向下拉动鼠标控制)"));
        rightContainer.add(plasmidPanel, BorderLayout.CENTER);

        // --- 2. 左侧交互区域容器 ---
        cardLayout = new CardLayout();
        controlCards = new JPanel(cardLayout);

        // 步骤一布局
        JPanel step1Panel = new JPanel(new BorderLayout());
        circularSelector = new CircularGeneSelector(INITIAL_SEQ_TOP, INITIAL_SEQ_BOT);
        JButton cutBtn1 = new JButton(" 执行圆环切割 ");
        cutBtn1.setPreferredSize(new Dimension(0, 50));
        cutBtn1.addActionListener(e -> {
            circularSelector.performCut();
            // performCut 内部触发监听器 -> setupCallbacks -> handleStateTransition(1)
        });
        step1Panel.add(circularSelector, BorderLayout.CENTER);
        step1Panel.add(cutBtn1, BorderLayout.SOUTH);

        // 步骤二布局
        JPanel step2Panel = new JPanel(new BorderLayout());
        linearSelector = new GeneSegmentSelector(LINEAR_GENE_TOP, LINEAR_GENE_BOT);
        JButton cutBtn2 = new JButton(" 执行片段提取 ");
        cutBtn2.setPreferredSize(new Dimension(0, 50));
        cutBtn2.addActionListener(e -> {
            linearSelector.performCut();
            // performCut 内部触发监听器 -> setupCallbacks -> handleStateTransition(2)
        });
        step2Panel.add(linearSelector, BorderLayout.CENTER);
        step2Panel.add(cutBtn2, BorderLayout.SOUTH);

        controlCards.add(step1Panel, "STEP_1_CIRCULAR");
        controlCards.add(step2Panel, "STEP_2_LINEAR");

        JPanel mainSplitPanel = new JPanel(new GridLayout(1, 2, 20, 0));
        mainSplitPanel.add(controlCards);
        mainSplitPanel.add(rightContainer);
        add(mainSplitPanel, BorderLayout.CENTER);

        // --- 3. 底部控制栏 ---
        JPanel bottomBar = new JPanel(new FlowLayout(FlowLayout.CENTER, 30, 10));
        
        JButton resetBtn = new JButton(" 重置实验 (Reset) ");
        resetBtn.setPreferredSize(new Dimension(150, 40));
        resetBtn.addActionListener(e -> {
            plasmidPanel.resetSelfLigation(); 
            applyInitialState();
        });

        JButton rotateBtn = new JButton(" 旋转片段 (Rotate 180°) ");
        rotateBtn.setPreferredSize(new Dimension(180, 40));
        rotateBtn.setBackground(new Color(200, 220, 255));
        rotateBtn.addActionListener(e -> {
            double p = plasmidPanel.getProgress();
            boolean isAtTop = ("extract".equals(plasmidPanel.getMode()) && p > 0.7) || 
                              ("insert".equals(plasmidPanel.getMode()) && p < 0.3);
            if (isAtTop) {
                plasmidPanel.startRotationAnimation();
            } else {
                JOptionPane.showMessageDialog(this, "⚠️ 片段必须被拉拽到最上方位置才能旋转！");
            }
        });

        JButton ligateBtn = new JButton(" 检查并执行拼合 (Ligate) ");
        ligateBtn.setPreferredSize(new Dimension(200, 40));
        ligateBtn.setBackground(new Color(180, 255, 180)); 
        ligateBtn.addActionListener(e -> {
            executeLigationLogic();
        });

        bottomBar.add(resetBtn);
        bottomBar.add(rotateBtn);
        bottomBar.add(ligateBtn);
        add(bottomBar, BorderLayout.SOUTH);

        setupCallbacks();
        applyInitialState();
        setLocationRelativeTo(null);

        // 启动时的首次引导
        SwingUtilities.invokeLater(() -> {
            JOptionPane.showMessageDialog(this, 
                "【任务 1：选择切割位点】\n\n1. 请点击左侧圆环上的任意两个横杠 ( - ) 设定切割边界。\n2. 设定后点击下方的【执行圆环切割】。", 
                "实验引导", JOptionPane.INFORMATION_MESSAGE);
        });
    }

    private void executeLigationLogic() {
        double p = plasmidPanel.getProgress();
        String mode = plasmidPanel.getMode();
        boolean isDetached = ("extract".equals(mode) && p > 0.8) || ("insert".equals(mode) && p < 0.2);
        boolean isInserted = ("extract".equals(mode) && p < 0.2) || ("insert".equals(mode) && p > 0.8);

        if (isDetached) {
            String vTop = cleanSeq(vecLTop) + cleanSeq(vecRTop);
            String vBot = cleanSeq(vecLBot) + cleanSeq(vecRBot);
            if (isComplementary(vTop, vBot)) {
                plasmidPanel.startSelfLigationAnimation();
                JOptionPane.showMessageDialog(this, "🎉 自连成功！载体与片段已分别闭合。");
            } else {
                JOptionPane.showMessageDialog(this, "❌ 自连失败！末端碱基不互补。建议重置并重新选择切点。", "配对失败", JOptionPane.ERROR_MESSAGE);
            }
        } else if (isInserted) {
            String fullTop = cleanSeq(vecLTop) + cleanSeq(currentFragTop) + cleanSeq(vecRTop);
            String fullBot = cleanSeq(vecLBot) + cleanSeq(currentFragBot) + cleanSeq(vecRBot);
            if (isComplementary(fullTop, fullBot)) {
                plasmidPanel.setProgress("insert".equals(mode) ? 1.0 : 0.0);
                JOptionPane.showMessageDialog(this, "🎉 重组成功！片段已完美插入载体。");
            } else {
                JOptionPane.showMessageDialog(this, "❌ 嵌入失败！碱基无法配对。试试【旋转片段】或重新切取。", "配对冲突", JOptionPane.ERROR_MESSAGE);
            }
        } else {
            JOptionPane.showMessageDialog(this, "⚠️ 请将片段完全拉拽到【顶端】（查自环）或【缺口内】（查重组）！");
        }
    }

    private String cleanSeq(String seq) {
        if (seq == null) return "";
        return seq.replace("-", "").replace("5'", "").replace("3'", "").trim();
    }

    private boolean isComplementary(String top, String bot) {
        if (top.length() != bot.length() || top.isEmpty()) return false;
        for (int i = 0; i < top.length(); i++) {
            char t = top.charAt(i), b = bot.charAt(i);
            if (!((t=='A'&&b=='T')||(t=='T'&&b=='A')||(t=='C'&&b=='G')||(t=='G'&&b=='C'))) return false;
        }
        return true;
    }

    private void applyInitialState() {
        int mid = INITIAL_SEQ_TOP.length() / 2;
        vecLTop = INITIAL_SEQ_TOP.substring(0, mid); vecRTop = INITIAL_SEQ_TOP.substring(mid);
        vecLBot = INITIAL_SEQ_BOT.substring(0, mid); vecRBot = INITIAL_SEQ_BOT.substring(mid);
        currentFragTop = ""; currentFragBot = "";
        plasmidPanel.setSequences("", "", "5'-"+formatSeq(vecLTop)+"-", "3'-"+formatSeq(vecLBot)+"-", "-"+formatSeq(vecRTop)+"-3'", "-"+formatSeq(vecRBot)+"-5'");
        plasmidPanel.setStaticState("extract", 0.0);
        circularSelector.reset(); linearSelector.reset();
        cardLayout.show(controlCards, "STEP_1_CIRCULAR");
    }

    private void setupCallbacks() {
        circularSelector.setSelectionListener((row, l, m, r) -> {
            String[] tParts = circularSelector.getRowParts(0), bParts = circularSelector.getRowParts(1);
            if (tParts != null && bParts != null) {
                vecLTop = tParts[0]; vecLBot = bParts[0]; vecRTop = tParts[2]; vecRBot = bParts[2];
                currentFragTop = formatSeq(tParts[1]); currentFragBot = formatSeq(bParts[1]);
                plasmidPanel.setSequences(currentFragTop, currentFragBot, "5'-"+formatSeq(vecLTop)+"-", "3'-"+formatSeq(vecLBot)+"-", "-"+formatSeq(vecRTop)+"-3'", "-"+formatSeq(vecRBot)+"-5'");
                handleStateTransition(1);
            }
        });

        linearSelector.setSelectionListener((topParts, botParts) -> {
            if (topParts != null && botParts != null) {
                currentFragTop = formatSeq(topParts[1]); currentFragBot = formatSeq(botParts[1]);
                plasmidPanel.setSequences(currentFragTop, currentFragBot, "5'-"+formatSeq(vecLTop)+"-", "3'-"+formatSeq(vecLBot)+"-", "-"+formatSeq(vecRTop)+"-3'", "-"+formatSeq(vecRBot)+"-5'");
                handleStateTransition(2);
            }
        });
    }

    private String formatSeq(String s) {
        if (s == null || s.isEmpty()) return "";
        String base = s.replace("-", "");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < base.length(); i++) {
            sb.append(base.charAt(i));
            if (i < base.length() - 1) sb.append("-");
        }
        return sb.toString();
    }

    private void handleStateTransition(int targetState) {
        if (targetState == 1) {
            plasmidPanel.setMode("extract");
            // 补充弹窗引导
            JOptionPane.showMessageDialog(this, 
                "【载体已成功切割】\n\n【下一步引导】：\n1. 请在右侧预览区【按住鼠标向上拖动】，将片段彻底拔出。\n2. 拔出后左侧将切换至片段制备界面。", 
                "任务更新", JOptionPane.INFORMATION_MESSAGE);
            
            Timer t = new Timer(500, e -> cardLayout.show(controlCards, "STEP_2_LINEAR"));
            t.setRepeats(false); t.start();

        } else if (targetState == 2) {
            plasmidPanel.setMode("insert");
            // 补充弹窗引导
            JOptionPane.showMessageDialog(this, 
                "【线性目标基因已提取】\n\n【下一步引导】：\n1. 片段目前悬浮在预览区上方。\n2. 请【按住鼠标向下拖动】，尝试将它嵌入载体缺口。\n3. 点击底部的【检查并执行拼合】进行验证。", 
                "任务更新", JOptionPane.INFORMATION_MESSAGE);
        }
    }

    public static void main(String[] args) {
        try { UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName()); } catch(Exception e){}
        SwingUtilities.invokeLater(() -> new MainApp_hand().setVisible(true));
    }
}