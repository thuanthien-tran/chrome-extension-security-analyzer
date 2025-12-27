@echo off
REM Script to open 3 terminals in Windows Terminal (same window, 3 tabs)
REM All terminals use Command Prompt (cmd), not PowerShell

REM Open Windows Terminal with 3 tabs, all using Command Prompt
wt -p "Command Prompt" -d "D:\Do An\Do An Chuyen Nganh\source_3\backend" --title "BE" ; ^
    new-tab -p "Command Prompt" -d "D:\Do An\Do An Chuyen Nganh\source_3\dashboard" --title "DB" ; ^
    new-tab -p "Command Prompt" -d "D:\Do An\Do An Chuyen Nganh\source_3\analyzer" --title "ANL" cmd /k "venv\Scripts\activate"

echo Windows Terminal opened with 3 tabs (BE, DB, ANL)!
timeout /t 2 >nul

