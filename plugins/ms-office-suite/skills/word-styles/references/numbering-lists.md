# List and Numbering Reference

Comprehensive guide to list styles and numbering definitions in Microsoft Word.

## Table of Contents

1. [Structure Overview](#structure-overview)
2. [AbstractNum Definitions](#abstractnum-definitions)
3. [Num Instances](#num-instances)
4. [Common Patterns](#common-patterns)
5. [python-docx List Operations](#python-docx-list-operations)
6. [Troubleshooting](#troubleshooting)

## Structure Overview

Word list numbering uses two related concepts in `numbering.xml`:

1. **AbstractNum** - Template defining list formatting (bullets, numbers, indentation)
2. **Num** - Instance that references an AbstractNum (allows multiple lists with same format)

```
numbering.xml
├── <w:abstractNum w:abstractNumId="0">  ← Template
│   └── <w:lvl w:ilvl="0">...</w:lvl>    ← Level definitions (0-8)
├── <w:abstractNum w:abstractNumId="1">
│   └── ...
├── <w:num w:numId="1">                   ← Instance referencing abstractNum
│   └── <w:abstractNumId w:val="0"/>
└── <w:num w:numId="2">
    └── <w:abstractNumId w:val="1"/>
```

Documents reference `numId` (not abstractNumId) in paragraph properties:

```xml
<w:p>
  <w:pPr>
    <w:numPr>
      <w:ilvl w:val="0"/>    <!-- List level (0-8) -->
      <w:numId w:val="1"/>   <!-- References <w:num w:numId="1"> -->
    </w:numPr>
  </w:pPr>
</w:p>
```

## AbstractNum Definitions

### Basic Structure

```xml
<w:abstractNum w:abstractNumId="0">
  <w:nsid w:val="12345678"/>  <!-- Unique identifier -->
  <w:multiLevelType w:val="hybridMultilevel"/>
  <w:tmpl w:val="ABCD1234"/>  <!-- Template ID -->
  
  <!-- Level 0 (first level) -->
  <w:lvl w:ilvl="0">
    <w:start w:val="1"/>           <!-- Start number -->
    <w:numFmt w:val="decimal"/>    <!-- Number format -->
    <w:lvlText w:val="%1."/>       <!-- Display format -->
    <w:lvlJc w:val="left"/>        <!-- Number alignment -->
    <w:pPr>
      <w:ind w:left="720" w:hanging="360"/>  <!-- Indentation -->
    </w:pPr>
    <w:rPr>
      <!-- Optional run properties for number/bullet -->
    </w:rPr>
  </w:lvl>
  
  <!-- Levels 1-8 follow same pattern -->
</w:abstractNum>
```

### Number Formats (numFmt)

| Value | Description | Example |
|-------|-------------|---------|
| `decimal` | Arabic numbers | 1, 2, 3 |
| `lowerLetter` | Lowercase letters | a, b, c |
| `upperLetter` | Uppercase letters | A, B, C |
| `lowerRoman` | Lowercase Roman | i, ii, iii |
| `upperRoman` | Uppercase Roman | I, II, III |
| `bullet` | Bullet character | • |
| `none` | No number displayed | (blank) |
| `ordinal` | Ordinal suffix | 1st, 2nd |
| `cardinalText` | Spelled number | One, Two |
| `ordinalText` | Spelled ordinal | First, Second |

### Level Text Patterns (lvlText)

| Pattern | Description | Result |
|---------|-------------|--------|
| `%1.` | Level 1 number + period | 1. |
| `%1)` | Level 1 number + paren | 1) |
| `(%1)` | Level 1 in parens | (1) |
| `%1.%2.` | Multi-level | 1.1. |
| `Section %1` | Text prefix | Section 1 |

### Bullet Characters

```xml
<w:lvl w:ilvl="0">
  <w:numFmt w:val="bullet"/>
  <w:lvlText w:val=""/>  <!-- Bullet character -->
  <w:rPr>
    <w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/>
  </w:rPr>
</w:lvl>
```

Common bullet fonts and characters:

| Character | Font | Unicode |
|-----------|------|---------|
| • | Symbol | U+00B7 |
| ○ | Courier New | U+006F |
| ■ | Wingdings | U+006E |
| → | Wingdings | U+00E0 |
| ✓ | Wingdings | U+00FC |

### MultiLevelType Values

| Value | Description |
|-------|-------------|
| `singleLevel` | Simple list (one level only) |
| `multilevel` | True outline numbering |
| `hybridMultilevel` | Mixed (most common) |

## Num Instances

### Basic Num

```xml
<w:num w:numId="1">
  <w:abstractNumId w:val="0"/>  <!-- References abstractNum -->
</w:num>
```

### Num with Level Override

Override specific levels without creating new abstractNum:

```xml
<w:num w:numId="2">
  <w:abstractNumId w:val="0"/>
  <w:lvlOverride w:ilvl="0">
    <w:startOverride w:val="5"/>  <!-- Restart at 5 -->
  </w:lvlOverride>
</w:num>
```

### Restarting Numbering

Create new num pointing to same abstractNum:

```xml
<!-- First list -->
<w:num w:numId="1">
  <w:abstractNumId w:val="0"/>
</w:num>

<!-- Second list (restarts at 1) -->
<w:num w:numId="2">
  <w:abstractNumId w:val="0"/>
</w:num>
```

Use different numId in document paragraphs to restart.

## Common Patterns

### Standard Numbered List

```xml
<w:abstractNum w:abstractNumId="0">
  <w:nsid w:val="00000001"/>
  <w:multiLevelType w:val="hybridMultilevel"/>
  <w:tmpl w:val="00000001"/>
  <w:lvl w:ilvl="0">
    <w:start w:val="1"/>
    <w:numFmt w:val="decimal"/>
    <w:lvlText w:val="%1."/>
    <w:lvlJc w:val="left"/>
    <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
  </w:lvl>
  <w:lvl w:ilvl="1">
    <w:start w:val="1"/>
    <w:numFmt w:val="lowerLetter"/>
    <w:lvlText w:val="%2."/>
    <w:lvlJc w:val="left"/>
    <w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>
  </w:lvl>
  <w:lvl w:ilvl="2">
    <w:start w:val="1"/>
    <w:numFmt w:val="lowerRoman"/>
    <w:lvlText w:val="%3."/>
    <w:lvlJc w:val="right"/>
    <w:pPr><w:ind w:left="2160" w:hanging="180"/></w:pPr>
  </w:lvl>
</w:abstractNum>
```

### Standard Bullet List

```xml
<w:abstractNum w:abstractNumId="1">
  <w:nsid w:val="00000002"/>
  <w:multiLevelType w:val="hybridMultilevel"/>
  <w:tmpl w:val="00000002"/>
  <w:lvl w:ilvl="0">
    <w:start w:val="1"/>
    <w:numFmt w:val="bullet"/>
    <w:lvlText w:val=""/>
    <w:lvlJc w:val="left"/>
    <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>
  </w:lvl>
  <w:lvl w:ilvl="1">
    <w:start w:val="1"/>
    <w:numFmt w:val="bullet"/>
    <w:lvlText w:val="o"/>
    <w:lvlJc w:val="left"/>
    <w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:hint="default"/></w:rPr>
  </w:lvl>
</w:abstractNum>
```

### Legal Outline (1.1.1 style)

```xml
<w:abstractNum w:abstractNumId="2">
  <w:nsid w:val="00000003"/>
  <w:multiLevelType w:val="multilevel"/>
  <w:tmpl w:val="00000003"/>
  <w:lvl w:ilvl="0">
    <w:start w:val="1"/>
    <w:numFmt w:val="decimal"/>
    <w:lvlText w:val="%1."/>
    <w:lvlJc w:val="left"/>
    <w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>
  </w:lvl>
  <w:lvl w:ilvl="1">
    <w:start w:val="1"/>
    <w:numFmt w:val="decimal"/>
    <w:lvlText w:val="%1.%2."/>
    <w:lvlJc w:val="left"/>
    <w:pPr><w:ind w:left="792" w:hanging="432"/></w:pPr>
  </w:lvl>
  <w:lvl w:ilvl="2">
    <w:start w:val="1"/>
    <w:numFmt w:val="decimal"/>
    <w:lvlText w:val="%1.%2.%3."/>
    <w:lvlJc w:val="left"/>
    <w:pPr><w:ind w:left="1224" w:hanging="504"/></w:pPr>
  </w:lvl>
</w:abstractNum>
```

## python-docx List Operations

### Apply Built-in List Style

```python
from docx import Document

doc = Document()

# Using built-in list styles
p = doc.add_paragraph('Item 1', style='List Bullet')
p = doc.add_paragraph('Item 2', style='List Bullet')
p = doc.add_paragraph('Item 1', style='List Number')
p = doc.add_paragraph('Item 2', style='List Number')
```

### Create Custom List (via OOXML)

python-docx has limited list creation support. For custom lists, manipulate XML:

```python
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

def create_numbered_list(doc, items, start=1):
    """Create numbered list with custom start."""
    for i, text in enumerate(items):
        p = doc.add_paragraph(text, style='List Number')
        if i == 0 and start != 1:
            # Modify numPr to use different numId for restart
            pass  # Requires numbering.xml manipulation

doc = Document()
create_numbered_list(doc, ['First', 'Second', 'Third'])
```

### Access Numbering Properties

```python
# Check if paragraph is in a list
para = doc.paragraphs[0]
numPr = para._p.pPr.numPr if para._p.pPr is not None else None
if numPr is not None:
    ilvl = numPr.ilvl.val  # List level
    numId = numPr.numId.val  # Numbering instance ID
```

## Troubleshooting

### List Numbers Not Showing

1. **Missing numId reference** - Verify paragraph has `<w:numPr>` with valid `<w:numId>`
2. **Invalid abstractNumId** - Ensure `<w:num>` references existing `<w:abstractNum>`
3. **Missing numbering.xml** - Check file exists and is referenced in relationships

### Numbers Restart Unexpectedly

1. **Different numId** - Each numId creates independent sequence
2. **Level override** - Check for `<w:lvlOverride>` with `<w:startOverride>`

### Wrong Indent/Spacing

1. **Level mismatch** - Verify `<w:ilvl>` matches intended level
2. **Style conflict** - List Paragraph style may override `<w:ind>` from abstractNum

### Bullets Showing Wrong Character

1. **Font not available** - Symbol, Wingdings must be installed
2. **Wrong encoding** - Verify lvlText character and font match

### Debugging Steps

1. Unpack document: `unzip document.docx -d unpacked/`
2. Examine `word/numbering.xml` for definitions
3. Search `word/document.xml` for `<w:numPr>` elements
4. Verify relationships in `word/_rels/document.xml.rels`
