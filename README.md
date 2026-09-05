# WebAR Multi-Target Experience for Event Posters

A high-performance, mobile-first WebAR application that detects and tracks multiple physical event posters using optical feature-tracking (**MindAR + Three.js**). When recognized through the phone camera, the corresponding synchronized AR video, pulsing holographic borders, 3D particle vortex, and spatial audio project directly onto the poster with real-time perspective locking.

- **Poster 1 (`poster.png`)** ➔ Plays **`video.mp4`**
- **Poster 2 (`poster 2.png`)** ➔ Plays **`video 2.mp4`**
- **Public Access**: Only the camera page (`/index.html` or `/`) is publicly accessible. All other pages are disabled/restricted.

Works on modern **Android Chrome** and **iOS Safari (iOS 14+)** without requiring any app store downloads or plugins.

---

## Adding More Targets & Videos in 3 Simple Steps

Adding new posters and videos is completely declarative and automated:

### 1. Place the Assets in `public/`
Drop your new poster image and video into the `public/` folder:
- e.g. `public/poster 3.png`
- e.g. `public/video 3.mp4`

### 2. Register the Target in `config/app-config.js`
Open [`config/app-config.js`](file:///c:/Users/mevin_z1mcnwj/Desktop/ar%20poster/config/app-config.js) and add an entry to the `TARGETS` array:
```javascript
export const TARGETS = [
  {
    id: 'poster-1',
    name: 'Poster 1',
    imageSrc: './poster.png',
    videoSrc: './video.mp4',
    aspectRatio: 941 / 1672
  },
  {
    id: 'poster-2',
    name: 'Poster 2',
    imageSrc: './poster 2.png',
    videoSrc: './video 2.mp4',
    aspectRatio: 941 / 1672
  },
  // Add your new target here:
  {
    id: 'poster-3',
    name: 'Poster 3',
    imageSrc: './poster 3.png',
    videoSrc: './video 3.mp4',
    aspectRatio: 941 / 1672
  }
];
```

### 3. Compile the Target Features
Run the compilation command in your terminal:
```bash
npm run compile-targets
```
This automatically compiles feature keypoints for all posters into `public/targets/targets.mind`. The WebAR app will now instantly recognize and track all registered posters!

---

## Pages & Access Control

| Page | URL Path | Access | Description |
| :--- | :--- | :--- | :--- |
| **WebAR Camera Experience** | `/index.html` or `/` | **Public** | Clean, mobile WebAR camera view that tracks all posters. |
| **Admin Calibration Studio** | `/?admin=true` or triple-tap | **Admin** | Slide-out calibration tool for fine-tuning AR offsets. |
| **Compiler Tool** | `tools/compiler.html` | **Internal** | Offline target generator used by `npm run compile-targets`. |

---

## Directory Structure

```
ar-poster/
├── index.html                   # Sole public WebAR camera entry point
├── main.js                      # Application controller & state coordinator
├── main.css                     # Mobile-first glassmorphism design system
├── package.json                 # Scripts (dev, build, preview, compile-targets)
├── vite.config.js               # Dev server & single-page production bundler
│
├── config/
│   └── app-config.js            # TARGETS registry (add new posters & videos here!)
│
├── ar/                          # WebAR Tracking Engine
│   ├── ar-manager.js            # Multi-target MindAR lifecycle coordinator
│   ├── video-plane.js           # Multi-video texture mapping & fallback loader
│   ├── content-anchor.js        # Anchor group, smoothing filter, debounce logic
│   └── bounds-visualizer.js     # 3D calibration bounding box & corner markers
│
├── tools/                       # Internal tools (excluded from public build)
│   ├── compile-targets.mjs      # Automated CLI compiler (`npm run compile-targets`)
│   ├── compiler.html            # MindAR Image Target Compiler UI
│   └── poster.html              # Printable/on-screen reference poster viewer
│
├── public/                      # Static assets served at root
│   ├── poster.png               # Poster 1
│   ├── poster 2.png             # Poster 2
│   ├── video.mp4                # Video 1 (linked to Poster 1)
│   ├── video 2.mp4              # Video 2 (linked to Poster 2)
│   └── targets/targets.mind     # Compiled multi-target tracking descriptors
```

---

## Quick Start (Testing the Experience)

### 1. Start the Local Server
```bash
npm run dev
```
Vite will start and display your local and LAN URLs:
```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.x.x:5173/
```

### 2. Display the Posters to Test
Open `public/poster.png` or `public/poster 2.png` on another screen, tablet, or print them out.
- Scanning **Poster 1** will play **Video 1 (`video.mp4`)**.
- Scanning **Poster 2** will play **Video 2 (`video 2.mp4`)**.

### 3. Open WebAR on Mobile Phone
- Visit `http://<YOUR-LAN-IP>:5173/` on your phone (connected to the same Wi-Fi).
- Tap the screen and allow camera permission.
- Point your rear camera at either poster.
- The corresponding AR video, holographic border, and audio will snap and lock onto the poster!

---

## Administrator Guide: How to Customize & Deploy

### 1. How to Replace the Target Image
1. Place your new event poster image into `/assets/`, e.g.:
   ```
   /assets/my-new-poster.jpg
   ```
2. For optimal optical tracking reliability:
   - Use high visual contrast (dark background with sharp shapes/text or vice-versa).
   - Avoid large, smooth, single-color blank areas.
   - Include distinct asymmetrical typography, logos, or geometric linework.
3. Update `config/app-config.js` with your new image path and its dimensions/aspect ratio:
   ```javascript
   target: {
     name: 'My New Event Poster',
     imageSrc: './assets/my-new-poster.jpg',
     mindSrc: './targets/my-new-poster.mind',
     aspectRatio: 1080 / 1440, // width / height
     originalWidth: 1080,
     originalHeight: 1440
   }
   ```

---

### 2. How to Generate & Configure the `.mind` Target File
The application includes a built-in, client-side **Target Compiler Studio**:

1. Open [`/compiler.html`](http://localhost:5173/compiler.html) in your browser.
2. Drag and drop your poster image into the dropzone (or click **"Load /assets/event-poster.jpg"**).
3. Click **"Compile Image Target"**.
4. The compiler runs locally using Web Workers and TensorFlow.js, showing a progress bar and rendering the detected keypoints on the canvas in real time:
   - **Green / ★★★★★ rating**: High feature density, fast acquisition, rock-solid tracking.
   - **Yellow / ★★★★ rating**: Good tracking stability.
5. Click **"Download targets.mind"** and save the file into `/targets/event-poster.mind` (or your configured target path).
   *(Note: during local development with `npm run dev`, clicking compile automatically writes to `/targets/event-poster.mind` via the built-in server endpoint).*

---

### 3. How to Replace the AR Video
1. Place your promotional video into `/videos/`, e.g.:
   ```
   /videos/event-promo.mp4
   ```
2. Video recommendations for mobile browsers:
   - **Format:** MP4 (`H.264` video codec, `AAC` audio codec) or WebM.
   - **Resolution:** 720p (720×960 or 720×1280) is optimal for mobile GPU memory.
   - **Audio:** Browser autoplay policy requires videos to start muted. The built-in audio component displays a sleek **"Tap to Unmute"** prompt when tracked.
3. Update `config/app-config.js`:
   ```javascript
   video: {
     src: './videos/event-promo.mp4',
     loop: true,
     preload: 'auto',
     playsInline: true
   }
   ```

---

### 4. How to Customize Animations & Overlays
The AR scene is modular and supports multiple simultaneous layers:
- **Holographic Border (`animations/holo-border.js`):**
  - Adjust colors, line widths, corner bracket sizes, or vertical scanline speed.
  - To change the pulsing rate, modify `const pulse = 0.7 + 0.3 * Math.sin(time * 3.5);`.
- **3D Particle Vortex (`animations/particle-system.js`):**
  - Adjust particle count (`count = 100`), colors (cyan, magenta, green), float velocity, or orbit radius.
- **Adding 3D GLB/GLTF Models:**
  - Import Three.js `GLTFLoader` inside `ar/content-anchor.js` and add `gltf.scene` to `this.contentGroup`. It will inherit all calibration position, rotation, and scaling automatically!

---

### 5. How to Calibrate Tracking & Positioning
1. Switch to Calibration Mode:
   - Click the **"Calibrate"** pill in the top header HUD, or
   - Append `?mode=calibration` to the URL: `http://localhost:5173/?mode=calibration`.
2. The **AR Calibration Studio** floating panel appears:
   - **Position Offset:** `X`, `Y`, and `Depth (Z)` sliders.
   - **Scale & Proportions:** `Uniform Scale`, `Width Ratio (X)`, `Height Ratio (Y)`.
   - **Rotation:** `Roll (Z)`, `Pitch (X)`, `Yaw (Y)`.
   - **Media:** `Video Opacity`, `Video Start Offset` (seek start seconds).
   - **Tracking Filter:** `Smoothing Factor` (0.0 = raw optical, 0.9 = ultra-smooth lerp), `Lost Target Debounce` (ms delay before hiding when target is obstructed).
   - **Visual 3D Bounding Box:** Toggles the yellow/cyan alignment frame and 3D crosshair.
3. Click **"Save Calibration"**:
   - Values are instantly saved to browser `localStorage` and will persist across reloads and for normal public mode.
4. Click **"Export JSON"**:
   - Downloads `ar-poster-calibration.json`. You can commit this file or paste it into `config/default-calibration.json` to make it the factory default for all users.

---

### 6. Deployment Guide (HTTPS is Mandatory)

> [!IMPORTANT]
> Mobile browsers strictly enforce that the Web Camera API (`navigator.mediaDevices.getUserMedia`) is only accessible over **HTTPS** or `localhost`. Deploying to an HTTPS host is mandatory for production.

#### Option A: Deploy to Vercel (1-Click)
1. Push your repository to GitHub.
2. In Vercel, click **"Add New Project"** and select your repository.
3. Build Settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Deploy! Vercel automatically issues an SSL certificate for HTTPS.

#### Option B: Deploy to Netlify
1. Run:
   ```bash
   npm run build
   ```
2. Drag and drop the `dist/` folder into Netlify Drop, or connect your Git repository.
3. Netlify automatically provides free HTTPS.

#### Option C: Self-Hosted Nginx / Apache
Ensure your Nginx server block serves the proper MIME types:
```nginx
types {
    application/octet-stream mind;
    video/mp4 mp4;
    video/webm webm;
}
```
And enforce SSL/TLS with Let's Encrypt (`certbot`).

---

## QR Code Distribution
Generate your final event QR code pointing to your production HTTPS URL:
```
https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=https://your-domain.com/
```
Print this QR code onto the corner or bottom banner of your physical event poster!
