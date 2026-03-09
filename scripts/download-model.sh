#!/bin/bash
# Download multilingual-e5-small model for local serving
set -e
DEST="static/models/Xenova/multilingual-e5-small"
ONNX="$DEST/onnx"
BASE="https://huggingface.co/Xenova/multilingual-e5-small/resolve/main"

mkdir -p "$DEST" "$ONNX"

echo "Downloading model files..."
for f in config.json tokenizer.json tokenizer_config.json special_tokens_map.json; do
  curl -sL "$BASE/$f" -o "$DEST/$f" && echo "done: $f"
done

echo "Downloading model_quantized.onnx (~113MB)..."
curl -L "$BASE/onnx/model_quantized.onnx" -o "$ONNX/model_quantized.onnx" --progress-bar

echo "Done! Model ready at $DEST"

# Copy ONNX Runtime WASM files from node_modules
echo 'Copying ONNX Runtime WASM files...'
mkdir -p static/ort-wasm
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs static/ort-wasm/
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm static/ort-wasm/
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm static/ort-wasm/
echo 'Done!'
