# MyImmigration — Server Setup & Deployment Guide

This guide walks through setting up the application on an AWS Lightsail server from scratch.
The stack uses **Docker Compose** for both the app and the PostgreSQL database — no external database service needed.

---

## Overview

| Component | How it runs |
|-----------|-------------|
| Next.js app | Docker container (`ghcr.io/getnuevetech/myimmigration:latest`) |
| PostgreSQL 16 | Docker container (named volume for persistence) |
| Auto-deploy | GitHub Actions pushes to server on every merge to `main` |

---

## Part 1 — Lightsail Instance

### 1.1 Create the instance

1. Open [AWS Lightsail](https://lightsail.aws.amazon.com/)
2. **Create instance** → Platform: **Linux/Unix** → Blueprint: **OS Only → Ubuntu 24.04 LTS**
3. Choose instance plan (minimum **$10/mo** — 2 GB RAM recommended)
4. Name it (e.g. `myimmigration-prod`) and click **Create instance**

### 1.2 Attach a static IP

1. Lightsail → **Networking** → **Static IPs** → Create static IP
2. Attach it to your new instance
3. Note the IP — you'll need it throughout this guide

### 1.3 Open firewall ports

In your instance → **Networking** tab → **Firewall**, add:

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH |
| 3000 | TCP | App (before HTTPS) |
| 80 | TCP | HTTP (Caddy / HTTPS redirect) |
| 443 | TCP | HTTPS |

---

## Part 2 — Server Preparation

### 2.0 Get your SSH key and connect

Lightsail provides a default SSH key pair. Download it:

1. Lightsail → top-right **Account** menu → **SSH keys**
2. Download the **Default** key → save as e.g. `lightsail-key.pem`
3. On your local machine:

```bash
chmod 400 ~/Downloads/lightsail-key.pem
ssh -i ~/Downloads/lightsail-key.pem ubuntu@<your-static-ip>
```

> On Windows use PuTTY or Windows Terminal with the key converted to `.ppk` format via PuTTYgen.

SSH into the server:

```bash
ssh -i ~/Downloads/lightsail-key.pem ubuntu@<your-static-ip>
```

### 2.1 System update

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Install Docker + Compose plugin

```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo ${VERSION_CODENAME}) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

**Log out and log back in** so the Docker group change takes effect:

```bash
exit
ssh ubuntu@<your-static-ip>
```

Verify Docker works:

```bash
docker run --rm hello-world
```

---

## Part 3 — Application Setup

### 3.1 Clone the repository

Clone into your home directory — this is where the deploy workflow expects it:

```bash
git clone https://github.com/getnuevetech/myimmigration.git ~/myimmigration
cd ~/myimmigration
```

### 3.2 Configure environment

```bash
cp .env.example .env
nano .env   # or vim .env
```

Set these values at minimum:

```bash
# Strong password for the PostgreSQL container
POSTGRES_PASSWORD=change-me-to-something-secure

# Enables the /admin area
ADMIN_PREVIEW_ENABLED=true

# Your app's public URL (used for links/redirects)
NEXT_PUBLIC_APP_URL=http://<your-static-ip>:3000
# Update to https://yourdomain.com once HTTPS is configured
```

> **DATABASE_URL** is pre-wired to the `db` Docker service — leave it as-is unless you changed `POSTGRES_USER`/`POSTGRES_DB`.

### 3.3 Authenticate with GitHub Container Registry

The Docker image is hosted on GHCR. If the package is private, log in first:

```bash
echo <GHCR_TOKEN_WITH_READ_PACKAGES> | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
```

> Generate a token at GitHub → Settings → Developer settings → Personal access tokens → `read:packages` scope.

### 3.4 Pull and start the stack

```bash
docker compose pull
docker compose up -d
```

This starts:
- `db` — PostgreSQL 16 (waits until healthy before starting app)
- `app` — Next.js app on port 3000

Check everything is running:

```bash
docker compose ps
docker compose logs -f app
```

### 3.5 Run database migrations

On first boot the database schema needs to be created:

```bash
docker compose exec app npx prisma migrate deploy
```

> Run this again after any deployment that includes schema changes.

### 3.6 Verify the app

Open in your browser:

```
http://<your-static-ip>:3000
```

Then visit `/admin/platform-settings` to configure AI keys:
- `OPENAI_API_KEY`
- `OPENAI_DEFAULT_MODEL` (e.g. `gpt-4o`)
- `ANTHROPIC_API_KEY` (for Claude-based agents)
- `GOOGLE_AI_API_KEY` (for Gemini-based agents)

---

## Part 4 — Enable Auto-Deploy (GitHub Actions)

The repo includes `.github/workflows/deploy.yml`. On every push to `main` it:
1. Builds the Docker image
2. Pushes it to `ghcr.io/getnuevetech/myimmigration:latest`
3. SSHes to your server, runs `cd ~/myimmigration && git pull && docker compose pull && docker compose up -d --remove-orphans`

> The workflow expects the repo to be cloned at `~/myimmigration` on the server (done in step 3.1).

### 4.1 Add GitHub Actions secrets

In your GitHub repo → **Settings** → **Secrets and variables** → **Actions**, add:

| Secret | Value |
|--------|-------|
| `LIGHTSAIL_HOST` | Your static IP |
| `LIGHTSAIL_USER` | `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | Contents of your Lightsail SSH private key (PEM format) |

To get your SSH private key from Lightsail:  
Lightsail → **Account** → **SSH keys** → Download the default key.

### 4.2 Test it

Push any change to `main` and watch the **Actions** tab in GitHub. The workflow will build, push, and deploy automatically.

> ⚠️ **After any deploy that includes database schema changes**, run migrations manually:
> ```bash
> ssh -i ~/Downloads/lightsail-key.pem ubuntu@<your-static-ip>
> cd ~/myimmigration
> docker compose exec app npx prisma migrate deploy
> ```

---

## Part 5 — Optional: HTTPS with Caddy

Skip this if you only need HTTP access. For a public domain, follow these steps.

### 5.1 Point DNS

Add an **A record** at your DNS provider pointing your domain to the server's static IP.  
Wait for it to propagate before continuing.

### 5.2 Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### 5.3 Configure Caddyfile

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the contents with:

```caddy
yourdomain.com {
  reverse_proxy localhost:3000
}
```

### 5.4 Enable Caddy

```bash
sudo systemctl enable --now caddy
```

Caddy will automatically obtain a TLS certificate from Let's Encrypt.  
The app will now be available at `https://yourdomain.com`.

Update `NEXT_PUBLIC_APP_URL` in `.env` to your domain and restart:

```bash
docker compose restart app
```

---

## Day-to-day Operations

### View logs
```bash
docker compose logs -f app
docker compose logs -f db
```

### Restart the app
```bash
docker compose restart app
```

### Update to the latest image (manual)
```bash
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f
```

### Run database migrations after an update
```bash
docker compose exec app npx prisma migrate deploy
```

### Stop everything
```bash
docker compose down
```

### Stop and remove all data (destructive)
```bash
docker compose down -v
```
