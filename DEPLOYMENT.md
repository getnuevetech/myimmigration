# Deploying MyImmigration to a server

Two simple paths:
- **Option A:** run directly with Docker Compose on your server
- **Option B:** keep using GitHub Actions auto-deploy to Lightsail

---

## Option A — Docker Compose on the server (recommended)

Requirements: a Linux server with Docker + Compose plugin.

### 1) Database setup

PostgreSQL runs as a Docker container defined in `docker-compose.yml` — no external database required.

The default credentials are set via environment variables. Copy the example file and optionally change passwords:

```bash
# On the server
git clone https://github.com/getnuevetech/myimmigration.git
cd myimmigration

cp .env.example .env
# Optional: edit .env to change POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
# Required: set ADMIN_PREVIEW_ENABLED=true for admin access
```

Minimal `.env` overrides:

```bash
POSTGRES_USER=myimmigration
POSTGRES_PASSWORD=change-me-in-production
POSTGRES_DB=myimmigration
ADMIN_PREVIEW_ENABLED=true
```

The `DATABASE_URL` in `.env.example` is already wired to the `db` Docker service — no changes needed unless you change the credentials above.

```bash
# Required if GHCR package is private
echo <GHCR_TOKEN_WITH_READ_PACKAGES> | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin

docker compose pull
docker compose up -d
```

Then open `/admin/platform-settings` and set:
- `OPENAI_API_KEY`
- `OPENAI_DEFAULT_MODEL` (optional but recommended)
- any other runtime variables you want to manage from admin

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
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo ${VERSION_CODENAME}) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
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
POSTGRES_PASSWORD=change-me-in-production
ADMIN_PREVIEW_ENABLED=true
```

The `DATABASE_URL` is pre-configured to point to the `db` Docker service — no external database needed.

7. **Initial run on server**

```bash
# Required if GHCR package is private
echo <GHCR_TOKEN_WITH_READ_PACKAGES> | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin

docker compose pull
docker compose up -d
```

Open `/admin/platform-settings` and configure AI/runtime values there.

8. **Enable auto-deploy**
   Add these GitHub Actions secrets:
   - `LIGHTSAIL_HOST`
   - `LIGHTSAIL_USER` (usually `ubuntu`)
   - `LIGHTSAIL_SSH_KEY` (private key PEM content)
   
   Then push to `main`.
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

Before enabling Caddy, make sure ports `80` and `443` are open in the Lightsail firewall (same firewall area used in Option B step 3).  
Then enable Caddy:

```bash
sudo systemctl enable --now caddy
```

Point DNS to your server static IP.
