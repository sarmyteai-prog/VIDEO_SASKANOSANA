@echo off
chcp 65001 >nul
title KADRS - Video Saskanosanas Pleijeris
cd /d "%~dp0"
start "" "http://localhost:3000"
npm run dev
