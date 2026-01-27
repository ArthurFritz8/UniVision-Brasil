@echo off
setlocal
REM Empacota o canal UniVision Brasil em um arquivo ZIP para sideload

set ZIP_NAME=UniVisionBrasil.zip

if exist %ZIP_NAME% del /f /q %ZIP_NAME%

powershell -NoLogo -NoProfile -Command "Compress-Archive -Path * -DestinationPath %ZIP_NAME% -Force"

if exist %ZIP_NAME% (
  echo Pacote criado: %ZIP_NAME%
) else (
  echo Falha ao criar o pacote.
  exit /b 1
)

endlocal
