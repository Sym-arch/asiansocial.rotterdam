# -*- coding: utf-8 -*-
"""各HTMLが読み込むJSをまとめ、呼び出しているのに定義が無い関数を洗い出します。"""
import io, re, os, json

ROOT = '.'
BUILTINS = set("""
if for while switch catch return typeof function new delete void instanceof in of do else try finally
await async yield class extends super this throw case break continue let const var
Array Object String Number Boolean Date Math JSON Promise Map Set WeakMap RegExp Error TypeError
parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame fetch alert confirm prompt
console document window location history navigator localStorage sessionStorage crypto URL URLSearchParams
Intl Symbol BigInt Proxy Reflect queueMicrotask structuredClone atob btoa CustomEvent Event FormData
Headers Request Response AbortController Blob File FileReader Image matchMedia getComputedStyle
""".split())

def scripts_of(html):
    s = io.open(html, encoding='utf-8').read()
    return re.findall(r'<script src="([^"]+)"', s)

def defs_of(src):
    d = set()
    d |= set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)', src))
    d |= set(re.findall(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=', src))
    d |= set(re.findall(r'\bclass\s+([A-Za-z_$][\w$]*)', src))
    return d

def calls_of(src):
    # 行コメントとブロックコメントを雑に落としてから拾います
    src = re.sub(r'/\*.*?\*/', ' ', src, flags=re.S)
    src = re.sub(r'(?m)^\s*//.*$', ' ', src)
    out = set()
    for m in re.finditer(r'(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(', src):
        out.add(m.group(1))
    return out

problems = {}
for html in sorted(f for f in os.listdir(ROOT) if f.endswith('.html')):
    srcs = [s for s in scripts_of(html) if s.endswith('.js') and os.path.exists(s)]
    if not srcs: continue
    text = ''
    for s in srcs: text += io.open(s, encoding='utf-8').read() + '\n'
    defined = defs_of(text) | BUILTINS
    missing = sorted(c for c in calls_of(text) if c not in defined)
    if missing: problems[html] = {'scripts': srcs, 'missing': missing}

print(json.dumps(problems, ensure_ascii=False, indent=1))
