#!/usr/bin/env python3
"""Apply the ResinDB UI/UX Pro Max README and validation-contract updates."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
VALIDATOR = ROOT / "scripts" / "validate-repository-docs.py"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} anchor is missing")
    if text.count(old) != 1:
        raise SystemExit(f"{label} anchor is not unique")
    return text.replace(old, new, 1)


def patch_readme() -> None:
    text = README.read_text(encoding="utf-8")
    start = text.index("## 十四张可复现功能图\n")
    end = text.index("## 项目结构\n", start)
    section = """## 十四张 UI/UX Pro Max 可复现功能图

本 README 的**十四张**功能图按照 [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) 与其[中文指南](https://github.com/bbylw/ui-ux-pro-max-skill-cn)的设计工作流重新构建，并通过仓库脚本确定性生成。

ResinDB 被归类为高密度科研材料信息学 Dashboard，采用：

- **Swiss Modernism 2.0 + Bento Grid + Accessible & Ethical + Dimensional Layering**；
- 密度 `8/10`、动效 `2/10`；
- 8pt 间距节奏、语义色、统一 2 px 线性 SVG 图标；
- 明确的标题层级、编号步骤和文字标签，避免仅依赖颜色表达含义；
- 高对比浅色数据产品风格，不使用装饰性霓虹光晕、随机渐变或 emoji 图标。

完整设计令牌、布局规则、无障碍合同和反模式清单见 [`docs/README_VISUAL_DESIGN_SYSTEM.md`](docs/README_VISUAL_DESIGN_SYSTEM.md)。

```bash
npm run visuals:generate
npm run visuals:check
```

生成器使用 Python 标准库，并自动检查：

- SVG XML 是否有效；
- `<title>`、`<desc>`、`<metadata>` 是否完整；
- `role="img"` 与 `aria-labelledby`；
- `data-design-system="resindb-uiux-pro-max-v1"`；
- README 是否只引用每张图一次且不存在断链；
- 图片是否与干净环境中的重新生成结果逐字节一致；
- README、`package.json`、视觉设计系统与验证合同是否一致；
- 正式 CI 是否执行文档、视觉资产与生产源码卫生检查；
- 仓库是否重新出现 patch、trigger、迁移或诊断残留。

架构 SVG 是说明性图示，不是运行截图。真实 Chromium PNG、原始日志和 Coverage HTML 作为 GitHub Actions artifact 限时保存，不会被伪装成仓库静态证据。

"""
    text = text[:start] + section + text[end:]
    text = replace_once(
        text,
        "│   ├── VALIDATION.md              # 验证合同与证据保留规则\n│   └── assets/                    # 14 张确定性 SVG",
        "│   ├── VALIDATION.md              # 验证合同与证据保留规则\n│   ├── README_VISUAL_DESIGN_SYSTEM.md # UI/UX Pro Max 视觉系统\n│   └── assets/                    # 14 张确定性 SVG",
        "README project-tree design-system entry",
    )
    README.write_text(text, encoding="utf-8")


def patch_validator() -> None:
    text = VALIDATOR.read_text(encoding="utf-8")
    text = replace_once(
        text,
        'VALIDATION = ROOT / "docs" / "VALIDATION.md"\nASSETS = ROOT / "docs" / "assets"',
        'VALIDATION = ROOT / "docs" / "VALIDATION.md"\nVISUAL_DESIGN_SYSTEM = ROOT / "docs" / "README_VISUAL_DESIGN_SYSTEM.md"\nASSETS = ROOT / "docs" / "assets"',
        "validator design-system constant",
    )
    text = replace_once(
        text,
        '        if not root.findall(f"{namespace}title") or not root.findall(f"{namespace}desc"):\n            fail(f"{filename}: missing title or desc")',
        '        if not root.findall(f"{namespace}title") or not root.findall(f"{namespace}desc"):\n            fail(f"{filename}: missing title or desc")\n        if not root.findall(f"{namespace}metadata"):\n            fail(f"{filename}: missing design-system metadata")\n        if root.attrib.get("data-design-system") != "resindb-uiux-pro-max-v1":\n            fail(f"{filename}: missing ResinDB UI/UX Pro Max design-system marker")',
        "validator SVG metadata contract",
    )
    design_function = '''\n\ndef validate_visual_design_system(readme_text: str) -> None:\n    if not VISUAL_DESIGN_SYSTEM.is_file():\n        fail("README visual design-system document is missing")\n    if "docs/README_VISUAL_DESIGN_SYSTEM.md" not in readme_text:\n        fail("README must link the visual design-system document")\n    design_text = VISUAL_DESIGN_SYSTEM.read_text(encoding="utf-8")\n    required = (\n        "UI/UX Pro Max",\n        "Swiss Modernism 2.0",\n        "Bento Grid",\n        "Accessible & Ethical",\n        "8-point",\n        "data-design-system=\\\"resindb-uiux-pro-max-v1\\\"",\n    )\n    missing = [value for value in required if value not in design_text]\n    if missing:\n        fail(f"README visual design system is incomplete: {missing}")\n'''
    anchor = "\n\ndef validate_version_and_scripts(readme_text: str, validation_text: str) -> None:\n"
    if "def validate_visual_design_system" not in text:
        if anchor not in text:
            raise SystemExit("validator function insertion anchor is missing")
        text = text.replace(anchor, design_function + anchor, 1)
    text = replace_once(
        text,
        "    validate_visual_inventory(readme_text)\n    validate_version_and_scripts(readme_text, validation_text)",
        "    validate_visual_inventory(readme_text)\n    validate_visual_design_system(readme_text)\n    validate_version_and_scripts(readme_text, validation_text)",
        "validator main design-system call",
    )
    text = replace_once(
        text,
        '        "version/scripts, source hygiene contract, durable evidence, CI contract and repository hygiene"',
        '        "version/scripts, UI/UX Pro Max visual system, source hygiene contract, durable evidence, CI contract and repository hygiene"',
        "validator success message",
    )
    forbidden_anchor = '    "docs/MIGRATION_v3.1.0.md",\n'
    forbidden_entries = (
        '    ".github/uiux-design-system-research-20260727.trigger",\n'
        '    ".github/workflows/uiux-design-system-research-20260727.yml",\n'
        '    ".github/uiux-readme-visual-redesign-20260727.trigger",\n'
        '    ".github/workflows/uiux-readme-visual-redesign-20260727.yml",\n'
        '    "scripts/apply-uiux-readme-visual-system.py",\n'
    )
    if '"scripts/apply-uiux-readme-visual-system.py"' not in text:
        if forbidden_anchor not in text:
            raise SystemExit("validator forbidden-path anchor is missing")
        text = text.replace(forbidden_anchor, forbidden_entries + forbidden_anchor, 1)
    VALIDATOR.write_text(text, encoding="utf-8")


def main() -> None:
    patch_readme()
    patch_validator()
    print("applied UI/UX Pro Max README visual-system documentation and validation contract")


if __name__ == "__main__":
    main()
