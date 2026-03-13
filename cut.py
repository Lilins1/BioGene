import os
import glob
import matplotlib
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import numpy as np
from matplotlib.patches import Wedge
import re

class PlasmidCutVisualizer:
    """
    质粒切割可视化引擎 (Plasmid Cut Visualizer) - 终极大满贯版
    保留了所有原有功能，新增了圆弧与直线互相形变的 Extraction 和 Insertion 动画。
    """
    
    def __init__(self, use_chinese=True):
        if use_chinese:
            self._setup_fonts()
        
        self.config = {
            "left_enzyme_name": "Enzyme 1",
            "right_enzyme_name": "Enzyme 2",
            "show_cut_line": True,
            "arrow": True,
            
            "frag_top": "", "frag_bot": "",
            "vec_L_top": "", "vec_L_bot": "",
            "vec_R_top": "", "vec_R_bot": "",
            
            "deg_per_token": 3.0,
            "center_theta": 90.0,
            "save_path": "auto_plasmid.png",
            "anim_path": "plasmid_split.gif"
        }

    def _setup_fonts(self):
        cache_dir = matplotlib.get_cachedir()
        for f in glob.glob(os.path.join(cache_dir, 'fontlist*.json')):
            try: os.remove(f)
            except: pass
        plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei', 'sans-serif']
        plt.rcParams['axes.unicode_minus'] = False

    def update_config(self, new_config):
        self.config.update(new_config)

    def _get_tokens(self, text):
        regex = r"5'|3'|\.{2,}|."
        return re.findall(regex, text)

    # =========================================================
    # 模块 1：基础绘图原语 (保留原有，支持 render 和 animate)
    # =========================================================
    def _place_sequence_anchored(self, ax, text, radius, edge_angle, align_dir=-1, anchor='start', ox=0, oy=0):
        deg = self.config["deg_per_token"]
        tokens = self._get_tokens(text)
        n = len(tokens)
        offset = deg / 2.0 
        
        if anchor == 'start': start_theta = edge_angle + offset * align_dir
        elif anchor == 'end': start_theta = edge_angle - (n - 1) * deg * align_dir - offset * align_dir
            
        angles = [start_theta + i * deg * align_dir for i in range(n)]
        for token, angle in zip(tokens, angles):
            rad = np.deg2rad(angle)
            x = radius * np.cos(rad) + ox
            y = radius * np.sin(rad) + oy
            rot = angle - 90
            if rot < -90 or rot > 90: rot += 180
            ax.text(x, y, token, ha='center', va='center', rotation=rot, fontsize=11, fontweight='bold', color='black')

    def _draw_ring_layer(self, ax, radius, width, theta1, theta2, color, ox=0, oy=0):
        ax.add_patch(
            Wedge((ox, oy), radius, theta1, theta2, width=width, color=color, alpha=0.7, linewidth=0)
        )
        
    def _draw_z_cut_line(self, ax, angle_outer, angle_inner, r_outer, r_mid, r_inner, ox=0, oy=0):
        if not self.config.get("show_cut_line", True): return
            
        def pts(r, a): return r * np.cos(np.deg2rad(a)) + ox, r * np.sin(np.deg2rad(a)) + oy
        x1, y1 = pts(r_outer, angle_outer); x2, y2 = pts(r_mid, angle_outer)
        ax.plot([x1, x2], [y1, y2], color='red', lw=2, linestyle='--')
        
        t_start, t_end = min(angle_outer, angle_inner), max(angle_outer, angle_inner)
        theta = np.linspace(np.deg2rad(t_start), np.deg2rad(t_end), 20)
        ax.plot(r_mid * np.cos(theta) + ox, r_mid * np.sin(theta) + oy, color='red', lw=2, linestyle='--')
        
        x3, y3 = pts(r_mid, angle_inner); x4, y4 = pts(r_inner, angle_inner)
        ax.plot([x3, x4], [y3, y4], color='red', lw=2, linestyle='--')

    def _add_auto_annotation(self, ax, angle, text, color, r_edge, ox=0, oy=0):
        rad = np.deg2rad(angle)
        x_target = r_edge * np.cos(rad) + ox
        y_target = r_edge * np.sin(rad) + oy
        x_text = 1.35 * np.cos(rad) + ox
        y_text = 1.35 * np.sin(rad) + oy
        ha_val = 'right' if x_text - ox < 0 else 'left'
        
        arrow_shrink = 0.05 if self.config.get("show_cut_line", True) else 0.0
        ax.annotate(text, xy=(x_target, y_target), xytext=(x_text, y_text),
                    arrowprops=dict(facecolor=color, shrink=arrow_shrink, width=1.5, headwidth=8),
                    fontsize=12, color=color, ha=ha_val, va='center', fontweight='bold')

    def _calculate_angles(self):
        cfg = self.config
        deg = cfg["deg_per_token"]
        span_outer = len(self._get_tokens(cfg["frag_top"])) * deg
        center = cfg["center_theta"]
        
        c_L_out = center + span_outer / 2.0
        c_R_out = center - span_outer / 2.0
        
        L_off = len(self._get_tokens(cfg["vec_L_bot"])) - len(self._get_tokens(cfg["vec_L_top"]))
        R_off = len(self._get_tokens(cfg["vec_R_top"])) - len(self._get_tokens(cfg["vec_R_bot"]))
        
        c_L_in = c_L_out - L_off * deg
        c_R_in = c_R_out - R_off * deg
        return c_L_out, c_L_in, c_R_out, c_R_in

    # =========================================================
    # 模块 2：形变拓扑数学引擎 (新增，用于弧形变直线)
    # =========================================================
    def _morph_point(self, r, theta_deg, t, dist, r_ref):
        """将极坐标平滑展开为笛卡尔直线坐标"""
        rad = np.deg2rad(theta_deg)
        rad_mid = np.deg2rad(self.config["center_theta"])
        
        x_arc = r * np.cos(rad)
        y_arc = r * np.sin(rad)
        
        s = r_ref * (rad_mid - rad)
        x_line = r * np.cos(rad_mid) + s * np.sin(rad_mid)
        y_line = r * np.sin(rad_mid) - s * np.cos(rad_mid)
        
        x = (1 - t) * x_arc + t * x_line + dist * np.cos(rad_mid)
        y = (1 - t) * y_arc + t * y_line + dist * np.sin(rad_mid)
        return x, y

    def _get_text_angles(self, text, edge_angle, align_dir=-1, anchor='start'):
        deg = self.config["deg_per_token"]
        tokens = self._get_tokens(text)
        n = len(tokens)
        offset = deg / 2.0 
        
        if anchor == 'start': start_theta = edge_angle + offset * align_dir
        elif anchor == 'end': start_theta = edge_angle - (n - 1) * deg * align_dir - offset * align_dir
        return [(token, start_theta + i * deg * align_dir) for i, token in enumerate(tokens)]

    def _draw_morphed_layer(self, ax, r1, r2, theta1, theta2, color, t, dist, r_ref):
        thetas = np.linspace(theta1, theta2, 50)
        pts_outer = [self._morph_point(r2, th, t, dist, r_ref) for th in thetas]
        pts_inner = [self._morph_point(r1, th, t, dist, r_ref) for th in thetas[::-1]]
        poly = np.array(pts_outer + pts_inner)
        ax.fill(poly[:,0], poly[:,1], color=color, alpha=0.7, edgecolor='none')

    def _draw_morphed_z_cut(self, ax, angle_outer, angle_inner, r_outer, r_mid, r_inner, t, dist):
        if not self.config.get("show_cut_line", True): return
        pts = [
            self._morph_point(r_outer, angle_outer, t, dist, r_mid),
            self._morph_point(r_mid, angle_outer, t, dist, r_mid),
            self._morph_point(r_mid, angle_inner, t, dist, r_mid),
            self._morph_point(r_inner, angle_inner, t, dist, r_mid)
        ]
        for i in range(len(pts)-1):
            ax.plot([pts[i][0], pts[i+1][0]], [pts[i][1], pts[i+1][1]], color='red', lw=2, linestyle='--')

    def _draw_morphed_text(self, ax, text, radius, edge_angle, align_dir, anchor, t, dist, r_ref):
        token_angles = self._get_text_angles(text, edge_angle, align_dir, anchor)
        center_th = self.config["center_theta"]
        
        for token, theta in token_angles:
            x, y = self._morph_point(radius, theta, t, dist, r_ref)
            rot_arc = theta - 90
            rot_line = center_th - 90
            rot = (1 - t) * rot_arc + t * rot_line
            if rot < -90 or rot > 90: rot += 180
            ax.text(x, y, token, ha='center', va='center', rotation=rot, fontsize=11, fontweight='bold', color='black')

    def _draw_morphed_annotation(self, ax, angle, text, color, r_edge, t, dist, r_ref):
        x_target, y_target = self._morph_point(r_edge, angle, t, dist, r_ref)
        x_text, y_text = self._morph_point(1.35, angle, t, dist, r_ref)
        center_rad = np.deg2rad(self.config["center_theta"])
        dx = x_text - (dist * np.cos(center_rad))
        ha_val = 'right' if dx < 0 else 'left'
        
        arrow_shrink = 0.05 if self.config.get("show_cut_line", True) else 0.0
        ax.annotate(text, xy=(x_target, y_target), xytext=(x_text, y_text),
                    arrowprops=dict(facecolor=color, shrink=arrow_shrink, width=1.5, headwidth=8),
                    fontsize=12, color=color, ha=ha_val, va='center', fontweight='bold')

    # =========================================================
    # 模块 3：四大渲染接口
    # =========================================================
    def render(self):
        """1. 生成左右两张图的静态版本 (保留)"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(20, 10), facecolor='white')
        cfg = self.config
        
        r_out_e = 1.0; w = 0.15; r_mid = r_out_e - w; r_in_e = r_mid - w  
        r_out_t = r_out_e - w / 2; r_in_t = r_mid - w / 2
        c_L_o, c_L_i, c_R_o, c_R_i = self._calculate_angles()

        ax1.set_aspect('equal'); ax1.axis('off'); ax1.set_xlim(-1.4, 1.4); ax1.set_ylim(-1.4, 1.4)
        ax1.set_title("剩余的主质粒骨架 (Vector)", pad=20, fontsize=16, fontweight='bold')
        self._draw_ring_layer(ax1, r_out_e, w, c_L_o, 360 + c_R_o, '#AAE4CA')
        self._draw_ring_layer(ax1, r_mid, w, c_L_i, 360 + c_R_i, '#AAE4CA')
        self._draw_z_cut_line(ax1, c_L_o, c_L_i, r_out_e, r_mid, r_in_e)
        self._draw_z_cut_line(ax1, c_R_o, c_R_i, r_out_e, r_mid, r_in_e)
        self._place_sequence_anchored(ax1, cfg["vec_L_top"], r_out_t, c_L_o, align_dir=-1, anchor='end')
        self._place_sequence_anchored(ax1, cfg["vec_L_bot"], r_in_t, c_L_i, align_dir=-1, anchor='end')
        self._place_sequence_anchored(ax1, cfg["vec_R_top"], r_out_t, c_R_o, align_dir=-1, anchor='start')
        self._place_sequence_anchored(ax1, cfg["vec_R_bot"], r_in_t, c_R_i, align_dir=-1, anchor='start')

        ax2.set_aspect('equal'); ax2.axis('off'); ax2.set_xlim(-1.4, 1.4); ax2.set_ylim(-1.4, 1.4)
        ax2.set_title("切下的目标片段", pad=20, fontsize=16, fontweight='bold')
        self._draw_ring_layer(ax2, r_out_e, w, c_R_o, c_L_o, '#F8C3B7')
        self._draw_ring_layer(ax2, r_mid, w, c_R_i, c_L_i, '#F8C3B7')
        self._draw_z_cut_line(ax2, c_L_o, c_L_i, r_out_e, r_mid, r_in_e)
        self._draw_z_cut_line(ax2, c_R_o, c_R_i, r_out_e, r_mid, r_in_e)
        self._place_sequence_anchored(ax2, cfg["frag_top"], r_out_t, c_L_o, align_dir=-1, anchor='start')
        self._place_sequence_anchored(ax2, cfg["frag_bot"], r_in_t, c_L_i, align_dir=-1, anchor='start')
        if cfg.get("arrow", True):
            self._add_auto_annotation(ax2, c_L_o, cfg["left_enzyme_name"], 'darkred', r_out_e)
            self._add_auto_annotation(ax2, c_R_o, cfg["right_enzyme_name"], 'darkblue', r_out_e)

        plt.tight_layout()
        plt.savefig(cfg["save_path"], dpi=300, bbox_inches='tight')
        print(f"[成功] 静态图谱已保存至 -> {cfg['save_path']}")
        plt.close(fig)

    def animate(self, frames=60, interval=50):
        """2. 生成简单平移漂移的动画 (保留)"""
        fig, ax = plt.subplots(figsize=(12, 12), facecolor='white')
        cfg = self.config
        
        r_out_e = 1.0; w = 0.15; r_mid = r_out_e - w; r_in_e = r_mid - w  
        r_out_t = r_out_e - w / 2; r_in_t = r_mid - w / 2
        c_L_o, c_L_i, c_R_o, c_R_i = self._calculate_angles()

        def update(frame):
            ax.clear()
            ax.set_aspect('equal'); ax.axis('off')
            ax.set_xlim(-2.0, 2.0); ax.set_ylim(-2.0, 2.0)
            ax.set_title("Plasmid Digestion (Simple Drift)", pad=20, fontsize=18, fontweight='bold')

            progress = frame / float(frames - 1)
            if progress < 0.2: dist = 0
            elif progress > 0.8: dist = 0.8  
            else: dist = 0.8 * ((progress - 0.2) / 0.6)

            center_rad = np.deg2rad(cfg["center_theta"])
            ox = dist * np.cos(center_rad); oy = dist * np.sin(center_rad)

            self._draw_ring_layer(ax, r_out_e, w, c_L_o, 360 + c_R_o, '#AAE4CA')
            self._draw_ring_layer(ax, r_mid, w, c_L_i, 360 + c_R_i, '#AAE4CA')
            self._draw_z_cut_line(ax, c_L_o, c_L_i, r_out_e, r_mid, r_in_e)
            self._draw_z_cut_line(ax, c_R_o, c_R_i, r_out_e, r_mid, r_in_e)
            self._place_sequence_anchored(ax, cfg["vec_L_top"], r_out_t, c_L_o, align_dir=-1, anchor='end')
            self._place_sequence_anchored(ax, cfg["vec_L_bot"], r_in_t, c_L_i, align_dir=-1, anchor='end')
            self._place_sequence_anchored(ax, cfg["vec_R_top"], r_out_t, c_R_o, align_dir=-1, anchor='start')
            self._place_sequence_anchored(ax, cfg["vec_R_bot"], r_in_t, c_R_i, align_dir=-1, anchor='start')

            self._draw_ring_layer(ax, r_out_e, w, c_R_o, c_L_o, "#FEB6F4", ox, oy)
            self._draw_ring_layer(ax, r_mid, w, c_R_i, c_L_i, '#F8C3B7', ox, oy)
            self._draw_z_cut_line(ax, c_L_o, c_L_i, r_out_e, r_mid, r_in_e, ox, oy)
            self._draw_z_cut_line(ax, c_R_o, c_R_i, r_out_e, r_mid, r_in_e, ox, oy)
            self._place_sequence_anchored(ax, cfg["frag_top"], r_out_t, c_L_o, align_dir=-1, anchor='start', ox=ox, oy=oy)
            self._place_sequence_anchored(ax, cfg["frag_bot"], r_in_t, c_L_i, align_dir=-1, anchor='start', ox=ox, oy=oy)
            
            if cfg.get("arrow", True):
                self._add_auto_annotation(ax, c_L_o, cfg["left_enzyme_name"], 'darkred', r_out_e, ox, oy)
                self._add_auto_annotation(ax, c_R_o, cfg["right_enzyme_name"], 'darkblue', r_out_e, ox, oy)

        print("[处理中] 正在生成简单平移动画...")
        anim = animation.FuncAnimation(fig, update, frames=frames, interval=interval)
        anim.save(cfg["anim_path"], writer='pillow')
        print(f"[成功] 动画已保存至 -> {cfg['anim_path']}")
        plt.close(fig)

    def _run_morph_animation(self, frames, interval, save_path, mode="extract"):
        """内部形变动画主引擎"""
        fig, ax = plt.subplots(figsize=(12, 12), facecolor='white')
        cfg = self.config
        
        r_out_e = 1.0; w = 0.15; r_mid = r_out_e - w; r_in_e = r_mid - w  
        r_out_t = r_out_e - w / 2; r_in_t = r_mid - w / 2
        c_L_o, c_L_i, c_R_o, c_R_i = self._calculate_angles()

        def update(frame):
            ax.clear()
            ax.set_aspect('equal'); ax.axis('off')
            ax.set_xlim(-2.0, 2.0); ax.set_ylim(-2.0, 2.0)
            
            progress = frame / float(frames - 1)
            if progress < 0.1: p_val = 0.0
            elif progress > 0.9: p_val = 1.0
            else: p_val = (progress - 0.1) / 0.8
            
            # Smoothstep 缓动曲线
            p_smooth = p_val * p_val * (3 - 2 * p_val) 
            
            if mode == "extract":
                t_morph = p_smooth        
                dist = 0.8 * p_smooth     
                ax.set_title("Fragment Extraction & Unrolling", pad=20, fontsize=18, fontweight='bold')
            else:
                t_morph = 1.0 - p_smooth  
                dist = 0.8 * (1.0 - p_smooth) 
                ax.set_title("Fragment Insertion & Curving", pad=20, fontsize=18, fontweight='bold')

            # 画底座 (t=0, dist=0)
            self._draw_morphed_layer(ax, r_mid, r_out_e, c_L_o, 360 + c_R_o, '#AAE4CA', 0, 0, r_mid)
            self._draw_morphed_layer(ax, r_in_e, r_mid, c_L_i, 360 + c_R_i, '#AAE4CA', 0, 0, r_mid)
            self._draw_morphed_z_cut(ax, c_L_o, c_L_i, r_out_e, r_mid, r_in_e, 0, 0)
            self._draw_morphed_z_cut(ax, c_R_o, c_R_i, r_out_e, r_mid, r_in_e, 0, 0)
            
            self._draw_morphed_text(ax, cfg["vec_L_top"], r_out_t, c_L_o, -1, 'end', 0, 0, r_mid)
            self._draw_morphed_text(ax, cfg["vec_L_bot"], r_in_t, c_L_i, -1, 'end', 0, 0, r_mid)
            self._draw_morphed_text(ax, cfg["vec_R_top"], r_out_t, c_R_o, -1, 'start', 0, 0, r_mid)
            self._draw_morphed_text(ax, cfg["vec_R_bot"], r_in_t, c_R_i, -1, 'start', 0, 0, r_mid)

            # 画形变片段 (动态)
            self._draw_morphed_layer(ax, r_mid, r_out_e, c_R_o, c_L_o, '#F8C3B7', t_morph, dist, r_mid)
            self._draw_morphed_layer(ax, r_in_e, r_mid, c_R_i, c_L_i, '#F8C3B7', t_morph, dist, r_mid)
            self._draw_morphed_z_cut(ax, c_L_o, c_L_i, r_out_e, r_mid, r_in_e, t_morph, dist)
            self._draw_morphed_z_cut(ax, c_R_o, c_R_i, r_out_e, r_mid, r_in_e, t_morph, dist)
            
            self._draw_morphed_text(ax, cfg["frag_top"], r_out_t, c_L_o, -1, 'start', t_morph, dist, r_mid)
            self._draw_morphed_text(ax, cfg["frag_bot"], r_in_t, c_L_i, -1, 'start', t_morph, dist, r_mid)
            
            if cfg.get("arrow", True):
                self._draw_morphed_annotation(ax, c_L_o, cfg["left_enzyme_name"], 'darkred', r_out_e, t_morph, dist, r_mid)
                self._draw_morphed_annotation(ax, c_R_o, cfg["right_enzyme_name"], 'darkblue', r_out_e, t_morph, dist, r_mid)

        print(f"[处理中] 正在生成形变动画 {save_path} ...")
        anim = animation.FuncAnimation(fig, update, frames=frames, interval=interval)
        anim.save(save_path, writer='pillow')
        print(f"[成功] 动画已保存至 -> {save_path}")
        plt.close(fig)

    def animate_extraction(self, save_path="demo_extract.gif", frames=60, interval=40):
        """3. 新增：抽出与变直动画"""
        self._run_morph_animation(frames, interval, save_path, mode="extract")

    def animate_insertion(self, save_path="demo_insert.gif", frames=60, interval=40):
        """4. 新增：弯曲并插入动画"""
        self._run_morph_animation(frames, interval, save_path, mode="insert")

# ==========================================
# 测试运行
# ==========================================
if __name__ == "__main__":
    visualizer = PlasmidCutVisualizer()
    
    my_data = {
        "show_cut_line": False,
        "arrow": False,
        "left_enzyme_name": "BamHI",
        "right_enzyme_name": "HindIII",
        
        "frag_top": "A-G-C-T-T-   -Gene-   -G",
        "frag_bot": "A-   -Gene-   -C-C-T-A-G",
        
        "vec_L_top": "5'-G-",
        "vec_L_bot": "3'-C-C-T-A-G-",
        
        "vec_R_top": "-A-G-C-T-T-3'",
        "vec_R_bot": "-A-5'",
        
        "save_path": "demo_plasmid_static.png",
        "anim_path": "demo_plasmid_split.gif"
    }

    visualizer.update_config(my_data)
    
    # 1. 生成静态图
    visualizer.render()
    
    # 2. 生成简单平移动画 GIF 
    visualizer.animate(frames=60, interval=40)
    
    # 3. 动画：【抽出与变直】 
    visualizer.animate_extraction(save_path="demo_extract.gif", frames=60, interval=40)

    # 4. 动画：【弯曲并插入】
    visualizer.animate_insertion(save_path="demo_insert.gif", frames=60, interval=40)