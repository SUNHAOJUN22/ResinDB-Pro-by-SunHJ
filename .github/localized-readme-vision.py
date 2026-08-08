from __future__ import annotations

from html import escape
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CONFIG = {'repo': 'ResinDB-Pro-by-SunHJ', 'mode': 'resindb', 'paths': {'zh': 'docs/localized-vision/resindb-vision-zh.svg', 'en': 'docs/localized-vision/resindb-vision-en.svg'}, 'zh': {'eyebrow': 'RESINDB PRO · 材料数据与科学决策工作站', 'title': '从树脂数据到材料决策与科学可视化', 'subtitle': '数据合同 · 稳健统计 · 聚合物物理 · Worker 计算 · 可验证图表', 'vision_label': '项目愿景', 'vision': '把牌号、实验属性、模型、图表和证据组织成可解释材料研发工作流', 'vision_note': '关联不等于因果；代理不等于测量；模板不等于力场或实验认证。', 'formula_label': '核心材料计算合同', 'formula_rows': ['Dᴍ(x)=√[(x−μ)ᵀΣ⁻¹(x−μ)]   ·   η(γ̇)=η∞+(η₀−η∞)[1+(λγ̇)ᵃ]⁽ⁿ⁻¹⁾ᐟᵃ', 'Σy≈JΣθJᵀ+Σsample+Σmodel+Σtransfer   ·   PASS=finite∧visible∧labeled∧traceable'], 'cards': [{'title': '数据合同', 'subtitle': 'Schema · Unit · Provenance', 'formula': 'x=(v,u,T,standard,source)', 'formula_note': '属性不是裸数字', 'lines': ['版本与清单', '来源和证据等级', '严格有限标量']}, {'title': '稳健统计', 'subtitle': 'Correlation · KDE · Outlier', 'formula': 'rₛ=corr(rank x,rank y)', 'formula_note': '关联保持非因果', 'lines': ['Pearson/Spearman', '分位数与 KDE', 'Mahalanobis 审查']}, {'title': '聚合物物理', 'subtitle': 'Rheology · WLF · Prony', 'formula': 'η=η(γ̇,T)', 'formula_note': '模型附带适用域', 'lines': ['流变与温度平移', '松弛谱与黏弹', 'LAMMPS 输入模板']}, {'title': '科学计算 Worker', 'subtitle': 'Deterministic Compute', 'formula': 'H=SHA256(request∥backend∥result)', 'formula_note': '后端和回退可追踪', 'lines': ['PCA/GP/K-Means', 'Weibull/Sobol/MOO', 'WASM/Worker 证据']}, {'title': '图表与验收', 'subtitle': 'ECharts · Chromium · CI', 'formula': 'ready=finished∧pixels>0', 'formula_note': '拒绝空白数理图', 'lines': ['中文字体可用', '非空 Canvas', 'PNG 与 exact-tree']}], 'disclaimer': 'AI辅助概念设计 · 非科学数据 · 公式对应软件合同而非运行结果', 'footer': 'ResinDB Pro 3.2 · 中文材料研发愿景', 'accessible_title': 'ResinDB Pro 中文材料数据与科学可视化愿景图', 'accessible_desc': '从数据合同、稳健统计、聚合物物理、科学计算 Worker 到可验证图表的中文概念设计图。', 'readme_heading': '中文项目愿景图：从树脂数据到材料决策与科学可视化', 'readme_alt': 'ResinDB Pro 中文材料数据与科学决策架构', 'readme_note': '图中每个模块和公式对应当前数据、计算、Worker、ECharts 与验收代码；图本身不是树脂实验数据、牌号认证或力场验证结果。'}, 'en': {'eyebrow': 'RESINDB PRO · MATERIAL DATA AND SCIENTIFIC DECISION WORKSTATION', 'title': 'From Resin Data to Material Decisions and Scientific Visualization', 'subtitle': 'Data contracts · robust statistics · polymer physics · Worker computation · verifiable figures', 'vision_label': 'VISION', 'vision': 'Organize grades, experimental properties, models, figures and evidence into an explainable R&D workflow', 'vision_note': 'Association is not causation; a proxy is not a measurement; a template is not force-field validation.', 'formula_label': 'CORE MATERIAL-COMPUTATION CONTRACTS', 'formula_rows': ['Dᴍ(x)=√[(x−μ)ᵀΣ⁻¹(x−μ)]   ·   η(γ̇)=η∞+(η₀−η∞)[1+(λγ̇)ᵃ]⁽ⁿ⁻¹⁾ᐟᵃ', 'Σy≈JΣθJᵀ+Σsample+Σmodel+Σtransfer   ·   PASS=finite∧visible∧labeled∧traceable'], 'cards': [{'title': 'Data contract', 'subtitle': 'Schema · Unit · Provenance', 'formula': 'x=(v,u,T,standard,source)', 'formula_note': 'a property is not a bare number', 'lines': ['version & manifest', 'source/evidence class', 'strict finite scalar']}, {'title': 'Robust statistics', 'subtitle': 'Correlation · KDE · Outlier', 'formula': 'rₛ=corr(rank x,rank y)', 'formula_note': 'association remains non-causal', 'lines': ['Pearson/Spearman', 'quantiles and KDE', 'Mahalanobis review']}, {'title': 'Polymer physics', 'subtitle': 'Rheology · WLF · Prony', 'formula': 'η=η(γ̇,T)', 'formula_note': 'models retain domains', 'lines': ['rheology and shift', 'relaxation/viscoelasticity', 'LAMMPS input templates']}, {'title': 'Compute Workers', 'subtitle': 'Deterministic Compute', 'formula': 'H=SHA256(request∥backend∥result)', 'formula_note': 'backend/fallback evidence', 'lines': ['PCA/GP/K-Means', 'Weibull/Sobol/MOO', 'WASM/Worker evidence']}, {'title': 'Figures & acceptance', 'subtitle': 'ECharts · Chromium · CI', 'formula': 'ready=finished∧pixels>0', 'formula_note': 'blank figures are rejected', 'lines': ['font readiness', 'non-blank Canvas', 'PNG and exact-tree']}], 'disclaimer': 'AI-ASSISTED CONCEPTUAL DESIGN · NOT SCIENTIFIC DATA', 'footer': 'ResinDB Pro 3.2 · English material-R&D vision', 'accessible_title': 'ResinDB Pro English material data and scientific visualization vision', 'accessible_desc': 'English conceptual design from data contracts and robust statistics through polymer physics and compute Workers to verifiable scientific figures.', 'readme_heading': 'Project vision: from resin data to material decisions and scientific visualization', 'readme_alt': 'ResinDB Pro English material data and scientific decision architecture', 'readme_note': 'Every module and equation maps to current data, compute, Worker, ECharts and acceptance code. The figure is not resin test data, grade certification or force-field validation.'}}

