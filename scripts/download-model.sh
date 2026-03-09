#!/bin/bash
# Download multilingual-e5-small model and copy ONNX Runtime WASM files
set -e
DEST="static/models/Xenova/multilingual-e5-small"
ONNX_DEST="$DEST/onnx"
BASE="https://huggingface.co/Xenova/multilingual-e5-small/resolve/main"
ORT_SRC="node_modules/onnxruntime-web/dist"
ORT_DEST="static/ort-wasm"

mkdir -p "$DEST" "$ONNX_DEST" "$ORT_DEST"

echo "Downloading model files..."
for f in config.json tokenizer.json tokenizer_config.json special_tokens_map.json; do
  curl -sL "$BASE/$f" -o "$DEST/$f" && echo "done: $f"
done

echo "Downloading model_quantized.onnx (~113MB)..."
curl -L "$BASE/onnx/model_quantized.onnx" -o "$ONNX_DEST/model_quantized.onnx" --progress-bar
echo "Done! Model ready at $DEST"

echo "Copying ONNX Runtime WASM files..."
# Copy all wasm and related files from onnxruntime-web
for f in "$ORT_SRC"/*.wasm "$ORT_SRC"/*.mjs; do
  [ -f "$f" ] && cp "$f" "$ORT_DEST/" && echo "copied: $(basename $f)"
done
echo "ONNX Runtime WASM files ready at $ORT_DEST"

# Copy sql.js WASM files for local loading (instead of CDN)
SQL_DEST="static/sql"
mkdir -p "$SQL_DEST"
echo "Copying sql.js WASM files..."
cp node_modules/sql.js/dist/sql-wasm.js "$SQL_DEST/sql-wasm.js" && echo "copied: sql-wasm.js"
cp node_modules/sql.js/dist/sql-wasm.wasm "$SQL_DEST/sql-wasm.wasm" && echo "copied: sql-wasm.wasm"
echo "sql.js WASM files ready at $SQL_DEST"
