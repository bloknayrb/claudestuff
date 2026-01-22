#!/usr/bin/env python3
"""
Plugin validation script for claudestuff marketplace.

Validates:
- JSON syntax (plugin.json, marketplace.json)
- Required fields in plugin manifests
- YAML frontmatter in SKILL.md files
- Directory structure
- Internal link references

Usage:
    python validate-plugin.py                    # Validate all plugins
    python validate-plugin.py plugin-name        # Validate specific plugin
    python validate-plugin.py --marketplace      # Validate marketplace.json only
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import List, Tuple, Optional

# ANSI colors for output
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
RESET = '\033[0m'


def print_success(msg: str):
    print(f"{GREEN}✓{RESET} {msg}")


def print_warning(msg: str):
    print(f"{YELLOW}⚠{RESET} {msg}")


def print_error(msg: str):
    print(f"{RED}✗{RESET} {msg}")


def find_repo_root() -> Path:
    """Find the repository root (contains .claude-plugin/)."""
    current = Path.cwd()
    while current != current.parent:
        if (current / '.claude-plugin').exists():
            return current
        current = current.parent
    # Fallback to script location
    return Path(__file__).parent.parent


def validate_json_file(filepath: Path) -> Tuple[bool, Optional[dict], Optional[str]]:
    """Validate JSON syntax and return parsed content."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = json.load(f)
        return True, content, None
    except json.JSONDecodeError as e:
        return False, None, f"JSON syntax error: {e}"
    except FileNotFoundError:
        return False, None, "File not found"
    except Exception as e:
        return False, None, str(e)