FONT = "Inter,'Noto Sans SC','Noto Sans CJK SC','Microsoft YaHei','PingFang SC','WenQuanYi Micro Hei','Segoe UI',Arial,sans-serif"
MATH_FONT = "'STIX Two Math','Cambria Math','Noto Sans Math','Noto Sans SC',serif"


def text(value: object) -> str:
    return escape(str(value), quote=True)


def render_svg(spec: dict[str, object]) -> str:
    cards = list(spec['cards'])
    colors = ['#22d3ee', '#818cf8', '#c084fc', '#34d399', '#fbbf24']
    x_positions = [78, 370, 662, 954, 1246]
    card_markup: list[str] = []
    for index, card in enumerate(cards):
        x = x_positions[index]
        color = colors[index]
        lines = list(card['lines'])
        formula = card['formula']
        card_markup.append(f'''<g transform="translate({x} 250)" filter="url(#shadow)">
  <rect width="250" height="390" rx="26" fill="#0d2034" stroke="{color}" stroke-width="2"/>
  <circle cx="42" cy="42" r="23" fill="{color}"/><text x="42" y="48" text-anchor="middle" class="step">{index + 1}</text>
  <text x="24" y="93" class="card-title">{text(card['title'])}</text>
  <text x="24" y="124" class="card-sub">{text(card['subtitle'])}</text>
  <rect x="20" y="151" width="210" height="76" rx="15" fill="#081522" stroke="#334155"/>
  <text x="125" y="184" text-anchor="middle" class="formula-small">{text(formula)}</text>
  <text x="125" y="207" text-anchor="middle" class="micro">{text(card['formula_note'])}</text>
  <circle cx="34" cy="274" r="6" fill="{color}"/><text x="51" y="280" class="body">{text(lines[0])}</text>
  <circle cx="34" cy="316" r="6" fill="{color}"/><text x="51" y="322" class="body">{text(lines[1])}</text>
  <circle cx="34" cy="358" r="6" fill="{color}"/><text x="51" y="364" class="body">{text(lines[2])}</text>
</g>''')
    arrows = [f'<path d="M{x} 445h28" stroke="#94a3b8" stroke-width="4"/><path d="M{x+28} 445l-12-8v16z" fill="#94a3b8"/>' for x in [330, 622, 914, 1206]]
    formula_rows = list(spec['formula_rows'])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
