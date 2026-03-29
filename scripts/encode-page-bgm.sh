#!/usr/bin/env bash
# 원본 WAV가 있을 때: 앞 120초만 잘라 AAC(m4a)로 인코딩 (배포 용량 절감)
# 사용: 프로젝트 루트에서 ./scripts/encode-page-bgm.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/../static/bgms/pages" && pwd)"
SEC="${1:-120}"
BR="${2:-112k}"

command -v ffmpeg >/dev/null || { echo "ffmpeg 필요 (brew install ffmpeg)"; exit 1; }

for base in main game sub; do
	src="${DIR}/${base}_bgm.wav"
	out="${DIR}/${base}_bgm.m4a"
	if [[ ! -f "$src" ]]; then
		echo "skip (no $src)"
		continue
	fi
	echo "encode $src -> $out (${SEC}s, ${BR})"
	ffmpeg -y -i "$src" -t "$SEC" -vn -c:a aac -b:a "$BR" -ar 44100 -movflags +faststart "$out"
done
echo "done."
