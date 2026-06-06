# Lambda Hosting Casualties - What I Faced

## Issues Encountered & Fixes

### 1. Missing node_modules in Deployment
**Issue:** `Cannot find module '@fastify/aws-lambda'`
**Root Cause:** Uploaded only `dist/` folder without dependencies
**Fix:** Include `node_modules` in zip: `zip -r lambda.zip dist/ node_modules/ package.json`
**Checkpoint:** Verify zip contains `node_modules/@fastify/aws-lambda/` before upload

### 2. Lambda Timeout (3 seconds)
**Issue:** Request timing out, logs show `Duration: 3000.00 ms`, `Status: timeout`
**Root Cause:** Default Lambda timeout is 3 seconds, MongoDB connection takes 2-3 seconds
**Fix:** Configuration → General configuration → Timeout = 29 seconds (API Gateway max)
**Checkpoint:** Check CloudWatch logs for `REPORT` line showing timeout status

### 3. Low Memory (128 MB)
**Issue:** Lambda running slow, potential memory issues with Mongoose + Firebase
**Root Cause:** Default Lambda memory is 128 MB
**Fix:** Configuration → General configuration → Memory = 1024 MB
**Checkpoint:** Verify `Memory Size: 1024 MB` in CloudWatch logs

### 4. MongoDB IP Whitelist
**Issue:** MongoDB connection timeout after increasing Lambda timeout
**Root Cause:** Lambda has dynamic IPs, MongoDB Atlas blocks unknown IPs
**Fix:** MongoDB Atlas → Network Access → Add IP Address → `0.0.0.0/0` (allow all)
**Checkpoint:** Test MongoDB connection from Lambda CloudWatch logs for "✅ Connected to MongoDB"

### 5. API Gateway Routing - Missing Proxy Route
**Issue:** `{"message":"Missing Authentication Token"}`
**Root Cause:** API Gateway only routing specific paths, missing catchall
**Fix:**
- REST API: Tried `{proxy+}` route - didn't work
- HTTP API: Created route `ANY /` (✅ worked)
**Result:** HTTP API with simple `ANY /` route successfully routes all requests to Lambda
**Checkpoint:** Trigger should show route configured and integration attached

### 6. API Gateway Stage Prefix (/default)
**Issue:** `/health` returns 404, but `/default/health` works
**Root Cause:** HTTP API includes stage name in path by default
**Fix:** Add URL rewrite in Fastify config:
```typescript
rewriteUrl: (req) => {
  const url = req.url || '';
  if (url.startsWith('/default/')) return url.substring(8);
  if (url === '/default') return '/';
  return url;
}
```
**Checkpoint:** Both `/health` and `/default/health` should return 200

### 7. Missing Environment Variables
**Issue:** Application errors related to missing config
**Root Cause:** Lambda doesn't have access to local `.env` file
**Fix:** Configuration → Environment variables → Add all required vars:
- `MONGODB_URI`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `CLIENT_URL`
- `NODE_ENV=production`
**Checkpoint:** Lambda logs should not show "environment variable not defined" errors

### 8. Handler Configuration
**Issue:** Lambda can't find handler function
**Root Cause:** Handler setting pointing to wrong file/function
**Fix:** Configuration → Runtime settings → Handler = `lambda.handler`
- Format: `filename.exportedFunction`
- `lambda` = lambda.js file
- `handler` = exported function name
**Checkpoint:** Test Lambda in console, should not show "Cannot find module" error

### 9. File Structure in Deployment Package
**Issue:** Lambda can't find files even though they're in the zip
**Root Cause:** Files from `dist/` folder nested inside a `dist/` directory in Lambda
**Fix:** Extract files at root level:
```bash
cd dist && zip -r ../lambda.zip .  # Files at root
cd .. && zip -r lambda.zip node_modules package.json
```
**Checkpoint:** `unzip -l lambda.zip | grep lambda.js` should show `lambda.js` not `dist/lambda.js`

### 10. API Gateway Integration Not Attached
**Issue:** Routes created but still getting 404
**Root Cause:** Route exists but integration to Lambda not attached
**Fix:** API Gateway → Integrations → Attach integration to route → Select Lambda function
**Checkpoint:** Routes page should show Lambda function name next to each route

## Performance Metrics

**Cold Start:** 2-3 seconds (first request after idle)
**Warm Request:** <100ms
**Memory Used:** ~140 MB (for this app)
**Recommended Settings:**
- Memory: 1024 MB
- Timeout: 29 seconds
- Concurrency: Default 1000

## Dependencies Added for Lambda

```json
{
  "dependencies": {
    "@fastify/aws-lambda": "^6.4.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.161"
  }
}
```

## Code Changes Required

### 1. Lambda Handler (`src/lambda.ts`)
Wrapper to convert Fastify app to Lambda handler

### 2. Database Connection Reuse (`src/utils/database.ts`)
Check if already connected before reconnecting (for warm invocations)

### 3. URL Rewriting (`src/app.ts`)
Strip API Gateway stage prefix from URLs

## Quick Validation Checklist

- [ ] Lambda timeout ≥ 29 seconds
- [ ] Lambda memory ≥ 1024 MB
- [ ] MongoDB IP whitelist includes `0.0.0.0/0`
- [ ] Environment variables set in Lambda
- [ ] Handler = `lambda.handler`
- [ ] API Gateway route: `ANY /{proxy+}` or `$default`
- [ ] Integration attached to Lambda function
- [ ] Deployment package includes `node_modules/`
- [ ] Files at root level in zip (not nested in `dist/`)
- [ ] Test `/health` endpoint returns 200


