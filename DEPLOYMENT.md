# AWS Lightsail + Docker Deployment Guide

## Overview

The app is containerized via Docker and deployed to an AWS Lightsail instance. A GitHub Actions workflow automatically builds the image, pushes it to GitHub Container Registry (GHCR), and deploys it to Lightsail on every push to `main`.

---

## 1. Create an AWS Lightsail Instance

1. Go to [AWS Lightsail](https://lightsail.aws.amazon.com/) → **Create instance**
2. Choose **Linux/Unix** → **OS Only** → **Amazon Linux 2023** (or Ubuntu 22.04)
3. Select a plan — **$10/month (2 GB RAM)** is sufficient to start
4. Name it (e.g., `myimmigration-prod`) and click **Create instance**

---

## 2. Configure Networking

1. In the Lightsail console, go to your instance → **Networking** tab
2. Add a firewall rule: **TCP port 3000** (or 80/443 if using a reverse proxy)
3. Note the **Static IP** — attach one under **Networking → Static IPs** so the address doesn't change on reboot

---

## 3. Install Docker on the Instance

SSH into the instance (use the Lightsail browser console or your own SSH key):

```bash
# Amazon Linux 2023
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Log out and back in for group change to take effect
```

---

## 4. Upload the docker-compose.yml

Copy `docker-compose.yml` to the server:

```bash
scp docker-compose.yml ec2-user@<LIGHTSAIL_IP>:~/docker-compose.yml
```

Or clone the repo directly on the server:

```bash
git clone https://github.com/getnuevetech/myimmigration.git
cd myimmigration
```

---

## 5. Set Environment Variables on the Server

Create a `.env` file next to `docker-compose.yml`:

```bash
# On the Lightsail instance
cat > .env <<EOF
OPENAI_API_KEY=sk-...your-key-here...
EOF
```

> ⚠️ Never commit this file. It is already in `.gitignore`.

---

## 6. GitHub Secrets (for CI/CD)

Add the following secrets in **GitHub → Settings → Secrets and variables → Actions**:

| Secret name        | Value                                         |
|--------------------|-----------------------------------------------|
| `LIGHTSAIL_HOST`   | Public IP or hostname of your Lightsail instance |
| `LIGHTSAIL_USER`   | SSH username (e.g., `ec2-user` or `ubuntu`)   |
| `LIGHTSAIL_SSH_KEY`| Contents of your private SSH key (PEM format) |

The `GITHUB_TOKEN` secret is provided automatically by GitHub Actions.

---

## 7. First Manual Deploy

After the server is configured, pull and start the container manually the first time:

```bash
# On the Lightsail instance
echo <GITHUB_TOKEN> | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
docker compose pull
docker compose up -d
```

---

## 8. Automatic Deploys

Every push to `main` will:
1. Build a new Docker image
2. Push it to `ghcr.io/getnuevetech/myimmigration:latest`
3. SSH into the Lightsail instance and run `docker compose pull && docker compose up -d`

---

## 9. (Optional) Add HTTPS with Caddy

Install Caddy on the Lightsail instance for automatic TLS:

```bash
sudo dnf install -y caddy   # or use the official install script
```

Create `/etc/caddy/Caddyfile`:

```
yourdomain.com {
    reverse_proxy localhost:3000
}
```

Then `sudo systemctl enable --now caddy` and open ports 80 and 443 in the Lightsail firewall.

---

## App URL

After deployment the app is reachable at:

- `http://<LIGHTSAIL_IP>:3000` (without Caddy)
- `https://yourdomain.com` (with Caddy + DNS pointing to the static IP)
