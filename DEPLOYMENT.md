# Deploying MyImmigration to a server

Two simple paths:
- **Option A:** run directly with Docker Compose on your server
- **Option B:** keep using GitHub Actions auto-deploy to Lightsail

---

## Option A — Docker Compose on the server (recommended)

Requirements: a Linux server with Docker + Compose plugin.

### 1) Database setup (required)

This app needs PostgreSQL.  
Create a PostgreSQL database first (recommended: managed DB like Neon/Supabase/RDS), then copy the connection string.

In `.env`, set:

```bash
DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:5432/myimmigration?schema=public
OPENAI_API_KEY=your_openai_key
```

```bash
# On the server
git clone https://github.com/getnuevetech/myimmigration.git
cd myimmigration

cp .env.example .env
# edit .env and set DATABASE_URL + OPENAI_API_KEY

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

### First-time Lightsail setup steps

1. **Create instance**  
   Lightsail → Create instance → Linux/Unix → Ubuntu 24.04 LTS.
2. **Attach static IP**  
   Lightsail → Networking → Static IPs.
3. **Open firewall ports**  
   - `3000` (app)
   - `22` (SSH)
   - `80/443` only if using HTTPS reverse proxy.
4. **SSH into server** (usually user `ubuntu`).
5. **Install Docker + Compose plugin**

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Log out and log back in so Docker group access applies.

6. **Bootstrap app on server**

```bash
git clone https://github.com/getnuevetech/myimmigration.git
cd myimmigration
cp .env.example .env
```

Edit `.env` and set at least:

```bash
DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:5432/myimmigration?schema=public
OPENAI_API_KEY=your_openai_key
```

7. **Initial run on server**

```bash
docker compose pull
docker compose up -d
```

8. **Enable auto-deploy**
   Add the 3 GitHub secrets above, then push to `main`.
   The workflow will build, push, and deploy automatically.

---

## Optional HTTPS (Caddy)

For internet-facing usage, put Caddy in front:

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
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
