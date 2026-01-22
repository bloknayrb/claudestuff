# MS Office Suite Plugin

Comprehensive Office document skills for Claude Code - create, edit, and analyze PowerPoint, Word, Excel, and PDF files.

> **Origin**: Adapted from [tfriedel/claude-office-skills](https://github.com/tfriedel/claude-office-skills) with enhancements for automation workflows.

## Skills

| Skill | Format | Capabilities |
|-------|--------|--------------|
| **pptx** | PowerPoint | HTML-to-PPTX conversion, template-based generation, slide manipulation |
| **docx** | Word | Document creation, tracked changes, comments, redlining |
| **word-styles** | Word | Style-based formatting, inheritance, theme integration |
| **xlsx** | Excel | Formula-based spreadsheets, financial modeling, validation |
| **pdf** | PDF | Text extraction, merging, splitting, form filling |

## Skill Details

### PowerPoint (pptx)

Create and edit PowerPoint presentations with multiple workflows:

**HTML-to-PPTX Workflow:**
- Write content as HTML with design palette selection
- Convert using html2pptx tooling
- Supports standard presentation structures

**Template-Based Generation:**
- Extract inventory from existing presentations
- Generate new slides following template patterns
- Preserve branding and formatting

**Direct OOXML Editing:**
- Manipulate slide XML directly for advanced customization
- Rearrange, duplicate, and modify slides
- Text replacement and formatting updates

### Word (docx)

Create and edit Word documents with professional collaboration features:

**Document Creation:**
- Uses docx-js library for programmatic document generation
- Supports paragraphs, tables, images, headers/footers
- Proper style inheritance

**Redlining Workflow:**
- Professional tracked changes support
- Comment insertion and management
- Preserves document history for legal/compliance

**Format Conversion:**
- Export to images via LibreOffice
- Markdown to DOCX conversion

### Word Styles (word-styles)

Deep expertise in Word's style system:

- **Paragraph styles**: Spacing, indentation, pagination
- **Character styles**: Fonts, effects, colors
- **Linked styles**: Combined paragraph and character formatting
- **Table styles**: Conditional formatting per cell position
- **Style inheritance**: Based-on relationships and hierarchy
- **Theme integration**: Colors and fonts from document theme

**Utility Scripts:**
- `inspect_styles.py` - Dump all styles from a document
- `apply_style_template.py` - Copy styles between documents

### Excel (xlsx)

Create formula-based spreadsheets following financial modeling standards:

**Principles:**
- Formula-based calculations (no hardcoded values)
- Color coding conventions (inputs vs calculations)
- Zero-tolerance error validation (#REF!, #DIV/0!, etc.)

**Capabilities:**
- Complex formula construction
- Named ranges and references
- Conditional formatting
- Data validation rules

### PDF (pdf)

Comprehensive PDF manipulation:

- **Extraction**: Text, tables, images with layout preservation
- **Manipulation**: Merge, split, rotate, reorder pages
- **Forms**: Fill fields, extract form data, validate entries
- **Security**: Password protection, watermarking
- **OCR**: Text recognition for scanned documents

## Requirements

**Python packages:**
```bash
pip install markitdown pandoc openpyxl pypdf pdfplumber reportlab
```

**Node.js (for PPTX):**
```bash
npm install html2pptx
```

**System tools:**
- LibreOffice (document conversion)
- Poppler utilities (PDF operations)

## File Structure

```
ms-office-suite/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── docx/
│   │   ├── SKILL.md
│   │   ├── docx-js.md      # Library reference
│   │   └── ooxml.md        # XML structure guide
│   ├── pdf/
│   │   ├── SKILL.md
│   │   ├── FORMS.md        # Form handling
│   │   └── REFERENCE.md    # Tool reference
│   ├── pptx/
│   │   ├── SKILL.md
│   │   ├── html2pptx.md    # Conversion workflow
│   │   └── ooxml.md        # XML structure guide
│   ├── word-styles/
│   │   └── SKILL.md
│   └── xlsx/
│       └── SKILL.md
├── package.json
└── requirements.txt
```

## Usage Examples

**Create a PowerPoint from HTML:**
```
"Create a 5-slide presentation about project status using the html2pptx workflow"
```

**Edit Word document with tracked changes:**
```
"Update the contract document with tracked changes showing the new terms"
```

**Build Excel financial model:**
```
"Create a cash flow projection spreadsheet with formulas, not hardcoded values"
```

**Extract data from PDF:**
```
"Extract the table on page 3 of this PDF to a structured format"
```

## Complexity Rating

| Aspect | Rating | Notes |
|--------|--------|-------|
| Setup Difficulty | Medium | Requires multiple dependencies |
| Customization Needed | Low | Skills are generally reusable |
| Value as Reference | High | Comprehensive office automation patterns |
