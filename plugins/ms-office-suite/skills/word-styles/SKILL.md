---
name: word-styles
description: "Microsoft Word styles and formatting expertise for style-based document design. Use when working with: (1) Creating, modifying, or applying paragraph/character/linked styles, (2) Style inheritance and based-on relationships, (3) List and numbering style definitions, (4) Table styles with conditional formatting, (5) Theme colors and fonts, (6) Paragraph formatting (spacing, indentation, pagination), (7) Character formatting (fonts, effects, colors), (8) Converting direct formatting to styles, (9) Troubleshooting style conflicts or inheritance issues"
---

# Word Styles and Formatting

This skill provides deep expertise for style-based document formatting in Microsoft Word (.docx). Use styles instead of direct formatting for maintainable, consistent documents.

## Style Hierarchy (Override Order)

1. **Document defaults** (`docDefaults` in styles.xml) - Base formatting
2. **Style definition** - Named style properties
3. **Direct formatting** - Inline overrides on specific text

Understanding this hierarchy is essential for troubleshooting "why isn't my formatting applying?"

## Quick Reference

### Access Styles with python-docx

```python
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING

doc = Document('file.docx')

# Get existing style
style = doc.styles['Normal']
style = doc.styles['Heading 1']

# Create new paragraph style
new_style = doc.styles.add_style('CustomBody', WD_STYLE_TYPE.PARAGRAPH)
new_style.base_style = doc.styles['Normal']
new_style.font.name = 'Calibri'
new_style.font.size = Pt(11)

# Create character style
char_style = doc.styles.add_style('Emphasis', WD_STYLE_TYPE.CHARACTER)
char_style.font.italic = True
char_style.font.color.rgb = RGBColor(0x00, 0x00, 0x80)
```

### Common Paragraph Formatting

```python
from docx.shared import Pt, Twips

style = doc.styles['Normal']
pf = style.paragraph_format

# Spacing
pf.space_before = Pt(0)
pf.space_after = Pt(8)
pf.line_spacing = 1.15  # Multiple
pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE

# Indentation
pf.left_indent = Inches(0)
pf.right_indent = Inches(0)
pf.first_line_indent = Inches(0.5)  # First line indent
pf.first_line_indent = Inches(-0.5)  # Hanging indent (negative)

# Alignment
pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

# Pagination controls
pf.keep_together = True
pf.keep_with_next = True
pf.page_break_before = False
pf.widow_control = True
```

### Common Character Formatting

```python
style = doc.styles['Normal']
font = style.font

font.name = 'Calibri'
font.size = Pt(11)
font.bold = False
font.italic = False
font.underline = True  # or WD_UNDERLINE.SINGLE
font.color.rgb = RGBColor(0x00, 0x00, 0x00)
font.highlight_color = WD_COLOR_INDEX.YELLOW
font.all_caps = False
font.small_caps = False
font.strike = False
font.subscript = False
font.superscript = False
```

## Decision Tree

### When to Use Styles vs Direct Formatting

**Use styles when:**
- Formatting applies to multiple paragraphs/runs
- Document will be edited or maintained
- Consistency across document is required
- Creating templates

**Use direct formatting when:**
- One-off formatting exception
- Quick prototype/draft
- Overriding style for specific instance

### When to Modify vs Create New Style

**Modify existing style when:**
- Changing document-wide appearance
- Style name already describes purpose (e.g., making "Heading 1" blue)

**Create new style when:**
- Need distinct formatting for different purposes
- Want to preserve original style
- Style is based on another (inheritance)

## Working with Style Inheritance

### Based-on Relationships

```python
# Create style based on another
custom = doc.styles.add_style('CustomHeading', WD_STYLE_TYPE.PARAGRAPH)
custom.base_style = doc.styles['Heading 1']
custom.font.color.rgb = RGBColor(0x00, 0x66, 0x99)
# Inherits all Heading 1 properties except color
```

**Best practices:**
- Keep inheritance chains shallow (2-3 levels max)
- Only override properties that differ
- Test changes by applying style to sample text

### Next Paragraph Style

```python
# After pressing Enter, switch to Normal
doc.styles['Heading 1'].next_paragraph_style = doc.styles['Normal']

# After pressing Enter in list item, continue with same style
doc.styles['List Paragraph'].next_paragraph_style = doc.styles['List Paragraph']
```

