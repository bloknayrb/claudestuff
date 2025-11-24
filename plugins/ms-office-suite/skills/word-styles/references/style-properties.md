# Style Properties Reference

Complete property reference for paragraph and character formatting in Microsoft Word styles.

## Table of Contents

1. [Paragraph Properties](#paragraph-properties)
2. [Character Properties](#character-properties)
3. [Units and Conversions](#units-and-conversions)
4. [OOXML Element Order](#ooxml-element-order)

## Paragraph Properties

### Alignment

| Property | python-docx | OOXML | Values |
|----------|-------------|-------|--------|
| Alignment | `paragraph_format.alignment` | `<w:jc w:val="..."/>` | `left`, `center`, `right`, `both` (justify), `distribute` |

```python
from docx.enum.text import WD_ALIGN_PARAGRAPH
pf.alignment = WD_ALIGN_PARAGRAPH.LEFT      # left
pf.alignment = WD_ALIGN_PARAGRAPH.CENTER    # center
pf.alignment = WD_ALIGN_PARAGRAPH.RIGHT     # right
pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY   # both
pf.alignment = WD_ALIGN_PARAGRAPH.DISTRIBUTE  # distribute
```

### Indentation

| Property | python-docx | OOXML | Units |
|----------|-------------|-------|-------|
| Left indent | `paragraph_format.left_indent` | `<w:ind w:left="..."/>` | twips (1/20 point) |
| Right indent | `paragraph_format.right_indent` | `<w:ind w:right="..."/>` | twips |
| First line | `paragraph_format.first_line_indent` | `<w:ind w:firstLine="..."/>` | twips |
| Hanging | `paragraph_format.first_line_indent` (negative) | `<w:ind w:hanging="..."/>` | twips |

```python
from docx.shared import Inches, Pt, Twips
pf.left_indent = Inches(0.5)        # 720 twips
pf.first_line_indent = Inches(0.5)  # First line indent
pf.first_line_indent = Inches(-0.5) # Hanging indent
```

```xml
<w:ind w:left="720" w:right="0" w:firstLine="720"/>
<w:ind w:left="720" w:hanging="360"/>  <!-- Hanging indent -->
```

### Spacing

| Property | python-docx | OOXML | Units |
|----------|-------------|-------|-------|
| Before | `paragraph_format.space_before` | `<w:spacing w:before="..."/>` | twips |
| After | `paragraph_format.space_after` | `<w:spacing w:after="..."/>` | twips |
| Line spacing | `paragraph_format.line_spacing` | `<w:spacing w:line="..."/>` | varies |
| Line rule | `paragraph_format.line_spacing_rule` | `<w:spacing w:lineRule="..."/>` | enum |

```python
from docx.enum.text import WD_LINE_SPACING
pf.space_before = Pt(12)
pf.space_after = Pt(8)
pf.line_spacing = 1.15  # Multiple (when rule is MULTIPLE)
pf.line_spacing = Pt(14)  # Exact (when rule is EXACTLY)
pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE  # auto, atLeast, exact
```

```xml
<w:spacing w:before="240" w:after="160" w:line="259" w:lineRule="auto"/>
<!-- lineRule: auto (multiple), atLeast (minimum), exact (exact) -->
<!-- line value for auto: 240 = single, 360 = 1.5, 480 = double, 259 = 1.08 -->
```

### Pagination Controls

| Property | python-docx | OOXML |
|----------|-------------|-------|
| Keep together | `paragraph_format.keep_together` | `<w:keepLines/>` |
| Keep with next | `paragraph_format.keep_with_next` | `<w:keepNext/>` |
| Page break before | `paragraph_format.page_break_before` | `<w:pageBreakBefore/>` |
| Widow control | `paragraph_format.widow_control` | `<w:widowControl/>` |

```python
pf.keep_together = True   # Don't split paragraph across pages
pf.keep_with_next = True  # Keep with following paragraph
pf.page_break_before = True  # Start on new page
pf.widow_control = True   # Avoid orphan/widow lines
```

### Outline Level (for TOC)

| Property | python-docx | OOXML |
|----------|-------------|-------|
| Outline level | Not directly supported | `<w:outlineLvl w:val="..."/>` |

```xml
<w:pPr>
  <w:outlineLvl w:val="0"/>  <!-- 0-8, where 0 = Heading 1 level -->
</w:pPr>
```

### Tabs

```python
from docx.shared import Inches
from docx.enum.text import WD_TAB_ALIGNMENT, WD_TAB_LEADER

tab_stops = pf.tab_stops
tab_stops.add_tab_stop(Inches(1.5), WD_TAB_ALIGNMENT.LEFT)
tab_stops.add_tab_stop(Inches(3.0), WD_TAB_ALIGNMENT.CENTER)
tab_stops.add_tab_stop(Inches(6.0), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
```

```xml
<w:tabs>
  <w:tab w:val="left" w:pos="2160"/>
  <w:tab w:val="center" w:pos="4320"/>
  <w:tab w:val="right" w:leader="dot" w:pos="8640"/>
</w:tabs>
```

## Character Properties

### Font Name

| Property | python-docx | OOXML |
|----------|-------------|-------|
| ASCII font | `font.name` | `<w:rFonts w:ascii="..."/>` |
| High ANSI | `font.name` | `<w:rFonts w:hAnsi="..."/>` |
| East Asian | Not directly | `<w:rFonts w:eastAsia="..."/>` |
| Complex Script | `font.cs_bold`, etc. | `<w:rFonts w:cs="..."/>` |

```python
font.name = 'Calibri'  # Sets both ascii and hAnsi
```

```xml
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="MS Gothic" w:cs="Arial"/>
```

### Font Size

| Property | python-docx | OOXML | Units |
|----------|-------------|-------|-------|
| Size | `font.size` | `<w:sz w:val="..."/>` | half-points |
| Complex script size | `font.cs_size` | `<w:szCs w:val="..."/>` | half-points |

```python
from docx.shared import Pt
font.size = Pt(11)  # Converts to 22 half-points
```

```xml
<w:sz w:val="22"/>    <!-- 11pt -->
<w:szCs w:val="22"/>  <!-- Complex script size -->
```

### Font Style

| Property | python-docx | OOXML |
|----------|-------------|-------|
| Bold | `font.bold` | `<w:b/>` |
| Bold (CS) | `font.cs_bold` | `<w:bCs/>` |
| Italic | `font.italic` | `<w:i/>` |
| Italic (CS) | `font.cs_italic` | `<w:iCs/>` |

```python
font.bold = True
font.italic = True
```

```xml
<w:b/><w:bCs/>  <!-- Bold -->
<w:i/><w:iCs/>  <!-- Italic -->
```

### Underline

| Property | python-docx | OOXML |
|----------|-------------|-------|
| Underline | `font.underline` | `<w:u w:val="..."/>` |

```python
from docx.enum.text import WD_UNDERLINE
font.underline = True  # Single underline
font.underline = WD_UNDERLINE.DOUBLE
font.underline = WD_UNDERLINE.DOTTED
font.underline = WD_UNDERLINE.WAVY
```

```xml
<w:u w:val="single"/>  <!-- single, double, dotted, dash, wave, etc. -->
```

### Color

| Property | python-docx | OOXML |
|----------|-------------|-------|
| RGB color | `font.color.rgb` | `<w:color w:val="..."/>` |
| Theme color | `font.color.theme_color` | `<w:color w:themeColor="..."/>` |
| Highlight | `font.highlight_color` | `<w:highlight w:val="..."/>` |

```python
from docx.shared import RGBColor
from docx.enum.dml import MSO_THEME_COLOR
from docx.enum.text import WD_COLOR_INDEX

font.color.rgb = RGBColor(0x2E, 0x74, 0xB5)
font.color.theme_color = MSO_THEME_COLOR.ACCENT_1
font.highlight_color = WD_COLOR_INDEX.YELLOW
```

```xml
<w:color w:val="2E74B5"/>
<w:color w:themeColor="accent1"/>
<w:color w:themeColor="accent1" w:themeShade="BF"/>  <!-- With shade -->
<w:highlight w:val="yellow"/>
```

### Text Effects

| Property | python-docx | OOXML |
|----------|-------------|-------|
| Strike | `font.strike` | `<w:strike/>` |
| Double strike | `font.double_strike` | `<w:dstrike/>` |
| Subscript | `font.subscript` | `<w:vertAlign w:val="subscript"/>` |
| Superscript | `font.superscript` | `<w:vertAlign w:val="superscript"/>` |
| All caps | `font.all_caps` | `<w:caps/>` |
| Small caps | `font.small_caps` | `<w:smallCaps/>` |
| Hidden | `font.hidden` | `<w:vanish/>` |

```python
font.strike = True
font.subscript = True
font.all_caps = True
font.small_caps = True
font.hidden = True
```

### Character Spacing

| Property | python-docx | OOXML |
|----------|-------------|-------|
| Kerning | Not directly | `<w:kern w:val="..."/>` |
| Spacing/expansion | Not directly | `<w:spacing w:val="..."/>` |
| Position | Not directly | `<w:position w:val="..."/>` |

```xml
<w:kern w:val="28"/>  <!-- Kern at 14pt and above (half-points) -->
<w:spacing w:val="20"/>  <!-- Expanded by 1pt (twips) -->
<w:position w:val="6"/>  <!-- Raised 3pt (half-points) -->
```

## Units and Conversions

| Unit | Description | Conversion |
|------|-------------|------------|
| Twips | 1/20 of a point | 1440 twips = 1 inch |
| Half-points | 1/2 of a point | 2 half-points = 1 pt |
| EMUs | English Metric Units | 914400 EMUs = 1 inch |
| Points | Typography points | 72 points = 1 inch |

```python
from docx.shared import Pt, Inches, Twips, Emu

# python-docx handles conversions
Pt(12)      # 12 points
Inches(1)   # 1 inch = 72 points = 914400 EMUs
Twips(720)  # 720 twips = 0.5 inch
```

## OOXML Element Order

Elements in `<w:pPr>` must follow this order:

1. `<w:pStyle/>`
2. `<w:keepNext/>`
3. `<w:keepLines/>`
4. `<w:pageBreakBefore/>`
5. `<w:widowControl/>`
6. `<w:numPr/>`
7. `<w:tabs/>`
8. `<w:spacing/>`
9. `<w:ind/>`
10. `<w:jc/>`
11. `<w:outlineLvl/>`
12. `<w:rPr/>` (always last)

Elements in `<w:rPr>` must follow this order:

1. `<w:rStyle/>`
2. `<w:rFonts/>`
3. `<w:b/>`, `<w:bCs/>`
4. `<w:i/>`, `<w:iCs/>`
5. `<w:caps/>`
6. `<w:smallCaps/>`
7. `<w:strike/>`
8. `<w:dstrike/>`
9. `<w:vanish/>`
10. `<w:color/>`
11. `<w:spacing/>`
12. `<w:kern/>`
13. `<w:position/>`
14. `<w:sz/>`, `<w:szCs/>`
15. `<w:highlight/>`
16. `<w:u/>`
17. `<w:vertAlign/>`
