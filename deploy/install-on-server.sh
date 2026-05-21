#!/bin/bash
# 가비아 서버호스팅(Linux) SSH 접속 후 실행
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/thejohn}"
REPO="${REPO:-https://github.com/hanbaedal/thejohn.git}"

echo "==> clone/update"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull
else
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "==> npm install"
cd server && npm ci --omit=dev

echo "==> .env 확인 (없으면 .env.example 복사 후 편집)"
if [ ! -f ../.env ]; then
  cp ../.env.example ../.env
  echo "!! ../.env 를 편집한 뒤 다시 pm2 restart 하세요."
fi

echo "==> pm2"
command -v pm2 >/dev/null || npm install -g pm2
cd ..
pm2 startOrReload deploy/ecosystem.config.cjs
pm2 save

echo "완료. Nginx 프록시( deploy/nginx-thejohn.conf.example ) 설정 후 https://thejohn.co.kr 확인"
