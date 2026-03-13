import java.awt.*;
import javax.swing.*;

public class MainApp extends JFrame {
    private PlasmidPanel plasmidPanel;
    private CircularGeneSelector circularSelector;
    private GeneSegmentSelector linearSelector;
    private JPanel controlCards; 
    private CardLayout cardLayout;
    
    private final String INITIAL_SEQ_TOP = "ATGCGTAATAGC";
    private final String INITIAL_SEQ_BOT = "TACGCCTGATCG";
    private final String LINEAR_GENE_TOP = "GGATCCAAAAAGGTACC"; 
    private final String LINEAR_GENE_BOT = "CCTAGGTTTTTCCATGG";

    private String vecLTop, vecLBot, vecRTop, vecRBot;

    public MainApp() {
        setTitle("基因克隆全流程仿真交互系统 - Dashboard");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(1600, 900); 
        setLayout(new BorderLayout());

        // --- 1. 右侧预览区域 ---
        plasmidPanel = new PlasmidPanel();
        plasmidPanel.setPreferredSize(new Dimension(800, 800));
        plasmidPanel.setColors(new Color(168, 230, 207), new Color(255, 180, 130))
                    .setExtractDistance(0.4).setInsertDistance(0.4)
                    .setShowCutLine(false);
        
        JPanel rightContainer = new JPanel(new BorderLayout());
        rightContainer.setBorder(BorderFactory.createTitledBorder("3D 仿真预览 (Preview)"));
        rightContainer.add(plasmidPanel, BorderLayout.CENTER);

        // --- 2. 左侧交互区域容器 ---
        cardLayout = new CardLayout();
        controlCards = new JPanel(cardLayout);
        controlCards.setBorder(BorderFactory.createTitledBorder("交互操作区 (Interaction)"));

        // --- 步骤一：圆环面板组件 ---
        JPanel step1Panel = new JPanel(new BorderLayout());
        circularSelector = new CircularGeneSelector(INITIAL_SEQ_TOP, INITIAL_SEQ_BOT);
        JButton cutBtn1 = new JButton(" 执行圆环切割 (Perform Circular Cut) ");
        cutBtn1.setPreferredSize(new Dimension(0, 50));
        cutBtn1.setFont(new Font("SansSerif", Font.BOLD, 15));
        cutBtn1.addActionListener(e -> circularSelector.performCut()); // 触发内部逻辑
        step1Panel.add(circularSelector, BorderLayout.CENTER);
        step1Panel.add(cutBtn1, BorderLayout.SOUTH);

        // --- 步骤二：直线面板组件 ---
        JPanel step2Panel = new JPanel(new BorderLayout());
        linearSelector = new GeneSegmentSelector(LINEAR_GENE_TOP, LINEAR_GENE_BOT);
        JButton cutBtn2 = new JButton(" 执行片段提取 (Perform Fragment Cut) ");
        cutBtn2.setPreferredSize(new Dimension(0, 50));
        cutBtn2.setFont(new Font("SansSerif", Font.BOLD, 15));
        cutBtn2.addActionListener(e -> linearSelector.performCut()); // 触发内部逻辑
        step2Panel.add(linearSelector, BorderLayout.CENTER);
        step2Panel.add(cutBtn2, BorderLayout.SOUTH);

        controlCards.add(step1Panel, "STEP_1_CIRCULAR");
        controlCards.add(step2Panel, "STEP_2_LINEAR");

        // --- 3. 布局组装 ---
        JPanel mainSplitPanel = new JPanel(new GridLayout(1, 2, 20, 0));
        mainSplitPanel.add(controlCards);
        mainSplitPanel.add(rightContainer);
        add(mainSplitPanel, BorderLayout.CENTER);

        // 底部重置按钮
        JPanel bottomBar = new JPanel(new FlowLayout(FlowLayout.CENTER));
        JButton resetBtn = new JButton(" 重置实验 (Reset) ");
        resetBtn.setPreferredSize(new Dimension(150, 40));
        resetBtn.addActionListener(e -> applyInitialState());
        bottomBar.add(resetBtn);
        add(bottomBar, BorderLayout.SOUTH);

        setupCallbacks();
        applyInitialState();
        setLocationRelativeTo(null);
    }

