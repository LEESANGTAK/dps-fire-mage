@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ========================================================
echo  [DPS: Fire Mage] 엑셀 -^> 인게임 JSON 동기화 실행 중...
echo ========================================================

py -3 "%~dp0scripts\sync_excel_to_cards.py"
if %ERRORLEVEL% EQU 0 goto :success

python "%~dp0scripts\sync_excel_to_cards.py"
if %ERRORLEVEL% EQU 0 goto :success

goto :fail

:success
echo.
echo [완료] 게임 브라우저에서 F5를 누르시면 즉시 적용됩니다!
goto :end

:fail
echo.
echo [오류] 동기화 중 오류가 발생했습니다.
echo        1. 엑셀 파일(roguelike-cards.xlsx)이 열려있다면 닫아주세요.
echo        2. Python 및 openpyxl 라이브러리가 설치되어 있는지 확인해주세요.
goto :end

:end
echo ========================================================
pause
