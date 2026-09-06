#!/usr/bin/env python3
"""拾光小镇 · 字体子集化生成器

把 Fusion Pixel 12px 简体中文比例字体裁剪到「项目实际用到的字符」，
产物输出到 src/assets/fonts/（走 vite 打包内联，保持单文件离线），
不再在运行时引用大体积的整包 webfont。

用法（在 pixel-town 目录）：
    python scripts/subset_fonts.py
依赖：python + fonttools + brotli
说明：界面文案全部内联；运行时从接口/用户新输入的中文走系统字体兜底（连字渲染，观感一致）。
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(ROOT, "node_modules", "@vp-tw", "cjk-web-fonts-fusion-pixel-font")
CSS_REL = os.path.join("dist", "12px", "proportional", "zh_hans",
                       "Fusion-Pixel-12px-Proportional-Simplified-Chinese.css")
OUT_DIR = os.path.join(ROOT, "src", "assets", "fonts")
CHARS = os.path.join(ROOT, "scripts", "chars.txt")

# 要收集字符的源码范围（界面文案所在）
SRC_GLOBS = [
    "src",
    "index.html",
]

def collect_chars():
    seen = set()
    for base in SRC_GLOBS:
        abs_base = os.path.join(ROOT, base)
        for dirpath, _dirs, files in os.walk(abs_base):
            for fn in files:
                if not fn.endswith((".js", ".jsx", ".ts", ".tsx", ".html", ".css")):
                    continue
                p = os.path.join(dirpath, fn)
                try:
                    text = open(p, "r", encoding="utf-8", errors="ignore").read()
                except OSError:
                    continue
                for ch in text:
                    cp = ord(ch)
                    # 跳过空白与控制字符
                    if ch.isspace() or cp < 32:
                        continue
                    seen.add(ch)
    return "".join(sorted(seen, key=ord))

def parse(css_path):
    """把原始 CSS 里的 @font-face 块解析成 (chunkName, fullCss)。
    保留原有 unicode-range 等声明，只替换 src 里的文件名为子集名。"""
    css = open(css_path, encoding="utf-8").read()
    blocks = re.findall(r"@font-face\s*{.*?}", css, re.S)
    out = []
    for b in blocks:
        m = re.search(r"url\(([^)]+)\)", b)
        if not m:
            continue
        name = os.path.basename(m.group(1))
        # 整个 src 的 url+format 一起替换成子集文件（原 CSS 尾部自带的 format 一并吞掉）
        new_src = re.sub(r"url\([^)]*\)\s*format\(\"woff2\"\)",
                         lambda _: f'url(./{name}) format("woff2")', b, count=1)
        if "font-display" not in new_src:
            new_src = new_src.rstrip("}") + " font-display: swap; }"
        out.append((name, new_src))
    return out

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(CHARS), exist_ok=True)
    css_path = os.path.join(PKG, CSS_REL)
    if not os.path.exists(css_path):
        print("找不到字体包 CSS，先 npm install")
        sys.exit(1)
    chars = collect_chars()
    with open(CHARS, "w", encoding="utf-8") as f:
        f.write(chars)
    print(f"收集到 {len(chars)} 个字符")
    blocks = parse(css_path)
    total_in = total_out = 0
    css_out = []
    for name, block in blocks:
        src = os.path.join(os.path.dirname(css_path), name)
        total_in += os.path.getsize(src)
        out_name = name.replace(".woff2", ".subset.woff2")
        out_path = os.path.join(OUT_DIR, out_name)
        pyftsubset = [sys.executable, "-m", "fontTools.subset"]
        cmd = pyftsubset + [src,
               f"--text-file={CHARS}",
               f"--output-file={out_path}",
               "--flavor=woff2",
               "--drop-tables+=DSIG"]
        print(" >", name)
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stdout, r.stderr)
            sys.exit(1)
        total_out += os.path.getsize(out_path)
        css_out.append(block.replace(f"url(./{name})", f"url(./{out_name})"))
    with open(os.path.join(OUT_DIR, "index.css"), "w", encoding="utf-8") as f:
        f.write("/* 由 scripts/subset_fonts.py 生成：只含本项目用到的字符 */\n")
        f.write("\n".join(css_out) + "\n")
    print(f"字体总大小: {total_in/1024:.0f} KB -> {total_out/1024:.0f} KB（-{(1-total_out/total_in)*100:.0f}%）")
    print(f"产物: {OUT_DIR}")

if __name__ == "__main__":
    main()