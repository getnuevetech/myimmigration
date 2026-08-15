# MyImmigration — Deployment Guide

**Stack:** Next.js standalone server + PostgreSQL, both running in Docker on an AWS Lightsail Ubuntu server.
**Auto-deploy:** GitHub Actions SSHes into the server on every push to `main`, pulls the latest code, syncs the Prisma schema, and rebuilds the Docker image directly on the server. No external registry required.

## Repo Deployment Notes

- The app is a Next.js 16 App Router project that builds with `output: "standalone"` and runs with `node server.js` in the production container.
- PostgreSQL runs as a sibling Docker Compose service with data stored in the `postgres_data` Docker volume.
- This repo currently has `prisma/schema.prisma` but no `prisma/migrations` directory. Use `docker compose run --rm db-sync` to run `prisma db push`. If migrations are added later, replace that command with `prisma migrate deploy`.
- Runtime settings such as AI keys, `NEXT_PUBLIC_APP_URL`, and `AUTH_SESSION_SECRET` can be supplied in `.env` and then managed from `/admin/platform-settings` where supported.

---

## Step 1 — Create Lightsail Instance

1. Go to [AWS Lightsail](https://lightsail.aws.amazon.com/) → **Create instance**
2. Select **Linux/Unix** → **OS Only** → **Ubuntu 24.04 LTS**
3. Choose plan: minimum **$10/mo** (2 GB RAM)
4. Name it (e.g. `myimmigration-prod`) → **Create instance**

---

## Step 2 — Attach Static IP

1. Lightsail → **Networking** → **Static IPs** → **Create static IP**
2. Attach it to your instance
3. Note the IP address — you'll use it in every step below

---

## Step 3 — Open Firewall Ports

In your instance → **Networking** tab → **IPv4 Firewall**, add:

| Application | Protocol | Port | Notes |
|-------------|----------|------|-------|
| SSH | TCP | 22 | Keep restricted to trusted IPs if possible |
| HTTP | TCP | 80 | Needed for Caddy/HTTPS setup |
| HTTPS | TCP | 443 | Needed after a domain is attached |
| App | TCP | 3000 | Optional for initial IP-only testing; remove after HTTPS is working |

---

## Step 4 — SSH Into the Server

**Download your SSH key:**  
Lightsail → Account (top right) → **SSH keys** → Download the default key → save as `lightsail-key.pem`

**Connect (Mac / Linux):**
```bash
chmod 400 ~/Downloads/lightsail-key.pem
ssh -i ~/Downloads/lightsail-key.pem ubuntu@<your-static-ip>
```

**Connect (Windows):**  
Use PuTTY. Convert `lightsail-key.pem` to `.ppk` with PuTTYgen, then connect to `ubuntu@<your-static-ip>`.

---

## Step 5 — Install Docker

Run all of the following on the server:

```bash
sudo apt update && sudo apt upgrade -y
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

**Log out and reconnect** so the group change takes effect:
```bash
exit
ssh -i ~/Downloads/lightsail-key.pem ubuntu@<your-static-ip>
```

Verify Docker is working:
```bash
docker run --rm hello-world
```

---

## Step 6 — Clone the Repository

```bash
git clone https://github.com/getnuevetech/myimmigration.git ~/myimmigration
cd ~/myimmigration
```

---

## Step 7 — Configure Environment

```bash
cp .env.example .env
nano .env
```

Set these values:

```bash
# Required: set a strong password for the Postgres container
POSTGRES_PASSWORD=your-secure-password-here

# Required: same password, URL-encoded for Prisma connection strings
# Example: "abc@2007" becomes "abc%402007"
POSTGRES_PASSWORD_URL_ENCODED=your-url-encoded-secure-password-here

# Required: generate with `openssl rand -base64 32`
AUTH_SESSION_SECRET=replace-with-a-long-random-value

# Enables the /admin area while the admin shell is still preview-gated
ADMIN_PREVIEW_ENABLED=true

# Your server's public URL while testing by IP
NEXT_PUBLIC_APP_URL=http://<your-static-ip>:3000

# Optional at first; can also be entered in /admin/platform-settings
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
```

> The Compose file builds `DATABASE_URL` for the app container from `POSTGRES_USER`, `POSTGRES_PASSWORD_URL_ENCODED`, and `POSTGRES_DB`, pointing at the internal `db` service. If your password contains URL-reserved characters like `@`, `:`, `/`, `?`, `#`, or `&`, they must be percent-encoded in `POSTGRES_PASSWORD_URL_ENCODED`.

---

## Step 8 — Start the Database and Sync Schema

```bash
cd ~/myimmigration
docker compose up -d --build db
docker compose run --rm db-sync
```

`db-sync` runs `prisma db push`, which matches the current repo state because there are no Prisma migration files yet.

---

## Step 9 — Start the Application

```bash
cd ~/myimmigration
docker compose up -d --build app
```

Check that both containers are running:
```bash
docker compose ps
```

Expected output:
```
NAME                    STATUS
myimmigration-db-1      Up (healthy)
myimmigration-app-1     Up
```

---

## Step 10 — Verify

Open in your browser:
```
http://<your-static-ip>:3000
```

Then go to `/admin/platform-settings` and enter your AI API keys:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_AI_API_KEY`

---

## Step 11 — Enable Auto-Deploy (GitHub Actions)

After every push to `main`, GitHub Actions will SSH into the server, pull the latest code, start the database, run `db-sync`, and rebuild the app image automatically. No registry or tokens needed.

**Add these secrets** to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Value |
|--------|-------|
| `LIGHTSAIL_HOST` | Your static IP |
| `LIGHTSAIL_USER` | `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | Full contents of `lightsail-key.pem` |

To get the PEM content:
```bash
cat ~/Downloads/lightsail-key.pem
```
Copy the entire output (including `-----BEGIN RSA PRIVATE KEY-----` lines) and paste it as the secret value.

Push any change to `main` to test — watch the run in the **Actions** tab.

---

## Step 12 — (Optional) HTTPS with Caddy

Skip this section if you're only using an IP address. For a real domain:

**First, point your domain DNS:**  
Add an **A record** at your DNS provider pointing `yourdomain.com` → your static IP. Wait for propagation.

**Install Caddy on the server:**
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

**Configure Caddy:**
```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the file contents with:
```caddy
yourdomain.com {
  reverse_proxy localhost:3000
}
```

**Start Caddy:**
```bash
sudo systemctl enable --now caddy
```

Caddy will automatically obtain a TLS certificate. The app is now at `https://yourdomain.com`.

**Update your app URL:**
```bash
nano ~/myimmigration/.env
# Set: NEXT_PUBLIC_APP_URL=https://yourdomain.com
docker compose restart app
```

---

## Day-to-Day Commands

```bash
# View logs
docker compose -f ~/myimmigration/docker-compose.yml logs -f app

# Restart the app
docker compose -f ~/myimmigration/docker-compose.yml restart app

# Manual update (auto-deploy handles this normally)
cd ~/myimmigration
git pull
docker compose up -d --build --remove-orphans db
docker compose run --rm db-sync
docker compose up -d --build --remove-orphans app

# Sync the Prisma schema manually
docker compose -f ~/myimmigration/docker-compose.yml run --rm db-sync

# Stop everything
docker compose -f ~/myimmigration/docker-compose.yml down

# ⚠️ Stop and DELETE all data
docker compose -f ~/myimmigration/docker-compose.yml down -v
```
