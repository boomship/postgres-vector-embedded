#!/usr/bin/env python3
"""Copy non-system PE dependencies beside executables, recursively."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

root = Path(next(arg for arg in sys.argv[1:] if arg != '--check')).resolve(strict=True)
check = '--check' in sys.argv
system = Path(os.environ['SystemRoot']) / 'System32'
pending = [p for p in root.rglob('*') if p.suffix.lower() in ('.dll', '.exe')]
seen = set()
while pending:
    path = pending.pop()
    if path in seen:
        continue
    seen.add(path)
    output = subprocess.check_output(['objdump', '-p', str(path)], text=True)
    for name in re.findall(r'DLL Name:\s*(\S+)', output):
        if name.lower().startswith(('api-ms-win-', 'ext-ms-win-')) or (system / name).exists():
            continue
        target = root / 'bin' / name
        if target.exists():
            continue
        if check:
            raise RuntimeError(f'Missing bundled DLL: {path}: {name}')
        candidates = [root / 'lib' / name]
        candidates.extend(Path(folder) / name for folder in os.get_exec_path())
        gcc_path = subprocess.check_output(['gcc', '-print-file-name=' + name], text=True).strip()
        candidates.append(Path(gcc_path))
        origin = next((p for p in candidates if p.is_file()), None)
        if origin is None:
            raise RuntimeError(f'Cannot locate dependency {name} required by {path}')
        shutil.copy2(origin, target)
        pending.append(target)
        print(f'Bundled {name}')
print('All PE dependencies are bundled or provided by Windows')