## OOXML Direct Access

When python-docx lacks API support, access raw XML. First unpack the document:

```bash
python /mnt/skills/public/docx/ooxml/scripts/unpack.py document.docx unpacked/
```

### Style XML Structure (styles.xml)

```xml
<w:style w:type="paragraph" w:styleId="CustomBody">
  <w:name w:val="Custom Body"/>
  <w:basedOn w:val="Normal"/>
  <w:next w:val="Normal"/>
  <w:qFormat/>  <!-- Show in Quick Styles gallery -->
  <w:uiPriority w:val="1"/>
  <w:pPr>
    <w:spacing w:after="160" w:line="259" w:lineRule="auto"/>
    <w:ind w:firstLine="720"/>
    <w:jc w:val="both"/>
  </w:pPr>
  <w:rPr>
    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
    <w:sz w:val="22"/>  <!-- Half-points: 22 = 11pt -->
    <w:szCs w:val="22"/>
  </w:rPr>
</w:style>
```

### Style Types

| w:type value | Description |
|-------------|-------------|
| paragraph | Paragraph style (includes character props) |
| character | Character-only style |
| table | Table style |
| numbering | List/numbering style |

### Making Styles Visible in Word UI

Styles may be "latent" (hidden). To show them:

```xml
<w:latentStyles>
  <w:lsdException w:name="Custom Body" w:semiHidden="0" w:unhideWhenUsed="0"/>
</w:latentStyles>
```

Or set on the style itself:

```xml
<w:style w:type="paragraph" w:styleId="CustomBody">
  <w:qFormat/>  <!-- Add to Quick Styles -->
  <w:uiPriority w:val="1"/>  <!-- Sort order in gallery -->
</w:style>
```

## Common Patterns

### Professional Body Text Setup

```python
body = doc.styles['Normal']
body.font.name = 'Calibri'
body.font.size = Pt(11)
body.paragraph_format.space_after = Pt(8)
body.paragraph_format.line_spacing = 1.15
body.paragraph_format.widow_control = True
```

### Heading Hierarchy

```python
for i, (name, size) in enumerate([('Heading 1', 16), ('Heading 2', 14), ('Heading 3', 12)], 1):
    h = doc.styles[name]
    h.font.name = 'Calibri Light'
    h.font.size = Pt(size)
    h.font.bold = True
    h.font.color.rgb = RGBColor(0x2E, 0x74, 0xB5)
    h.paragraph_format.space_before = Pt(12)
    h.paragraph_format.space_after = Pt(4)
    h.paragraph_format.keep_with_next = True
```

### Block Quote Style

```python
quote = doc.styles.add_style('BlockQuote', WD_STYLE_TYPE.PARAGRAPH)
quote.base_style = doc.styles['Normal']
quote.font.italic = True
quote.paragraph_format.left_indent = Inches(0.5)
quote.paragraph_format.right_indent = Inches(0.5)
quote.paragraph_format.space_before = Pt(12)
quote.paragraph_format.space_after = Pt(12)
```

## Troubleshooting

### Style Not Applying

1. **Check direct formatting** - Select text, clear direct formatting (Ctrl+Space for character, Ctrl+Q for paragraph)
2. **Check inheritance** - Style may inherit conflicting property from base style
3. **Check document defaults** - `docDefaults` in styles.xml may override

### Inconsistent Formatting

1. **Multiple styles with same name** - Check for duplicates in styles.xml
2. **Latent style override** - Check latentStyles section
3. **Theme font substitution** - Document may use theme fonts that vary by system

### List Numbering Issues

See `references/numbering-lists.md` for numbering.xml structure and troubleshooting.

## Reference Files

- **`references/style-properties.md`** - Complete property reference for paragraph/character formatting with python-docx and OOXML equivalents
- **`references/numbering-lists.md`** - List and numbering definition patterns, abstractNum/num relationships
- **`references/theme-colors.md`** - Theme color system, tint/shade calculations

## Utility Scripts

- **`scripts/inspect_styles.py`** - Dump all styles from a document with properties and inheritance
- **`scripts/apply_style_template.py`** - Copy style definitions from template to target document

Usage:
```bash
python scripts/inspect_styles.py document.docx
python scripts/apply_style_template.py template.docx target.docx --styles "Heading 1,Normal"
```

## Dependencies

```bash
pip install python-docx --break-system-packages
```