def validate_yaml_frontmatter(filepath: Path) -> Tuple[bool, List[str]]:
    """Validate YAML frontmatter in markdown file."""
    errors = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check for frontmatter
        if not content.startswith('---'):
            errors.append("Missing YAML frontmatter (should start with ---)")
            return False, errors

        # Find closing ---
        match = re.match(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
        if not match:
            errors.append("Unclosed YAML frontmatter (missing closing ---)")
            return False, errors

        frontmatter = match.group(1)

        # Check for required fields in SKILL.md
        if filepath.name == 'SKILL.md':
            required_fields = ['name', 'description']
            for field in required_fields:
                if not re.search(rf'^{field}:', frontmatter, re.MULTILINE):
                    errors.append(f"Missing required field: {field}")

        return len(errors) == 0, errors

    except Exception as e:
        errors.append(f"Error reading file: {e}")
        return False, errors


def validate_plugin_json(plugin_dir: Path) -> Tuple[bool, List[str]]:
    """Validate plugin.json structure."""
    errors = []
    plugin_json = plugin_dir / '.claude-plugin' / 'plugin.json'

    # Also check for plugin.json at root (alternative structure)
    if not plugin_json.exists():
        plugin_json = plugin_dir / 'plugin.json'

    if not plugin_json.exists():
        errors.append("plugin.json not found (expected in .claude-plugin/ or plugin root)")
        return False, errors

    valid, content, error = validate_json_file(plugin_json)
    if not valid:
        errors.append(f"plugin.json: {error}")
        return False, errors

    # Check required fields
    required_fields = ['name', 'version', 'description']
    for field in required_fields:
        if field not in content:
            errors.append(f"plugin.json missing required field: {field}")

    # Validate version format (semver-ish)
    if 'version' in content:
        version = content['version']
        if not re.match(r'^\d+\.\d+\.\d+', version):
            errors.append(f"Invalid version format: {version} (expected semver like 1.0.0)")

    return len(errors) == 0, errors


def validate_directory_structure(plugin_dir: Path) -> Tuple[bool, List[str]]:
    """Validate plugin directory structure."""
    errors = []
    warnings = []

    # Check for README
    if not (plugin_dir / 'README.md').exists():
        errors.append("Missing README.md")

    # Check referenced directories in plugin.json exist
    plugin_json = plugin_dir / '.claude-plugin' / 'plugin.json'
    if not plugin_json.exists():
        plugin_json = plugin_dir / 'plugin.json'

    if plugin_json.exists():
        valid, content, _ = validate_json_file(plugin_json)
        if valid and 'components' in content:
            components = content['components']

            if 'commands' in components:
                for pattern in components['commands']:
                    base_dir = pattern.split('/')[0]
                    if not (plugin_dir / base_dir).exists():
                        errors.append(f"Commands directory not found: {base_dir}/")

            if 'agents' in components:
                for pattern in components['agents']:
                    base_dir = pattern.split('/')[0]
                    if not (plugin_dir / base_dir).exists():
                        errors.append(f"Agents directory not found: {base_dir}/")

            if 'skills' in components:
                for pattern in components['skills']:
                    base_dir = pattern.split('/')[0]
                    if not (plugin_dir / base_dir).exists():
                        errors.append(f"Skills directory not found: {base_dir}/")

    return len(errors) == 0, errors


def validate_skill_files(plugin_dir: Path) -> Tuple[bool, List[str]]:
    """Validate all SKILL.md files in plugin."""
    errors = []
    skills_dir = plugin_dir / 'skills'

    if not skills_dir.exists():
        return True, []  # No skills is okay

    for skill_md in skills_dir.rglob('SKILL.md'):
        valid, skill_errors = validate_yaml_frontmatter(skill_md)
        if not valid:
            rel_path = skill_md.relative_to(plugin_dir)
            for err in skill_errors:
                errors.append(f"{rel_path}: {err}")

    return len(errors) == 0, errors


def validate_internal_links(plugin_dir: Path) -> Tuple[bool, List[str]]:
    """Check for broken internal links in markdown files."""
    errors = []

    for md_file in plugin_dir.rglob('*.md'):
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find markdown links [text](path)
            links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', content)

            for text, link in links:
                # Skip external links
                if link.startswith(('http://', 'https://', '#')):
                    continue

                # Check relative links
                link_path = md_file.parent / link
                if not link_path.exists():
                    rel_path = md_file.relative_to(plugin_dir)
                    errors.append(f"{rel_path}: Broken link to {link}")

        except Exception as e:
            pass  # Skip files that can't be read

    return len(errors) == 0, errors


def validate_plugin(plugin_name: str, plugins_dir: Path) -> Tuple[bool, List[str]]:
    """Validate a single plugin."""
    plugin_dir = plugins_dir / plugin_name
    all_errors = []

    print(f"\nValidating plugin: {plugin_name}")
    print("-" * 40)

    # 1. Validate plugin.json
    valid, errors = validate_plugin_json(plugin_dir)
    if valid:
        print_success("plugin.json valid")
    else:
        for err in errors:
            print_error(err)
        all_errors.extend(errors)

    # 2. Validate directory structure
    valid, errors = validate_directory_structure(plugin_dir)
    if valid:
        print_success("Directory structure valid")
    else:
        for err in errors:
            print_error(err)
        all_errors.extend(errors)

    # 3. Validate skill files
    valid, errors = validate_skill_files(plugin_dir)
    if valid:
        print_success("Skill files valid")
    else:
        for err in errors:
            print_error(err)
        all_errors.extend(errors)

    # 4. Check internal links
    valid, errors = validate_internal_links(plugin_dir)
    if valid:
        print_success("Internal links valid")
    else:
        for err in errors:
            print_warning(err)  # Links are warnings, not errors

    return len(all_errors) == 0, all_errors


def validate_marketplace(repo_root: Path) -> Tuple[bool, List[str]]:
    """Validate marketplace.json."""
    errors = []
    marketplace_json = repo_root / '.claude-plugin' / 'marketplace.json'

    print("\nValidating marketplace.json")
    print("-" * 40)

    valid, content, error = validate_json_file(marketplace_json)
    if not valid:
        print_error(f"marketplace.json: {error}")
        return False, [error]

    print_success("JSON syntax valid")

    # Check required fields
    if 'plugins' not in content:
        errors.append("Missing 'plugins' array")
    else:
        # Validate each plugin reference
        plugins_dir = repo_root / 'plugins'
        for plugin in content['plugins']:
            if 'name' not in plugin:
                errors.append("Plugin entry missing 'name'")
                continue

            if 'source' not in plugin:
                errors.append(f"Plugin '{plugin['name']}' missing 'source'")
                continue

            # Check source path exists
            source_path = repo_root / plugin['source'].lstrip('./')
            if not source_path.exists():
                errors.append(f"Plugin '{plugin['name']}' source not found: {plugin['source']}")

    if errors:
        for err in errors:
            print_error(err)
    else:
        print_success("All plugin references valid")

    return len(errors) == 0, errors


def main():
    repo_root = find_repo_root()
    plugins_dir = repo_root / 'plugins'

    print(f"Repository root: {repo_root}")

    # Parse arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == '--marketplace':
            valid, _ = validate_marketplace(repo_root)
            sys.exit(0 if valid else 1)
        else:
            # Validate specific plugin
            plugin_name = sys.argv[1]
            if not (plugins_dir / plugin_name).exists():
                print_error(f"Plugin not found: {plugin_name}")
                sys.exit(1)
            valid, _ = validate_plugin(plugin_name, plugins_dir)
            sys.exit(0 if valid else 1)

    # Validate everything
    all_valid = True

    # Marketplace
    valid, _ = validate_marketplace(repo_root)
    all_valid = all_valid and valid

    # All plugins
    for plugin_dir in plugins_dir.iterdir():
        if plugin_dir.is_dir() and not plugin_dir.name.startswith('.'):
            valid, _ = validate_plugin(plugin_dir.name, plugins_dir)
            all_valid = all_valid and valid

    # Summary
    print("\n" + "=" * 40)
    if all_valid:
        print_success("All validations passed!")
    else:
        print_error("Validation failed - see errors above")

    sys.exit(0 if all_valid else 1)


if __name__ == '__main__':
    main()
