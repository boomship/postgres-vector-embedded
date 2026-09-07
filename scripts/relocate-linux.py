#!/usr/bin/env python3
"""Replace build-directory ELF search paths with paths relative to each image."""
import os
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1]).resolve(strict=True)
for directory in ('bin', 'lib'):
    for path in (root / directory).rglob('*'):
        if not path.is_file() or path.is_symlink():
            continue
        with path.open('rb') as file:
            header = file.read(18)
            if header[:4] != b'\x7fELF':
                continue
            endian = 'little' if header[5] == 1 else 'big'
            if int.from_bytes(header[16:18], endian) not in (2, 3):
                continue
        relative = os.path.relpath(root / 'lib', path.parent)
        rpath = '$ORIGIN' if relative == '.' else '$ORIGIN/' + relative
        subprocess.run(['patchelf', '--set-rpath', rpath, str(path)], check=True)
print('ELF library search paths now resolve inside the bundle')
