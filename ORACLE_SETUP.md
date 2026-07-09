# Oracle Cloud VM에 Meetily 웹서비스 배포 가이드

## 1. VM 생성 (Oracle Cloud Console)

1. **로그인** → https://cloud.oracle.com
2. 좌측 메뉴 → **Compute** → **Instances**
3. **Create Instance**
   - Name: `meetily-backend`
   - Image: **Canonical Ubuntu 24.04 LTS** (Minimum, ARM 또는 AMD)
   - Shape: **VM.Standard.E2.1.Micro** (평생 무료 — 1코어 OCPU, 1GB RAM)
   - VCN: 기본값 (또는 새로 만들기)
   - Subnet: 기본 퍼블릭 서브넷
   - Boot volume: 50GB (평생 무료 포함)

4. **SSH 키 추가** (중요)
   - `Add SSH keys` → `Generate a key pair for me`
   - **Download private key** → `.pem` 파일을 안전한 폴더에 저장
   - **Download public key** → 필요 없음

5. **Create** 버튼 클릭 → 2~3분 후 VM 생성됨

---

## 2. 방화벽 (보안 목록) 설정

VM의 VCN에서 포트를 열어야 합니다.

1. 좌측 메뉴 → **Networking** → **Virtual Cloud Networks**
2. VM이 속한 VCN 클릭
3. **Security Lists** → 기본 security list 클릭
4. **Add Ingress Rules** — 아래 규칙 2개 추가:

| Source Type | Source CIDR | IP Protocol | Destination Port | Description |
|-------------|-------------|-------------|------------------|-------------|
| CIDR | `0.0.0.0/0` | TCP | `80` | HTTP |
| CIDR | `0.0.0.0/0` | TCP | `443` | HTTPS |
| CIDR | `0.0.0.0/0` | TCP | `8000` | API (개발용) |

---

## 3. 고정 공인 IP 할당

VM 재시작해도 IP가 바뀌지 않도록 예약된 IP 주소 연결합니다.

1. VM 상세 화면 → **Instance Details** → **Attached VNICs**
2. VNIC 이름 클릭 → **IPv4 Addresses** → `...` → **Edit**
3. **Reserve a public IP** → 예약하고 할당

이제 VM의 공인 IP가 고정됩니다.

---

## 4. VM 접속

```bash
# Windows (PowerShell)
ssh -i C:\path\to\ssh-key-2026-07-08.key ubuntu@<VM-공인IP>

# Mac/Linux
chmod 400 ssh-key-2026-07-08.key
ssh -i ./ssh-key-2026-07-08.key ubuntu@<VM-공인IP>
```

---

## 5. Docker + Nginx 설치

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Docker Compose 설치 (별도 바이너리)
sudo apt install -y docker-compose-plugin

# 로그아웃 후 재접속 (docker 권한 적용)
exit
# ssh 재접속

# 버전 확인
docker --version          # Docker version 24.x+
docker compose version    # Docker Compose version v2.x+
```

---

## 6. Meetily 백엔드 배포

```bash
# 홈 디렉토리로 이동
cd ~

# GitHub에서 프로젝트 클론 (직접 만든 레포로 변경)
git clone https://github.com/<YOUR_USERNAME>/meetily-web.git
cd meetily-web/backend

# .env 파일 생성
nano .env
```

`.env` 파일 내용:
```env
OPENAI_API_KEY=sk-...여기에-키를-넣으세요
SECRET_KEY=여기에-랜덤-문자열-입력
FRONTEND_URL=http://localhost:3000
DATABASE_URL=sqlite:///./data/meetily.db

# PayPal (선택 — 없으면 무료 티어만 작동)
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_PRO_PLAN_ID=
PAYPAL_TEAM_PLAN_ID=
```

실행:
```bash
# 백그라운드 실행 (pm2 대신 nohup)
mkdir -p data
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > app.log 2>&1 &

# 또는 tmux/screen으로
sudo apt install -y tmux
tmux new -s meetily
uvicorn app.main:app --host 0.0.0.0 --port 8000
# Ctrl+B, D 로 분리

# 프로세스 확인
curl http://localhost:8000/api/plans   # ✅ 작동 확인
```

---

## 7. Nginx 리버스 프록시 + SSL

```bash
# Nginx 설치
sudo apt install -y nginx certbot python3-certbot-nginx

# Nginx 설정
sudo nano /etc/nginx/sites-available/meetily
```

```nginx
server {
    listen 80;
    server_name meetily.yourdomain.com;  # ← 실제 도메인

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }
}
```

```bash
# 설정 활성화
sudo ln -s /etc/nginx/sites-available/meetily /etc/nginx/sites-enabled/
sudo nginx -t           # 설정 검증
sudo systemctl reload nginx

# SSL 인증서 발급
sudo certbot --nginx -d meetily.yourdomain.com

# 자동 갱신 확인
sudo certbot renew --dry-run
```

---

## 8. systemd로 자동 시작 등록

VM 재부팅해도 백엔드가 자동으로 시작되도록 합니다.

```bash
sudo nano /etc/systemd/system/meetily.service
```

```ini
[Unit]
Description=Meetily Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/meetily-web/backend
ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
EnvironmentFile=/home/ubuntu/meetily-web/backend/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable meetily
sudo systemctl start meetily
sudo systemctl status meetily   # ✅ 동작 확인
```

---

## 9. 프론트엔드 (Vercel)

1. **GitHub**에 `meetily-web` 레포 push
2. **Vercel** 가입 → **Add New Project** → GitHub 레포 연결
3. `Root Directory`: `frontend`
4. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL`: `https://meetily.yourdomain.com`
5. **Deploy** → 몇 분 뒤 자동 배포 완료

---

## 10. 전체 구조

```
사용자
  ↓ https://meetily.vercel.app
[Vercel] — Next.js 프론트엔드
  ↓ API 요청
[Oracle Cloud VM] — Nginx (SSL) → FastAPI (8000)
  ↓
[SQLite] — /home/ubuntu/meetily-web/backend/data/meetily.db
```

---

## 11. 백업

```bash
# 매일 새벽 DB 백업
crontab -e
# 하단에 추가:
0 3 * * * cp /home/ubuntu/meetily-web/backend/data/meetily.db /home/ubuntu/backups/meetily-$(date +\%Y\%m\%d).db
0 4 * * * find /home/ubuntu/backups -name "*.db" -mtime +30 -delete
```

---

## 12. 모니터링

```bash
# 로그 확인
tail -f /home/ubuntu/meetily-web/backend/app.log
journalctl -u meetily -f

# 프로세스 확인
ps aux | grep uvicorn

# 디스크 확인
df -h

# API 헬스체크
curl https://meetily.yourdomain.com/api/plans
```
