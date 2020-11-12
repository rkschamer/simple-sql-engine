#!/bin/bash

# kata didn't support TypeScript directly and also JavaScript modules were not
# supported; script creates a single JS file out of transpiled TS and removes 
# unsupported elements (export, import)

npx tsc
cat dist/*.js | sed 's/^export\s//g' | sed '/^import/d'  > katafile.js