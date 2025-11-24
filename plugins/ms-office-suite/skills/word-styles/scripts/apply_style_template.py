#!/usr/bin/env python3
"""
Copy style definitions from a template document to a target document.

Usage:
    python apply_style_template.py template.docx target.docx [options]

Options:
    --styles "Style1,Style2"  Comma-separated list of style names to copy (default: all)
    --overwrite               Overwrite existing styles in target
    --output OUTPUT.docx      Write to new file instead of modifying target
    --dry-run                 Show what would be copied without making changes

This script copies style XML definitions from template to target, preserving
the target document's content while updating its formatting definitions.
"""

import argparse
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.dom import minidom

try:
    import defusedxml.minidom as safe_minidom
except ImportError:
    print("Warning: defusedxml not installed. Using standard minidom.")
    safe_minidom = minidom


def parse_styles_xml(styles_content):
    """Parse styles.xml content and return dict of style elements by styleId."""
    doc = safe_minidom.parseString(styles_content)
    styles = {}
    
    for style in doc.getElementsByTagName('w:style'):
        style_id = style.getAttribute('w:styleId')
        if style_id:
            styles[style_id] = {
                'element': style,
                'name': get_style_name(style),
                'type': style.getAttribute('w:type'),
            }
    
    return doc, styles


def get_style_name(style_element):
    """Extract style name from style element."""
    name_elements = style_element.getElementsByTagName('w:name')
    if name_elements:
        return name_elements[0].getAttribute('w:val')
    return style_element.getAttribute('w:styleId')


def get_style_id_by_name(styles_dict, name):
    """Find styleId by style name (case-insensitive)."""
    name_lower = name.lower()
    for style_id, info in styles_dict.items():
        if info['name'].lower() == name_lower:
            return style_id
    return None


def copy_style(source_style, target_doc, target_styles, namespace_uri):
    """Copy a style element to target document."""
    # Import the node into target document
    imported = target_doc.importNode(source_style['element'], True)
    
    # Find the styles element to append to
    styles_elements = target_doc.getElementsByTagName('w:styles')
    if not styles_elements:
        raise ValueError("No w:styles element found in target document")
    
    styles_root = styles_elements[0]
    
    # Check if style already exists
    style_id = source_style['element'].getAttribute('w:styleId')
    existing = None
    for style in styles_root.getElementsByTagName('w:style'):
        if style.getAttribute('w:styleId') == style_id:
            existing = style
            break
    
    if existing:
        # Replace existing style
        styles_root.replaceChild(imported, existing)
        return 'replaced'
    else:
        # Append new style
        styles_root.appendChild(imported)
        return 'added'


def extract_file_from_docx(docx_path, internal_path):
    """Extract a file from inside a docx archive."""
    with zipfile.ZipFile(docx_path, 'r') as zf:
        return zf.read(internal_path)


def update_file_in_docx(docx_path, internal_path, content, output_path=None):
    """Update a file inside a docx archive."""
    target_path = output_path or docx_path
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as tmp:
        tmp_path = tmp.name
    
    try:
        with zipfile.ZipFile(docx_path, 'r') as zf_in:
            with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zf_out:
                for item in zf_in.infolist():
                    if item.filename == internal_path:
                        zf_out.writestr(item, content)
                    else:
                        zf_out.writestr(item, zf_in.read(item.filename))
        
        shutil.move(tmp_path, target_path)
    except Exception:
        Path(tmp_path).unlink(missing_ok=True)
        raise


def main():
    parser = argparse.ArgumentParser(
        description='Copy style definitions from template to target document'
    )
    parser.add_argument('template', help='Template document with styles to copy')
    parser.add_argument('target', help='Target document to update')
    parser.add_argument('--styles', help='Comma-separated style names to copy')
    parser.add_argument('--overwrite', action='store_true',
                       help='Overwrite existing styles in target')
    parser.add_argument('--output', help='Output file (default: modify target in place)')
    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be done without making changes')
    args = parser.parse_args()
    
    template_path = Path(args.template)
    target_path = Path(args.target)
    
    if not template_path.exists():
        print(f"Error: Template not found: {template_path}")
        sys.exit(1)
    if not target_path.exists():
        print(f"Error: Target not found: {target_path}")
        sys.exit(1)
    
    # Load styles from both documents
    try:
        template_styles_xml = extract_file_from_docx(template_path, 'word/styles.xml')
        target_styles_xml = extract_file_from_docx(target_path, 'word/styles.xml')
    except KeyError as e:
        print(f"Error: Could not find styles.xml in document: {e}")
        sys.exit(1)
    
    template_doc, template_styles = parse_styles_xml(template_styles_xml)
    target_doc, target_styles = parse_styles_xml(target_styles_xml)
    
    # Determine which styles to copy
    if args.styles:
        style_names = [s.strip() for s in args.styles.split(',')]
        styles_to_copy = []
        for name in style_names:
            style_id = get_style_id_by_name(template_styles, name)
            if style_id:
                styles_to_copy.append(style_id)
            else:
                print(f"Warning: Style '{name}' not found in template")
    else:
        # Copy all non-default styles
        styles_to_copy = list(template_styles.keys())
    
    if not styles_to_copy:
        print("No styles to copy.")
        sys.exit(0)
    
    print(f"Template: {template_path}")
    print(f"Target: {target_path}")
    print(f"Styles to process: {len(styles_to_copy)}")
    print("-" * 40)
    
    results = {'added': [], 'replaced': [], 'skipped': []}
    
    for style_id in styles_to_copy:
        source_info = template_styles[style_id]
        style_name = source_info['name']
        
        # Check if exists in target
        exists_in_target = style_id in target_styles
        
        if exists_in_target and not args.overwrite:
            results['skipped'].append(style_name)
            if not args.dry_run:
                print(f"  SKIP: {style_name} (exists, use --overwrite)")
            continue
        
        if args.dry_run:
            action = 'would replace' if exists_in_target else 'would add'
            print(f"  {action.upper()}: {style_name}")
            if exists_in_target:
                results['replaced'].append(style_name)
            else:
                results['added'].append(style_name)
        else:
            action = copy_style(source_info, target_doc, target_styles, None)
            if action == 'replaced':
                results['replaced'].append(style_name)
                print(f"  REPLACED: {style_name}")
            else:
                results['added'].append(style_name)
                print(f"  ADDED: {style_name}")
    
    # Write results
    if not args.dry_run and (results['added'] or results['replaced']):
        # Serialize updated styles.xml
        updated_xml = target_doc.toxml(encoding='UTF-8')
        
        output_path = args.output or str(target_path)
        if args.output:
            # Copy target to output first
            shutil.copy2(target_path, output_path)
        
        update_file_in_docx(
            target_path if not args.output else output_path,
            'word/styles.xml',
            updated_xml,
            output_path if args.output else None
        )
        print("-" * 40)
        print(f"Output: {output_path}")
    
    # Summary
    print("-" * 40)
    print(f"Added: {len(results['added'])}")
    print(f"Replaced: {len(results['replaced'])}")
    print(f"Skipped: {len(results['skipped'])}")
    
    if args.dry_run:
        print("\n(Dry run - no changes made)")


if __name__ == '__main__':
    main()
