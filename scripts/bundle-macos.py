#!/usr/bin/env python3
"""Bundle Mach-O dependencies and use loader-relative paths throughout."""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def images(root):
    for folder in ('bin', 'lib'):
        for path in sorted((root / folder).rglob('*')):
            if path.is_file() and not path.is_symlink():
                if 'Mach-O' in run('file', '-b', str(path)):
                    yield path


def dependencies(path):
    return [line.strip().split(' (compatibility version', 1)[0]
            for line in run('otool', '-L', str(path)).splitlines()[1:]]


def library_id(path):
    lines = run('otool', '-D', str(path)).splitlines()
    return lines[1].strip() if len(lines) > 1 else None


def system(path):
    return path.startswith(('/usr/lib/', '/System/Library/'))


def resolve_dependency(name, source, root):
    if name.startswith('@loader_path/'):
        return source.parent / name.removeprefix('@loader_path/')
    if name.startswith('@executable_path/'):
        return root / 'bin' / name.removeprefix('@executable_path/')
    if name.startswith('@rpath/'):
        commands = run('otool', '-l', str(source))
        for rpath in re.findall(r'cmd LC_RPATH\s+cmdsize \d+\s+path (.*?) \(offset', commands):
            expanded = rpath.replace('@loader_path', str(source.parent)).replace('@executable_path', str(root / 'bin'))
            candidate = Path(expanded) / name.removeprefix('@rpath/')
            if candidate.exists():
                return candidate
        raise RuntimeError(f'Cannot resolve {name} in {source}')
    if name.startswith('/'):
        return Path(name)
    raise RuntimeError(f'Unsupported dependency {name} in {source}')


def audit(root):
    for path in images(root):
        for name in dependencies(path):
            if system(name):
                continue
            if not name.startswith('@loader_path/'):
                raise RuntimeError(f'Non-relocatable dependency: {path}: {name}')
            target = resolve_dependency(name, path, root).resolve()
            if not target.is_relative_to(root) or not target.is_file():
                raise RuntimeError(f'Dependency escapes bundle or is missing: {path}: {name}')
        subprocess.run(['codesign', '--verify', str(path)], check=True)
    print(f'All Mach-O dependencies are bundled or provided by macOS: {root}')


def bundle(root):
    pending = [(path, path) for path in images(root)]
    visited = set()
    origins = {}
    while pending:
        path, source = pending.pop()
        if path in visited:
            continue
        visited.add(path)
        own_id = library_id(source)
        changes = []
        for name in dependencies(source):
            if name == own_id or system(name):
                continue
            origin = resolve_dependency(name, source, root).resolve()
            if not origin.is_file():
                raise RuntimeError(f'Missing dependency: {source}: {name}')
            if origin.is_relative_to(root):
                target = origin
            else:
                target = root / 'lib' / Path(name).name
                previous = origins.setdefault(target, origin)
                if previous != origin:
                    raise RuntimeError(f'Conflicting libraries for {target}: {previous}, {origin}')
                if not target.exists():
                    shutil.copy2(origin, target)
                    target.chmod(target.stat().st_mode | 0o200)
                    pending.append((target, origin))
            relative = '@loader_path/' + os.path.relpath(target, path.parent)
            if name != relative:
                changes.extend(['-change', name, relative])
        if own_id:
            changes.extend(['-id', '@loader_path/' + path.name])
        if changes:
            subprocess.run(['install_name_tool', *changes, str(path)], check=True)
        subprocess.run(['codesign', '--force', '--sign', '-', str(path)], check=True)
    audit(root)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    root = args.bundle.resolve(strict=True)
    (audit if args.check else bundle)(root)
