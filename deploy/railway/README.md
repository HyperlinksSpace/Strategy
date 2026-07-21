# Railway — optional self-host (not production)

**Production Strategy site uses [Vercel](../vercel/README.md), not Railway.**

Railway hosts only the **TinyModel sidecar**: [tinymodel.hyperlinks.space](https://tinymodel.hyperlinks.space) (TinyModel repo).

The `Strategy-AI-Gateway` service (if created) duplicated the Vercel `/api/ai` role — you can **delete it** in Railway dashboard if you do not need it:

Railway → HSP → Strategy-AI-Gateway → Settings → Delete service

To redeploy TinyModel sidecar only, use the **TinyModel** repo:

```bash
cd TinyModel
bash deploy/railway/deploy-new-instance.sh
```
