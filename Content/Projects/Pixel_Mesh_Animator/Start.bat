@echo off
cd D:\My_Software\Pixel_Mesh_Animator
echo Starting local server on http://localhost:5555...
start "" "http://localhost:5555"
python -m http.server 5555
pause