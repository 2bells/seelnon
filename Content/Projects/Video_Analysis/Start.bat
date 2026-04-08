@echo off
cd D:\My_Software\Video_Analysis
echo Starting local server on http://localhost:5550...
start "" "http://localhost:5550"
python -m http.server 5550
pause