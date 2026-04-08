@echo off
cd D:\My_Software\Game_Assets_Creator
echo Starting local server on http://localhost:5560...
start "" "http://localhost:5560"
python -m http.server 5560
pause