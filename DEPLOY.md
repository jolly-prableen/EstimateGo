# Deploy EstimateGo Online (Free)

Two deployments, in order. Do Step 1 completely first — the web app needs the backend URL.

## Step 1 — Backend API on Render

### 1.1 Push code to GitHub

1. Go to https://github.com/new
   - Repository name: `estimatego`
   - Private is fine
   - Click **Create repository**
2. In VS Code terminal:

```bash
git remote add origin https://github.com/YOUR_USERNAME/estimatego.git
git add .
git commit -m "EstimateGo app"
git branch -M main
git push -u origin main
```

(Replace YOUR_USERNAME. First push asks for GitHub login — use the browser popup.)

### 1.2 Create the API service

1. Go to https://render.com → **Sign up with GitHub**
2. Click **New +** → **Blueprint** → select your `estimatego` repo
   (It reads `render.yaml` automatically: Node runtime, start command `node backend/server.js`)
3. Click **Apply** / **Create Service**
4. Wait ~2 min for first deploy

Your backend URL will look like:

```
https://estimatego-api.onrender.com
```

Test it: open `<that-url>/api/dashboard` in your browser — you should see JSON.

Note (free tier): the API sleeps after 15 min idle; the first request after a pause takes ~30–60s to wake. Data can reset on cold starts.

## Step 2 — PWA on Netlify

Tell the assistant/backend URL from Step 1 first, because the web app must be built with that URL baked in:

```bash
$env:EXPO_PUBLIC_BACKEND_URL="https://estimatego-api.onrender.com"
npx expo export --platform web --output-dir dist-web
Remove-Item Env:EXPO_PUBLIC_BACKEND_URL
```

Then:

1. Go to https://app.netlify.com → sign up free
2. **Sites** → drag-and-drop the `dist-web` folder onto the deploy area
3. Netlify gives you a live URL like `https://estimatego.netlify.app`

## Step 3 — Install on iPhone (PWA)

1. Open the Netlify URL in **Safari** on the iPhone
2. Tap **Share** button → scroll → **Add to Home Screen**
3. Tap **Add** → EstimateGo icon appears on home screen
4. Opening it runs fullscreen like a real app — no PC needed, works anywhere
