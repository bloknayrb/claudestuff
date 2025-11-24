#!/usr/bin/env python3
"""
Inspect and dump all styles from a Word document.

Usage:
    python inspect_styles.py document.docx [--json] [--type paragraph|character|table]

Outputs:
    - Style names, types, and IDs
    - Inheritance relationships (basedOn, next)
    - Key formatting properties
    - Potential issues (orphaned styles, deep inheritance)
"""

import argparse
import json
import sys
from pathlib import Path

try:
    from docx import Document
    from docx.shared import Pt, Inches, Twips
    from docx.enum.style import WD_STYLE_TYPE
except ImportError:
    print("Error: python-docx not installed. Run: pip install python-docx --break-system-packages")
    sys.exit(1)


def get_style_type_name(style_type):
    """Convert style type enum to string."""
    type_map = {
        WD_STYLE_TYPE.CHARACTER: 'character',
        WD_STYLE_TYPE.PARAGRAPH: 'paragraph',
        WD_STYLE_TYPE.LIST: 'list',
        WD_STYLE_TYPE.TABLE: 'table',
    }
    return type_map.get(style_type, 'unknown')


def format_length(length):
    """Format a Length object to readable string."""
    if length is None:
        return None
    # Convert to points
    pt_value = length.pt
    if pt_value == int(pt_value):
        return f"{int(pt_value)}pt"
    return f"{pt_value:.1f}pt"


def format_color(color):
    """Format color to hex string."""
    if color is None:
        return None
    if color.rgb is not None:
        return f"#{color.rgb}"
    if color.theme_color is not None:
        return f"theme:{color.theme_color}"
    return None


def extract_paragraph_format(pf):
    """Extract paragraph formatting properties."""
    if pf is None:
        return {}
    
    props = {}
    
    # Spacing
    if pf.space_before is not None:
        props['space_before'] = format_length(pf.space_before)
    if pf.space_after is not None:
        props['space_after'] = format_length(pf.space_after)
    if pf.line_spacing is not None:
        if pf.line_spacing_rule is not None:
            props['line_spacing'] = f"{pf.line_spacing} ({pf.line_spacing_rule})"
        else:
            props['line_spacing'] = str(pf.line_spacing)
    
    # Indentation
    if pf.left_indent is not None:
        props['left_indent'] = format_length(pf.left_indent)
    if pf.right_indent is not None:
        props['right_indent'] = format_length(pf.right_indent)
    if pf.first_line_indent is not None:
        props['first_line_indent'] = format_length(pf.first_line_indent)
    
    # Alignment
    if pf.alignment is not None:
        props['alignment'] = str(pf.alignment).split('.')[-1]
    
    # Pagination
    if pf.keep_together:
        props['keep_together'] = True
    if pf.keep_with_next:
        props['keep_with_next'] = True
    if pf.page_break_before:
        props['page_break_before'] = True
    if pf.widow_control is not None:
        props['widow_control'] = pf.widow_control
    
    return props


def extract_font_props(font):
    """Extract font/character formatting properties."""
    if font is None:
        return {}
    
    props = {}
    
    if font.name is not None:
        props['font_name'] = font.name
    if font.size is not None:
        props['font_size'] = format_length(font.size)
    if font.bold is not None:
        props['bold'] = font.bold
    if font.italic is not None:
        props['italic'] = font.italic
    if font.underline is not None:
        props['underline'] = str(font.underline) if font.underline is not True else True
    if font.strike is not None:
        props['strike'] = font.strike
    if font.all_caps is not None:
        props['all_caps'] = font.all_caps
    if font.small_caps is not None:
        props['small_caps'] = font.small_caps
    
    color = format_color(font.color)
    if color:
        props['color'] = color
    
    if font.highlight_color is not None:
        props['highlight'] = str(font.highlight_color).split('.')[-1]
    
    return props


def extract_style_info(style):
    """Extract comprehensive style information."""
    info = {
        'name': style.name,
        'style_id': style.style_id,
        'type': get_style_type_name(style.type),
        'builtin': style.builtin,
        'hidden': style.hidden,
        'quick_style': style.quick_style,
        'priority': style.priority,
    }
    
    # Inheritance
    if style.base_style:
        info['based_on'] = style.base_style.name
    if hasattr(style, 'next_paragraph_style') and style.next_paragraph_style:
        if style.next_paragraph_style != style:
            info['next_style'] = style.next_paragraph_style.name
    
    # Format properties
    if style.type in (WD_STYLE_TYPE.PARAGRAPH, WD_STYLE_TYPE.CHARACTER):
        font_props = extract_font_props(style.font)
        if font_props:
            info['font'] = font_props
    
    if style.type == WD_STYLE_TYPE.PARAGRAPH:
        para_props = extract_paragraph_format(style.paragraph_format)
        if para_props:
            info['paragraph'] = para_props
    
    return info


