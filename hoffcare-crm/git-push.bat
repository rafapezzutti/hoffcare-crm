@echo off
cd /d "%~dp0"
git add -A
git commit -m "feat: odontologia - procedimentos so dental, CRO padrao, autocomplete faces, logo clinica, impressao corrigida"
git push
echo.
echo Pronto! Pressione qualquer tecla para fechar.
pause > nul
