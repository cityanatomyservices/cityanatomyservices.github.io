#!/usr/bin/env python3
"""Refresh neighborhood businesses. See tools/places/README.md."""
import runpy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'places'))
runpy.run_module('build', run_name='__main__')