<title id="title">{text(spec['accessible_title'])}</title><desc id="desc">{text(spec['accessible_desc'])}</desc>
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06121f"/><stop offset="0.55" stop-color="#10233f"/><stop offset="1" stop-color="#1f2554"/></linearGradient><radialGradient id="halo" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#22d3ee" stop-opacity=".30"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#020617" flood-opacity=".42"/></filter><pattern id="grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38 0H0V38" fill="none" stroke="#dbeafe" stroke-opacity=".055"/></pattern><style>text{{font-family:{FONT}}}.eyebrow{{font-size:17px;letter-spacing:3.5px;font-weight:800;fill:#67e8f9}}.title{{font-size:50px;font-weight:850;fill:#f8fafc}}.subtitle{{font-size:21px;fill:#cbd5e1}}.vision{{font-size:18px;font-weight:700;fill:#dbeafe}}.card-title{{font-size:23px;font-weight:800;fill:#f8fafc}}.card-sub{{font-size:15px;fill:#9fb1c8}}.body{{font-size:15px;fill:#d5deea}}.micro{{font-size:12px;fill:#8ea2ba}}.step{{font-size:15px;font-weight:900;fill:#07111f}}.formula{{font-family:{MATH_FONT};font-size:22px;fill:#e0f2fe}}.formula-small{{font-family:{MATH_FONT};font-size:17px;fill:#f0f9ff}}.disclaimer{{font-size:12px;font-weight:850;letter-spacing:1.1px;fill:#111827}}</style></defs>
<rect width="1600" height="900" fill="url(#bg)"/><rect width="1600" height="900" fill="url(#grid)"/><ellipse cx="800" cy="188" rx="610" ry="190" fill="url(#halo)"/>
<g transform="translate(78 54)"><text class="eyebrow">{text(spec['eyebrow'])}</text><text class="title" y="63">{text(spec['title'])}</text><text class="subtitle" y="105">{text(spec['subtitle'])}</text></g>
<g transform="translate(1030 68)" filter="url(#shadow)"><rect width="490" height="104" rx="24" fill="#0a1829" stroke="#334155"/><text x="24" y="36" class="vision">{text(spec['vision_label'])}</text><text x="24" y="70" class="formula-small">{text(spec['vision'])}</text><text x="24" y="92" class="micro">{text(spec['vision_note'])}</text></g>
{''.join(card_markup)}{''.join(arrows)}
<g transform="translate(78 686)" filter="url(#shadow)"><rect width="1444" height="128" rx="25" fill="#091827" stroke="#334155"/><text x="24" y="34" class="vision">{text(spec['formula_label'])}</text><text x="24" y="68" class="formula">{text(formula_rows[0])}</text><text x="24" y="100" class="formula">{text(formula_rows[1])}</text></g>
<g transform="translate(78 842)"><rect width="640" height="28" rx="14" fill="#f8fafc" opacity=".95"/><text x="320" y="19" text-anchor="middle" class="disclaimer">{text(spec['disclaimer'])}</text><text x="1440" y="20" text-anchor="end" class="micro">{text(spec['footer'])}</text></g></svg>'''


def localized_block(language: str, image_path: str, spec: dict[str, object]) -> str:
    marker = f'LOCALIZED_VISION_{language.upper()}'
    return f'''<!-- {marker}:START -->
