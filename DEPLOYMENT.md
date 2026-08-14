# Deploying MyImmigration to a server

Two simple paths:
- **Option A:** run directly with Docker Compose on your server
- **Option B:** keep using GitHub Actions auto-deploy to Lightsail

---

## Option A — Docker Compose on the server (recommended)

Requirements: a Linux server with Docker + Compose plugin.

```bash
# On the server
git clone https://github.com/getnuevetech/myimmigration.git
cd myimmigration

cp .env.example .env
# edit .env and set at least OPENAI_API_KEY (and any values your setup needs)

docker compose pull
docker compose up -d
```

App will be available at:
- `http://<server-ip>:3000`

Useful commands:

```bash
docker compose logs -f app
docker compose ps
docker compose restart app
```

Update to latest:

```bash
git pull
docker compose pull
docker compose up -d
```

---

## Option B — GitHub Actions auto-deploy to Lightsail

This repo already has `.github/workflows/deploy.yml`.
On every push to `main`, it:
1. Builds Docker image
2. Pushes to `ghcr.io/getnuevetech/myimmigration:latest`
3. SSHes to your server and runs `docker compose pull && docker compose up -d --remove-orphans`

Set these GitHub Actions secrets:
- `LIGHTSAIL_HOST`
- `LIGHTSAIL_USER` (usually `ubuntu`)
- `LIGHTSAIL_SSH_KEY` (private key PEM content)

For first-time server setup:
1. Create an Ubuntu Lightsail instance
2. Open firewall port `3000` (and `80/443` if using a reverse proxy)
3. Install Docker + Compose plugin
4. Clone this repo on the server and create `.env`

---

## Optional HTTPS (Caddy)

For internet-facing usage, put Caddy in front:

```bash
sudo apt update
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```caddy
yourdomain.com {
  reverse_proxy localhost:3000
}
```

Then:

```bash
sudo systemctl enable --now caddy
sudo systemctl reload caddy
```

Point DNS to your server IP and open ports `80` and `443`.
