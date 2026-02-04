@echo off
setlocal
REM Empacota o canal UniVision Brasil em um arquivo ZIP para sideload.
REM IMPORTANTE: o ZIP deve conter APENAS arquivos do canal Roku (manifest/source/components).

set ZIP_NAME=UniVisionBrasil.zip

REM Ir para a raiz do repositório (pasta pai de scripts/)
pushd "%~dp0.."

if exist "%ZIP_NAME%" del /f /q "%ZIP_NAME%"

powershell -NoLogo -NoProfile -Command "Compress-Archive -Path @('manifest','source','components') -DestinationPath '%ZIP_NAME%' -Force"

if exist "%ZIP_NAME%" (
  echo Pacote criado: %ZIP_NAME%
) else (
  echo Falha ao criar o pacote.
  popd
  exit /b 1
)

popd
endlocal