## {spec['readme_heading']}

<p align="center">
  <img src="{image_path}" width="100%" alt="{spec['readme_alt']}">
</p>

> {spec['readme_note']}

<!-- {marker}:END -->'''


def write_resindb_localized(path: Path, language: str, image_path: str, spec: dict[str, object]) -> None:
    if language == 'zh':
        body = '''## 平台定位

ResinDB Pro 把树脂牌号、实验/参考属性、统计模型、科学计算 Worker、聚合物物理模板和可重复验收放进同一条证据链。它不是经认证的 LIMS、ERP、材料放行系统或已验证力场平台。

## 数理核心

$$
D_M(\mathbf x)=\sqrt{(\mathbf x-\boldsymbol\mu)^\mathsf T\Sigma^{-1}(\mathbf x-\boldsymbol\mu)}
$$

$$
\eta(\dot\gamma)=\eta_\infty+(\eta_0-\eta_\infty)\left[1+(\lambda\dot\gamma)^a\right]^{(n-1)/a}
$$

$$
\Sigma_y\approx J\Sigma_\theta J^\mathsf T+\Sigma_{sample}+\Sigma_{model}+\Sigma_{transfer}
$$

## 使用策略

1. 先校验数据 Schema、单位、标准、温度、来源和证据等级。
2. 只对有限且量纲一致的数据执行统计、拟合和材料筛选。
3. 区分观测值、拟合值、代理量和情景预测。
4. 聚合物或 LAMMPS 模板必须经外部力场、平衡态和实验验证后才能形成科学结论。
5. 中文界面与科研图表必须通过 CJK 字体、ECharts 完成事件、非空 Canvas 和 PNG 证据门。

## 验收

```bash
npm ci
npm run validate:docs
npm run validate:i18n-visuals
npm run validate:scientific-ui
npm run typecheck
npm run test:unit
npm run build
npm run test:ui
```
'''
        header = '# ResinDB Pro by SunHJ — 中文设计版\n\n[English design edition](README.en.md) · [双语完整技术文档](README.md)\n\n'
    else:
        body = '''## Positioning

ResinDB Pro joins resin grades, experimental/reference properties, statistical models, scientific-compute Workers, polymer-physics templates and reproducible acceptance in one evidence chain. It is not a certified LIMS, ERP, material-release system or validated force-field platform.

## Mathematical core

$$
D_M(\mathbf x)=\sqrt{(\mathbf x-\boldsymbol\mu)^\mathsf T\Sigma^{-1}(\mathbf x-\boldsymbol\mu)}
$$

$$
\eta(\dot\gamma)=\eta_\infty+(\eta_0-\eta_\infty)\left[1+(\lambda\dot\gamma)^a\right]^{(n-1)/a}
$$

$$
\Sigma_y\approx J\Sigma_\theta J^\mathsf T+\Sigma_{sample}+\Sigma_{model}+\Sigma_{transfer}
$$

## Operating strategy

1. Validate Schema, units, standards, temperature, provenance and evidence class first.
2. Run statistics, fitting and material screening only on finite, dimensionally compatible data.
3. Keep observations, fits, proxies and scenario projections distinct.
4. Polymer/LAMMPS templates require external force-field, equilibration and experimental validation before supporting scientific conclusions.
5. Scientific figures must pass font readiness, ECharts completion, non-blank Canvas and PNG evidence gates.

## Acceptance