    private void applyInitialState() {
        int midPoint = INITIAL_SEQ_TOP.length() / 2;
        String leftHalfTop = INITIAL_SEQ_TOP.substring(0, midPoint);
        String rightHalfTop = INITIAL_SEQ_TOP.substring(midPoint);
        String leftHalfBot = INITIAL_SEQ_BOT.substring(0, midPoint);
        String rightHalfBot = INITIAL_SEQ_BOT.substring(midPoint);

        vecLTop = leftHalfTop; vecLBot = leftHalfBot;
        vecRTop = rightHalfTop; vecRBot = rightHalfBot;

        plasmidPanel.setSequences(
            "", "", 
            "5'-" + formatSeq(leftHalfTop) + "-", 
            "3'-" + formatSeq(leftHalfBot) + "-", 
            "-" + formatSeq(rightHalfTop) + "-3'", 
            "-" + formatSeq(rightHalfBot) + "-5'"
        );
        plasmidPanel.setStaticState("extract", 0.0);

        circularSelector.reset();
        linearSelector.reset();
        cardLayout.show(controlCards, "STEP_1_CIRCULAR");
    }

    private void setupCallbacks() {
        // 圆环剪切：现在此回调由 circularSelector.performCut() 触发
        circularSelector.setSelectionListener((row, left, mid, right) -> {
            // 我们需要拿到当前行以及另一行的完整切分，以同步更新右侧动画
            // 默认以当前操作的行作为基准，同时获取两行数据
            String[] tParts = circularSelector.getRowParts(0);
            String[] bParts = circularSelector.getRowParts(1);
            
            if (tParts != null && bParts != null) {
                // 更新存储的骨架
                vecLTop = tParts[0]; vecLBot = bParts[0];
                vecRTop = tParts[2]; vecRBot = bParts[2];

                plasmidPanel.setSequences(
                    formatSeq(tParts[1]), formatSeq(bParts[1]), 
                    "5'-" + formatSeq(vecLTop) + "-", "3'-" + formatSeq(vecLBot) + "-", 
                    "-" + formatSeq(vecRTop) + "-3'", "-" + formatSeq(vecRBot) + "-5'"
                );
                handleStateTransition(1);
            }
        });

        // 直线连结：由此回调由 linearSelector.performCut() 触发
        linearSelector.setSelectionListener((topParts, botParts) -> {
            // topParts/botParts 格式均为 [left, mid, right]
            if (topParts != null && botParts != null) {
                plasmidPanel.setSequences(
                    formatSeq(topParts[1]), formatSeq(botParts[1]), 
                    "5'-" + formatSeq(vecLTop) + "-", "3'-" + formatSeq(vecLBot) + "-", 
                    "-" + formatSeq(vecRTop) + "-3'", "-" + formatSeq(vecRBot) + "-5'"
                );
                handleStateTransition(2);
            }
        });
    }

    private String formatSeq(String cleanSeq) {
        if (cleanSeq == null || cleanSeq.isEmpty()) return "";
        String base = cleanSeq.replace("-", "");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < base.length(); i++) {
            sb.append(base.charAt(i));
            if (i < base.length() - 1) sb.append("-");
        }
        return sb.toString();
    }

    private void handleStateTransition(int targetState) {
        if (targetState == 1) {
            plasmidPanel.playExtraction(2000);
            Timer t = new Timer(2500, e -> cardLayout.show(controlCards, "STEP_2_LINEAR"));
            t.setRepeats(false);
            t.start();
        } else if (targetState == 2) {
            plasmidPanel.playInsertion(2000);
        }
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> new MainApp().setVisible(true));
    }
}