@echo off

rem カレントディレクトリをこの .bat ファイルの場所にする
cd /d %~dp0

set CURL_CMD=C:\Windows\System32\curl.exe

rem 初回起動時に venv 環境を作成
if not exist venv (
  echo venv 環境を作成
  python -m venv venv
  rem 依存パッケージをインストール
  call venv\Scripts\activate.bat
  pip install -r requirements.txt
)

rem モデルのダウンロード
if not exist "models\pussyV2.pt" (
  echo モデルのダウンロード
  %CURL_CMD% -L -o "models\pussyV2.pt" "https://huggingface.co/AunyMoons/loras-pack/resolve/main/pussyV2.pt"
)


rem venv を有効化
call venv\Scripts\activate.bat

rem ドラッグドロップされたファイルのパスを引数にしつつスクリプトを起動
python automosaic.py %*

pause