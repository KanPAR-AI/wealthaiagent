#!/bin/bash
# Structural check (docs/49 ASTRAL-97): color values live ONLY in the brand
# values file. A hex literal in a screen is the copy AMB-20(a) forbids.
cd "$(dirname "$0")/.."
hits=$(grep -rEn "#[0-9a-fA-F]{6}\b" src --include='*.ts' --include='*.tsx' | grep -v "src/theme/brands.ts" | grep -vE ":[0-9]+:\\s*(\\*|//)")
if [ -n "$hits" ]; then echo "HEX OUTSIDE TOKENS:"; echo "$hits"; exit 1; fi
echo "token check clean"
