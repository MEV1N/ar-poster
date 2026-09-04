# Production-Ready WebAR Image-Tracking Experience for Event Poster

A high-performance, mobile-first WebAR application that detects and tracks a physical event poster using optical feature-tracking (**MindAR + Three.js**). When recognized through the phone camera, a synchronized AR video, pulsing holographic cyber-borders, 3D particle vortex, and spatial audio project directly onto the poster with real-time perspective locking.

Works on modern **Android Chrome** and **iOS Safari (iOS 14+)** without requiring any app store downloads or plugins.

---

## Live Demo & Pages

| Page | URL Path | Description |
| :--- | :--- | :--- |
| **WebAR Experience** | [`/index.html`](http://localhost:5173/index.html) | Public AR camera scanner with loading screen, optical guidance, and audio unlock. |
| **Calibration Studio** | [`/index.html?mode=calibration`](http://localhost:5173/index.html?mode=calibration) | Admin/Developer calibration studio with real-time transform sliders, 3D visual bounding box, and JSON export/import. |
| **Target Poster Reference** | [`/poster.html`](http://localhost:5173/poster.html) | Fullscreen printable/displayable event poster with QR code and instructions. |
| **Target Compiler Studio** | [`/compiler.html`](http://localhost:5173/compiler.html) | In-browser MindAR compiler tool: drag-and-drop any poster image, inspect feature density, and generate `.mind` targets. |

---

## Directory Structure

```
ar-poster/
├── index.html                   # Main WebAR application entry point
├── poster.html                  # Reference printable / on-screen poster viewer
├── compiler.html                # Built-in MindAR Image Target Compiler & feature viewer
├── main.js                      # Application controller & state coordinator
├── main.css                     # Mobile-first glassmorphism design system
├── package.json                 # Scripts and dependencies
├── vite.config.js               # Dev server, HTTPS settings, auto-save endpoint
│
├── /assets/                     # Static target assets & icons
│   ├── event-poster.jpg         # High-contrast 896x1200 target poster image
│   └── qr-sample.png            # QR code sample pointing to experience
│
├── /targets/                    # Compiled binary feature descriptor targets
│   └── event-poster.mind        # MindAR compiled binary feature target
│
├── /videos/                     # AR video assets
│   └── event-promo.mp4          # High-energy event promo video
│
├── /animations/                 # AR 3D shader and dynamic visual systems
│   ├── holo-border.js           # Animated cyber reticle & pulsing scanlines
│   └── particle-system.js       # 3D particle sparks & ambient vortex
│
├── /components/                 # Modular public UI components
│   ├── loading-screen.js        # Loading & camera permissions modal
│   ├── tracking-hud.js          # Public mobile guidance HUD (detected/lost/recenter)
│   ├── unmute-overlay.js        # Mobile autoplay policy audio unlock toast
│   └── fallback-view.js         # Graceful fallback for non-WebAR/non-camera devices
│
├── /ar/                         # Core WebAR Tracking Engine
│   ├── ar-manager.js            # MindAR & Three.js lifecycle, start/stop/recenter
│   ├── video-plane.js           # Three.js AR video plane mesh, texture, playback
│   ├── content-anchor.js        # Anchor group, smoothing filter, debounce logic
│   └── bounds-visualizer.js     # 3D calibration bounding box & corner markers
│
├── /calibration/                # Administrator / Developer Calibration Studio
│   ├── calibration-manager.js   # State store, save/load/reset/export/import JSON
│   ├── calibration-panel.js     # Floating glassmorphic calibration UI & inputs
│   └── calibration-panel.css    # Responsive styles for calibration studio
│
└── /config/                     # Configuration files
    ├── default-calibration.json # Default calibration parameters (position, scale, etc.)
    └── app-config.js            # App settings (paths, target aspect ratio, audio)
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

### 2. Display the Poster Target
Open [`http://localhost:5173/poster.html`](http://localhost:5173/poster.html) on a second computer screen, tablet, or print it out.

### 3. Open WebAR on Mobile Phone
- Scan the QR code on the poster page or visit `http://<YOUR-LAN-IP>:5173/` on your phone (connected to the same Wi-Fi).
- Tap **"ENTER AR EXPERIENCE"** and allow camera permission.
- Point your rear camera at the poster.
- The AR video, holographic border, and particles will snap and lock onto the poster!

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
