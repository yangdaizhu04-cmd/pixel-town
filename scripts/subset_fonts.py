#!/usr/bin/env python3
"""拾光小镇 · 字体子集化生成器

把 Fusion Pixel 12px 简体中文比例字体裁剪到「项目实际用到的字符」，
产物输出到 src/assets/fonts/（走 vite 打包内联，保持单文件离线），
不再在运行时引用大体积的整包 webfont。

用法（在 pixel-town 目录）：
    python scripts/subset_fonts.py
依赖：python + fonttools + brotli
说明：界面文案全部内联；运行时从接口/用户新输入的中文走系统字体兜底（连字渲染，观感一致）。

安全设计（防 CWE-22 路径穿越 / 命令注入）：
- 子集文件名不从 CSS 内容解析，而是枚举字体目录里的真实 .woff2 文件，再回 CSS 里找对应块；
- 每个文件名额外过白名单正则（杜绝 ../ 或绝对路径形态）；
- 写入前用 resolve()+is_relative_to() 校验目标仍在允许目录内；
- fontTools 子进程参数一律用独立列表元素（Path 对象直接传入）、显式 shell=False，
  不拼接任何 --opt=value 形态的命令字符串。
"""
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PKG = ROOT / "node_modules" / "@vp-tw" / "cjk-web-fonts-fusion-pixel-font"
CSS_REL = Path("dist") / "12px" / "proportional" / "zh_hans" / "Fusion-Pixel-12px-Proportional-Simplified-Chinese.css"
OUT_DIR = ROOT / "src" / "assets" / "fonts"
CHARS = ROOT / "scripts" / "chars.txt"

# 要收集字符的源码范围（界面文案所在）
SRC_GLOBS = ["src", "index.html"]

# 产物文件名白名单：字体子集文件只允许这种形态，任何 ../ 或路径分隔符都进不来
SAFE_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\.woff2")

def safe_out_path(name):
    """产物路径：先过白名单，再 resolve 并校验仍落在产物目录内，双保险防穿越。"""
    if not SAFE_NAME.fullmatch(name):
        raise SystemExit(f"拒绝可疑文件名: {name!r}")
    p = (OUT_DIR / name).resolve()
    if not p.is_relative_to(OUT_DIR.resolve()):
        raise SystemExit(f"路径越界，已拒绝: {name!r}")
    return p

def safe_text_path(p):
    """文本产物路径校验：resolve 后必须仍落在项目根内（与 safe_out_path 同一防线）。"""
    rp = p.resolve()
    if not rp.is_relative_to(ROOT.resolve()):
        raise SystemExit(f"路径越界，已拒绝: {p}")
    return rp

def collect_chars():
    seen = set()
    for base in SRC_GLOBS:
        abs_base = ROOT / base
        for dirpath, _dirs, files in os.walk(abs_base):
            for fn in files:
                if not fn.endswith((".js", ".jsx", ".ts", ".tsx", ".html", ".css")):
                    continue
                try:
                    text = (Path(dirpath) / fn).read_text(encoding="utf-8", errors="ignore")
                except OSError:
                    continue
                for ch in text:
                    if ch.isspace() or ord(ch) < 32:
                        continue
                    seen.add(ch)
    return "".join(sorted(seen, key=ord))

def parse(css_path):
    """把原始 CSS 里的 @font-face 块解析成 {chunkName: fullCss}。
    保留原有 unicode-range 等声明，只替换 src 里的文件名为子集名。"""
    css = Path(css_path).read_text(encoding="utf-8")
    blocks = re.findall(r"@font-face\s*{.*?}", css, re.S)
    out = {}
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
        out[name] = new_src
    return out

def subset_one(src, chars_path, out_path):
    """跑一次 fontTools 子集化：参数全部是独立列表元素（Path 直接传入），显式 shell=False。"""
    return subprocess.run(
        [sys.executable, "-m", "fontTools.subset",
         src,
         "--text-file", chars_path,
         "--output-file", out_path,
         "--flavor=woff2",
         "--drop-tables+=DSIG"],
        capture_output=True, text=True, shell=False)

def main():
    css_path = PKG / CSS_REL
    if not css_path.exists():
        print("找不到字体包 CSS，先 npm install")
        sys.exit(1)
    css_dir = css_path.parent
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    chars = collect_chars()
    chars_path = safe_text_path(CHARS)
    chars_path.write_text(chars, encoding="utf-8")
    print(f"收集到 {len(chars)} 个字符")

    blocks = parse(css_path)
    total_in = total_out = 0
    css_out = []
    # 文件名从磁盘枚举（不是从 CSS 内容解析）：目录里真实存在的 woff2 才处理
    for fn in sorted(os.listdir(css_dir)):
        if not fn.endswith(".woff2") or fn not in blocks:
            continue
        block = blocks[fn]
        src = css_dir / fn
        total_in += src.stat().st_size
        out_name = fn.replace(".woff2", ".subset.woff2")
        out_path = safe_out_path(out_name)
        print(" >", fn)
        r = subset_one(src, chars_path, out_path)
        if r.returncode != 0:
            print(r.stdout, r.stderr)
            sys.exit(1)
        total_out += out_path.stat().st_size
        css_out.append(block.replace(f"url(./{fn})", f"url(./{out_name})"))

    css_index = safe_text_path(OUT_DIR / "index.css")
    css_index.write_text(
        "/* 由 scripts/subset_fonts.py 生成：只含本项目用到的字符 */\n" + "\n".join(css_out) + "\n",
        encoding="utf-8")
    print(f"字体总大小: {total_in/1024:.0f} KB -> {total_out/1024:.0f} KB（-{(1-total_out/total_in)*100:.0f}%）")
    print(f"产物: {OUT_DIR}")

if __name__ == "__main__":
    main()
