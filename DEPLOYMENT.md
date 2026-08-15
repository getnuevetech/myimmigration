# MyImmigration — Deployment Guide

**Stack:** Next.js app + PostgreSQL, both running in Docker on an AWS Lightsail Ubuntu server.  
**Auto-deploy:** GitHub Actions builds and pushes the image on every merge to `main`, then SSHes to the server to pull and restart.

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

| Application | Protocol | Port |
|-------------|----------|------|
| SSH | TCP | 22 |
| App | TCP | 3000 |
| HTTP | TCP | 80 |
| HTTPS | TCP | 443 |

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
# Set a strong password for the Postgres container
POSTGRES_PASSWORD=your-secure-password-here

# Enables the /admin area
ADMIN_PREVIEW_ENABLED=true

# Your server's public URL
NEXT_PUBLIC_APP_URL=http://<your-static-ip>:3000
```

> Leave `DATABASE_URL` as-is — it already points to the `db` Docker service.

---

## Step 8 — Log In to GitHub Container Registry

The app image is hosted on GHCR. If the repository package is **private**, authenticate first:

1. Go to GitHub → **Settings** → **Developer settings** → **Personal access tokens (classic)**
2. Generate a token with the `read:packages` scope
3. On the server:

```bash
echo <YOUR_GHCR_TOKEN> | docker login ghcr.io -u <YOUR_GITHUB_USERNAME> --password-stdin
```

---

## Step 9 — Start the Application

```bash
cd ~/myimmigration
docker compose pull
docker compose up -d
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

## Step 10 — Run Database Migrations

```bash
docker compose exec app npx prisma migrate deploy
```

> Run this again after any deployment that includes database schema changes.

---

## Step 11 — Verify

Open in your browser:
```
http://<your-static-ip>:3000
```

Then go to `/admin/platform-settings` and enter your AI API keys:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_AI_API_KEY`

---

## Step 12 — Enable Auto-Deploy (GitHub Actions)

After every push to `main`, GitHub Actions will build the image and deploy it to the server automatically.

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

## Step 13 — (Optional) HTTPS with Caddy

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
cd ~/myimmigration && git pull && docker compose pull && docker compose up -d --remove-orphans

# Run migrations after a schema-changing deploy
docker compose -f ~/myimmigration/docker-compose.yml exec app npx prisma migrate deploy

# Stop everything
docker compose -f ~/myimmigration/docker-compose.yml down

# ⚠️ Stop and DELETE all data
docker compose -f ~/myimmigration/docker-compose.yml down -v
```