```bash
npm ci
npm run validate:docs
npm run validate:i18n-visuals
npm run validate:scientific-ui
npm run typecheck
npm run test:unit
npm run build
npm run test:ui
```
'''
        header = '# ResinDB Pro by SunHJ — English Design Edition\n\n[中文设计版](README.zh-CN.md) · [Complete bilingual technical documentation](README.md)\n\n'
    path.write_text(header + localized_block(language, image_path, spec) + '\n\n' + body, encoding='utf-8', newline='\n')


def patch_resindb_validator() -> None:
    path = ROOT / 'scripts' / 'validate-i18n-visuals.mjs'
    source = path.read_text(encoding='utf-8')
    old = "function readmeLocalImages() {\n  const readme = readUtf8(join(ROOT, 'README.md'));\n  return [...readme.matchAll(/!\\[[^\\n]*?\\]\\(([^)\\n]+)\\)/gu)]\n    .map((match) => match[1].trim().split(/[?#]/u, 1)[0])\n    .filter((target) => target && !/^(?:https?:|data:)/u.test(target));\n}\n"
    new = "function readmeLocalImages() {\n  const readmePaths = ['README.md', 'README.zh-CN.md', 'README.en.md'];\n  return readmePaths.flatMap((relativePath) => {\n    const readme = readUtf8(join(ROOT, relativePath));\n    return [...readme.matchAll(/!\\[[^\\n]*?\\]\\(([^)\\n]+)\\)/gu)]\n      .map((match) => match[1].trim().split(/[?#]/u, 1)[0])\n      .filter((target) => target && !/^(?:https?:|data:)/u.test(target));\n  });\n}\n"
    if old not in source:
        raise RuntimeError('ResinDB i18n visual README scanner anchor is missing')
    source = source.replace(old, new, 1)
    old_files = "  join(ROOT, 'README.md'),\n  join(ROOT, 'package.json'),\n"
    new_files = "  join(ROOT, 'README.md'),\n  join(ROOT, 'README.zh-CN.md'),\n  join(ROOT, 'README.en.md'),\n  join(ROOT, 'package.json'),\n"
    if old_files not in source:
        raise RuntimeError('ResinDB i18n visual text-file anchor is missing')
    path.write_text(source.replace(old_files, new_files, 1), encoding='utf-8', newline='\n')


def main() -> None:
    for language in ('zh', 'en'):
        svg_path = ROOT / CONFIG['paths'][language]
        svg_path.parent.mkdir(parents=True, exist_ok=True)
        svg_path.write_text(render_svg(CONFIG[language]), encoding='utf-8', newline='\n')
        parsed = ET.parse(svg_path).getroot()
        raw = svg_path.read_text(encoding='utf-8')
        if not parsed.tag.endswith('svg') or not parsed.attrib.get('viewBox') or '\ufffd' in raw or '<script' in raw.lower():
            raise RuntimeError(f'{svg_path}: invalid or unsafe SVG')
    write_resindb_localized(ROOT / 'README.zh-CN.md', 'zh', CONFIG['paths']['zh'], CONFIG['zh'])
    write_resindb_localized(ROOT / 'README.en.md', 'en', CONFIG['paths']['en'], CONFIG['en'])
    root_readme = ROOT / 'README.md'
    root_text = root_readme.read_text(encoding='utf-8')
    marker = '<!-- LOCALIZED_README_LINKS -->'
    links = f'''{marker}\n<p align="center"><strong><a href="README.zh-CN.md">中文设计版</a> · <a href="README.en.md">English design edition</a></strong></p>'''
    if marker in root_text:
        root_text = re.sub(r'<!-- LOCALIZED_README_LINKS -->.*?</p>', links, root_text, count=1, flags=re.DOTALL)
    else:
        root_text = root_text.replace('# ResinDB Pro by SunHJ', '# ResinDB Pro by SunHJ\n\n' + links, 1)
    root_readme.write_text(root_text, encoding='utf-8', newline='\n')
    patch_resindb_validator()
    for path, image in [(ROOT / 'README.zh-CN.md', CONFIG['paths']['zh']), (ROOT / 'README.en.md', CONFIG['paths']['en'])]:
        if image not in path.read_text(encoding='utf-8'):
            raise RuntimeError(f'{path}: localized image reference missing')
    print('localized README vision generated for ResinDB-Pro-by-SunHJ')


if __name__ == '__main__':
    main()
