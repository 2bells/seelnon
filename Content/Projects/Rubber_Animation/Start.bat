@echo off
cd D:\My_Software\Rubber_Animation
echo Starting local server on http://localhost:5650...
start "" "http://localhost:5650"
python -m http.server --bind 0.0.0.0 5650
pause