def calculate_inheritance_depth(style, styles_dict, visited=None):
    """Calculate how deep the inheritance chain goes."""
    if visited is None:
        visited = set()
    
    if style.name in visited:
        return -1  # Circular reference detected
    
    visited.add(style.name)
    
    # Not all style types have base_style
    if not hasattr(style, 'base_style') or style.base_style is None:
        return 0
    
    return 1 + calculate_inheritance_depth(style.base_style, styles_dict, visited)


def find_issues(styles):
    """Find potential issues with styles."""
    issues = []
    styles_dict = {s.name: s for s in styles}
    
    for style in styles:
        # Skip styles without inheritance support
        if not hasattr(style, 'base_style'):
            continue
            
        # Check for deep inheritance
        depth = calculate_inheritance_depth(style, styles_dict)
        if depth > 3:
            issues.append({
                'style': style.name,
                'issue': 'deep_inheritance',
                'message': f"Inheritance depth of {depth} (recommended max: 3)"
            })
        elif depth == -1:
            issues.append({
                'style': style.name,
                'issue': 'circular_inheritance',
                'message': "Circular inheritance detected"
            })
        
        # Check for orphaned base styles
        if style.base_style and style.base_style.name not in styles_dict:
            issues.append({
                'style': style.name,
                'issue': 'orphaned_base',
                'message': f"Base style '{style.base_style.name}' not found"
            })
    
    return issues


def main():
    parser = argparse.ArgumentParser(
        description='Inspect styles in a Word document'
    )
    parser.add_argument('document', help='Path to .docx file')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('--type', choices=['paragraph', 'character', 'table', 'list'],
                       help='Filter by style type')
    parser.add_argument('--name', help='Filter by style name (partial match)')
    args = parser.parse_args()
    
    doc_path = Path(args.document)
    if not doc_path.exists():
        print(f"Error: File not found: {doc_path}")
        sys.exit(1)
    
    doc = Document(str(doc_path))
    
    # Type filter mapping
    type_filter = {
        'paragraph': WD_STYLE_TYPE.PARAGRAPH,
        'character': WD_STYLE_TYPE.CHARACTER,
        'table': WD_STYLE_TYPE.TABLE,
        'list': WD_STYLE_TYPE.LIST,
    }
    
    # Collect styles
    styles_info = []
    for style in doc.styles:
        # Apply filters
        if args.type and style.type != type_filter.get(args.type):
            continue
        if args.name and args.name.lower() not in style.name.lower():
            continue
        
        styles_info.append(extract_style_info(style))
    
    # Find issues
    all_styles = list(doc.styles)
    issues = find_issues(all_styles)
    
    if args.json:
        output = {
            'document': str(doc_path),
            'style_count': len(styles_info),
            'styles': styles_info,
            'issues': issues
        }
        print(json.dumps(output, indent=2))
    else:
        # Text output
        print(f"Document: {doc_path}")
        print(f"Total styles: {len(styles_info)}")
        print("=" * 60)
        
        # Group by type
        by_type = {}
        for info in styles_info:
            t = info['type']
            if t not in by_type:
                by_type[t] = []
            by_type[t].append(info)
        
        for style_type in ['paragraph', 'character', 'table', 'list']:
            if style_type not in by_type:
                continue
            
            print(f"\n{style_type.upper()} STYLES ({len(by_type[style_type])})")
            print("-" * 40)
            
            for info in sorted(by_type[style_type], key=lambda x: (x.get('priority') or 99)):
                print(f"\n  {info['name']} (id: {info['style_id']})")
                
                if info.get('based_on'):
                    print(f"    Based on: {info['based_on']}")
                if info.get('next_style'):
                    print(f"    Next: {info['next_style']}")
                
                if info.get('font'):
                    font_str = ', '.join(f"{k}={v}" for k, v in info['font'].items())
                    print(f"    Font: {font_str}")
                
                if info.get('paragraph'):
                    para_str = ', '.join(f"{k}={v}" for k, v in info['paragraph'].items())
                    print(f"    Paragraph: {para_str}")
                
                flags = []
                if info.get('builtin'):
                    flags.append('builtin')
                if info.get('hidden'):
                    flags.append('hidden')
                if info.get('quick_style'):
                    flags.append('quick')
                if flags:
                    print(f"    Flags: {', '.join(flags)}")
        
        if issues:
            print("\n" + "=" * 60)
            print("ISSUES DETECTED")
            print("-" * 40)
            for issue in issues:
                print(f"  [{issue['issue']}] {issue['style']}: {issue['message']}")


if __name__ == '__main__':
    main()
