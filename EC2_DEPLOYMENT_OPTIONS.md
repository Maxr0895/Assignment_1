# EC2 Deployment Options - Choose Your Method

You have **2 ways** to deploy WBR Actionizer on EC2:

## 🐳 Option 1: Docker (Recommended) ⭐

**Pros:**
- ✅ Isolated environment
- ✅ Consistent across different systems
- ✅ Easy to update and rollback
- ✅ Follows your Docker practical
- ✅ No dependency conflicts

**Cons:**
- ❌ Requires Docker knowledge
- ❌ Slightly more resource usage

**Quick Start:**
```bash
# On EC2
git clone https://github.com/Maxr0895/Assignment_1.git
cd Assignment_1
chmod +x deploy-docker.sh
./deploy-docker.sh
```

**📚 Guide:** `DOCKER_QUICK_START.md`

---

## 📦 Option 2: Direct Node.js

**Pros:**
- ✅ Lower resource usage
- ✅ Direct access to files
- ✅ Simpler for debugging

**Cons:**
- ❌ Must install Node.js, ffmpeg manually
- ❌ Dependency conflicts possible
- ❌ System-specific issues

**Quick Start:**
```bash
# On EC2
git clone https://github.com/Maxr0895/Assignment_1.git
cd Assignment_1
chmod +x deploy-to-ec2.sh
./deploy-to-ec2.sh
```

**📚 Guide:** `QUICK_EC2_DEPLOY.md`

---

## 📊 Comparison Table

| Feature | Docker | Node.js |
|---------|--------|---------|
| **Setup Time** | 5-7 min | 3-5 min |
| **Isolation** | ✅ Full | ❌ None |
| **Updates** | Easy (rebuild) | Manual |
| **Resource Use** | ~500MB RAM | ~300MB RAM |
| **Portability** | ✅ High | ❌ Low |
| **Follows Practical** | ✅ Yes | ❌ No |

---

## 🎯 Which Should You Choose?

### Choose Docker if:
- ✅ Following the Docker practical
- ✅ Want production-like deployment
- ✅ Need isolation and consistency
- ✅ Plan to deploy to cloud (ECS, Kubernetes)

### Choose Node.js if:
- ✅ Limited EC2 resources (t2.micro)
- ✅ Quick testing only
- ✅ Familiar with Node.js debugging
- ✅ Don't need containers

---

## 🚀 Both Methods Work!

Your EC2 instance: `ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com`

**Access after deployment:**
```
http://ec2-13-236-121-131.ap-southeast-2.compute.amazonaws.com:8080
```

**Login:** `admin` / `admin`

---

## 📝 Files Reference

### Docker Deployment
- `DOCKER_QUICK_START.md` - Quick start guide
- `DOCKER_DEPLOYMENT.md` - Detailed guide
- `deploy-docker.sh` - Automated script
- `docker-compose.yml` - Container orchestration
- `Dockerfile` - Image definition

### Node.js Deployment
- `QUICK_EC2_DEPLOY.md` - Quick start guide
- `EC2_DEPLOYMENT_GUIDE.md` - Detailed guide  
- `deploy-to-ec2.sh` - Automated script

### Shared
- `env.example` - Environment template
- `.gitignore` - Excludes .env from git

---

## ⚠️ Important: Don't Forget!

Regardless of method:

1. **Open port 8080** in Security Group
2. **Add your OpenAI API key** to `.env`
3. **Test the health endpoint:**
   ```bash
   curl http://localhost:8080/health
   ```

---

**Ready to deploy?** Pick your method and follow the guide! 🚀
