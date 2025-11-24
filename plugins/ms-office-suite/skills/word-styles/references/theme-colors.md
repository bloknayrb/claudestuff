# Theme Colors Reference

Guide to Microsoft Word theme colors, fonts, and tint/shade calculations.

## Table of Contents

1. [Theme Structure](#theme-structure)
2. [Theme Colors](#theme-colors)
3. [Theme Fonts](#theme-fonts)
4. [Tint and Shade](#tint-and-shade)
5. [Applying Theme Colors](#applying-theme-colors)
6. [python-docx Theme Support](#python-docx-theme-support)

## Theme Structure

Theme definitions live in `word/theme/theme1.xml`. The theme controls:

- Color scheme (12 semantic colors)
- Font scheme (major/minor fonts)
- Format scheme (effects, fills, lines)

```xml
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <!-- Color definitions -->
    </a:clrScheme>
    <a:fontScheme name="Office">
      <!-- Font definitions -->
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <!-- Format definitions -->
    </a:fmtScheme>
  </a:themeElements>
</a:theme>
```

## Theme Colors

### The 12 Theme Colors

| Theme Color | Typical Use | OOXML Name |
|-------------|-------------|------------|
| dk1 | Dark 1 (text) | `dk1` |
| lt1 | Light 1 (background) | `lt1` |
| dk2 | Dark 2 | `dk2` |
| lt2 | Light 2 | `lt2` |
| accent1 | Accent 1 | `accent1` |
| accent2 | Accent 2 | `accent2` |
| accent3 | Accent 3 | `accent3` |
| accent4 | Accent 4 | `accent4` |
| accent5 | Accent 5 | `accent5` |
| accent6 | Accent 6 | `accent6` |
| hlink | Hyperlink | `hlink` |
| folHlink | Followed hyperlink | `folHlink` |

### Office Theme Default Colors

| Color | RGB Value | Hex |
|-------|-----------|-----|
| dk1 | Black | #000000 |
| lt1 | White | #FFFFFF |
| dk2 | Dark gray | #44546A |
| lt2 | Light gray | #E7E6E6 |
| accent1 | Blue | #4472C4 |
| accent2 | Orange | #ED7D31 |
| accent3 | Gray | #A5A5A5 |
| accent4 | Gold | #FFC000 |
| accent5 | Blue (light) | #5B9BD5 |
| accent6 | Green | #70AD47 |
| hlink | Blue | #0563C1 |
| folHlink | Purple | #954F72 |

### Color Definition in theme1.xml

```xml
<a:clrScheme name="Office">
  <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
  <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
  <a:dk2><a:srgbClr val="44546A"/></a:dk2>
  <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
  <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
  <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
  <a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
  <a:accent4><a:srgbClr val="FFC000"/></a:accent4>
  <a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
  <a:accent6><a:srgbClr val="70AD47"/></a:accent6>
  <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
  <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
</a:clrScheme>
```

## Theme Fonts

### Font Scheme Structure

```xml
<a:fontScheme name="Office">
  <a:majorFont>
    <a:latin typeface="Calibri Light"/>
    <a:ea typeface=""/>
    <a:cs typeface=""/>
    <!-- Script-specific fonts -->
  </a:majorFont>
  <a:minorFont>
    <a:latin typeface="Calibri"/>
    <a:ea typeface=""/>
    <a:cs typeface=""/>
  </a:minorFont>
</a:fontScheme>
```

### Major vs Minor Fonts

| Type | Typical Use | Default |
|------|-------------|---------|
| Major | Headings, titles | Calibri Light |
| Minor | Body text | Calibri |

### Referencing Theme Fonts in Styles

```xml
<!-- In styles.xml -->
<w:rFonts w:asciiTheme="majorHAnsi" w:hAnsiTheme="majorHAnsi"/>  <!-- Headings -->
<w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/>  <!-- Body -->
```

Theme font values:

| Value | Description |
|-------|-------------|
| majorAscii | Major font for ASCII |
| majorHAnsi | Major font for high ANSI |
| majorEastAsia | Major font for East Asian |
| majorBidi | Major font for bidirectional |
| minorAscii | Minor font for ASCII |
| minorHAnsi | Minor font for high ANSI |
| minorEastAsia | Minor font for East Asian |
| minorBidi | Minor font for bidirectional |

## Tint and Shade

### Concept

Tint and shade modify theme colors to create lighter/darker variants without defining new colors.

- **Tint** (themeTint) - Lighter variant (toward white)
- **Shade** (themeShade) - Darker variant (toward black)

### XML Syntax

```xml
<!-- Base theme color -->
<w:color w:themeColor="accent1"/>

<!-- 60% tint (lighter) -->
<w:color w:themeColor="accent1" w:themeTint="99"/>

<!-- 25% shade (darker) -->
<w:color w:themeColor="accent1" w:themeShade="BF"/>
```

### Calculation

Values are hex (00-FF) representing percentage:

| Hex Value | Percentage | Effect |
|-----------|------------|--------|
| FF | 100% | No change |
| BF | 75% | 25% darker |
| 80 | 50% | 50% darker |
| 40 | 25% | 75% darker |
| 00 | 0% | Fully black/white |

**Tint formula** (toward white):
```
result = base + (255 - base) * (tint / 255)
```

**Shade formula** (toward black):
```
result = base * (shade / 255)
```

### Common Tint/Shade Values

| Visual | Tint/Shade | Hex |
|--------|------------|-----|
| 80% lighter | themeTint | CC |
| 60% lighter | themeTint | 99 |
| 40% lighter | themeTint | 66 |
| 25% darker | themeShade | BF |
| 50% darker | themeShade | 80 |
| 75% darker | themeShade | 40 |

## Applying Theme Colors

### In Style Definitions (styles.xml)

```xml
<w:style w:type="paragraph" w:styleId="Heading1">
  <w:rPr>
    <w:color w:themeColor="accent1" w:themeShade="BF"/>
  </w:rPr>
</w:style>
```

### In Run Properties (document.xml)

```xml
<w:r>
  <w:rPr>
    <w:color w:themeColor="accent1"/>
  </w:rPr>
  <w:t>Themed text</w:t>
</w:r>
```

### Hyperlink Style Example

```xml
<w:style w:type="character" w:styleId="Hyperlink">
  <w:name w:val="Hyperlink"/>
  <w:rPr>
    <w:color w:themeColor="hyperlink"/>
    <w:u w:val="single"/>
  </w:rPr>
</w:style>
```

### Theme Color with Fallback

Include RGB fallback for compatibility:

```xml
<w:color w:val="4472C4" w:themeColor="accent1"/>
```

## python-docx Theme Support

### Reading Theme Colors

```python
from docx import Document
from docx.enum.dml import MSO_THEME_COLOR

doc = Document('file.docx')
style = doc.styles['Heading 1']

# Get theme color (if set)
theme_color = style.font.color.theme_color
if theme_color == MSO_THEME_COLOR.ACCENT_1:
    print("Using Accent 1")
```

### Setting Theme Colors

```python
from docx.enum.dml import MSO_THEME_COLOR

style = doc.styles['Heading 1']
style.font.color.theme_color = MSO_THEME_COLOR.ACCENT_1
```

### MSO_THEME_COLOR Enumeration

| Constant | Value | Theme Color |
|----------|-------|-------------|
| `ACCENT_1` | 5 | accent1 |
| `ACCENT_2` | 6 | accent2 |
| `ACCENT_3` | 7 | accent3 |
| `ACCENT_4` | 8 | accent4 |
| `ACCENT_5` | 9 | accent5 |
| `ACCENT_6` | 10 | accent6 |
| `BACKGROUND_1` | 14 | lt1 |
| `BACKGROUND_2` | 16 | lt2 |
| `DARK_1` | 1 | dk1 |
| `DARK_2` | 3 | dk2 |
| `FOLLOWED_HYPERLINK` | 12 | folHlink |
| `HYPERLINK` | 11 | hlink |
| `LIGHT_1` | 2 | lt1 |
| `LIGHT_2` | 4 | lt2 |
| `TEXT_1` | 13 | dk1 |
| `TEXT_2` | 15 | dk2 |

### Limitations

python-docx does not support:
- Tint/shade values (requires OOXML manipulation)
- Modifying theme definitions
- Reading actual RGB values from theme

For tint/shade, manipulate XML directly:

```python
from docx.oxml.ns import qn
from lxml import etree

# Access run properties element
rPr = run._r.get_or_add_rPr()

# Create color element with theme and tint
color = etree.SubElement(rPr, qn('w:color'))
color.set(qn('w:themeColor'), 'accent1')
color.set(qn('w:themeTint'), '99')  # 60% lighter
```
