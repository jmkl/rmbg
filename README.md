# RMBG Studio

A local background-removal and face-restoration studio with a Blender-compositor-style node graph, powered by [BiRefNet](https://github.com/ZhengPeng7/BiRefNet) and [GFPGAN](https://github.com/TencentARC/GFPGAN) on your own GPU/CPU. Images become nodes; every layer is wired into a 1280 × 720 Output node and composited live. Masks and restored faces are cached on disk, so running the same operation on the same pixels is instant.

- **`/`** — node studio
- **`/extract`** — the original single-image remover
- **`/health`** — model / device status
- **`/docs`** — FastAPI API docs

## Run it

```powershell
# 1. Python environment (once)
#    Use the CUDA wheel that matches your driver (cu118 / cu121), or plain torch for CPU.
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
pip install -r requirements.txt

# 2. Build the frontend (once, and after frontend changes)
cd frontend
npm install
npm run build
cd ..

# 3. Start the local server
python main.py
```

Open <http://127.0.0.1:8000>.

Both models load lazily on their first request, so the server starts instantly. A local copy in `models/BiRefNet` is used automatically; otherwise the checkpoint is downloaded from Hugging Face. GFPGAN is read from `models/GFPGANv1.4.pth`; face detection/parsing weights live in `models/facexlib/` (`detection_Resnet50_Final.pth` and `parsing_parsenet.pth`). Models are freed when the server stops, after `MODEL_IDLE_TIMEOUT` idle seconds (off by default), or via `POST /api/unload`. `MODEL_ID`, `MODEL_IDLE_TIMEOUT`, `FACE_MODEL_PATH`, `CACHE_DIR` (default `output/cache`), `INPUT_DIR`, `OUTPUT_DIR`, `WORKSPACES_DIR`, and `PORT` are optional environment variables.

## Frontend development

The Vite dev server proxies `/api`, `/input`, `/output`, and `/workspaces` to the Python server on port 8000:

```powershell
cd frontend
npm run dev
```

Open the printed `localhost:5173` URL. Use `npm run build` to produce `frontend/dist`.

## Using the studio

- **Add images** with the top-left HUD button, `Ctrl+V`, or by dropping files anywhere. Paste or drop an image URL and it is fetched through the local proxy.
- **Replace an image** by dropping a file onto an existing image node, or by pasting while that image node is selected. It keeps the node's transform and disconnects any upstream image input so the new file is shown.
- **Right-click the canvas** to open the add-node menu (Noise Texture, Blend, Mask, Group, Route, Hue/Saturation, Curves, Color Balance, Exposure, Gradient Map, Invert, Gradient, Face Restore). The node is created where you clicked. The same menu lists images from the local `input/` and `output/` folders; click one to add it to the graph.
- **Noise Texture** generates a procedural grayscale texture. Its output follows the Viewer's width and height (1280×720 by default); adjust Scale, Detail, Roughness, Lacunarity, Distortion, and Seed on the node.
- **Adjustment nodes** mirror common Photoshop controls: **Curves** (editable RGB, red, green, and blue tone curves; click to add a point, drag points, right-click to remove), **Color Balance** (shadows, midtones, or highlights with optional luminosity preservation), **Exposure** (EV, offset, and gamma), **Gradient Map** (shadow, mid, and highlight colors plus midpoint and reverse), and **Invert** (amount). They process the current frame and preserve its alpha channel.
- Each input socket accepts one link; connecting another link to it replaces the old one. The **Group** and **Viewer** inputs are the exceptions and stack multiple links. A **Route** node has exactly one input and one output, replaces its old output when reconnected, and stays out of the layer list so routes never become extra layers.
- **Drop source images into `input/`** and find every processed result in `output/` as `<source>.rembg.<key>.png` or `<source>.restored.<key>.png`. Model results are content-addressed under `output/cache/`; repeating the same operation loads the stored PNG without loading or running the model.
- Every image node has an **image input**. Connect any upstream node (for example **Face Restore**) to use its output as the source; a fresh image node is a full-frame pass-through until you move or scale it. Background removal runs on that input too.
- Select an image node to edit its position, scale, rotation, opacity, and visibility, or to run **Remove background** (BiRefNet). Masks are soft, cached, and can be disabled/re-run. The node thumbnail previews the current result even before the node is connected to the Viewer; use **Use AI mask** to compare with and without the mask without re-running the model. If an upstream input changes, the mask is marked **mask stale** until re-run.
- **Face Restore** nodes restore faces with GFPGAN. Connect an image, choose **Strength** and **All faces / Center face only**, then press **Restore faces**. While the input or settings change, the button becomes **Restore again** and the node passes the input through. After a restore, the **Restored / Original** toggle compares both views instantly without re-running the model.
- In **Edit** mode, drag layers to reorder them, toggle visibility, or select one to adjust its transform. Every layer has a copy button for its rendered PNG — including Groups — and **⧉ Canvas** at the top of the panel copies the entire composite.
- Use **Node / Split ↕ / Split ↔ / Edit** to switch layouts. **Split ↕** (the default) stacks the editor above the graph with a horizontal divider; **Split ↔** puts the graph on the left and the editor on the right. Drag the divider to resize, double-click it to reset to 50/50, and each orientation remembers its position. In a narrow side-by-side pane the editor inspector moves below the preview.
- **Shift+A** opens the add menu at the cursor with its node filter focused. Type to narrow the list, **↑/↓** to focus a result, and **Enter** to add it. It switches to the stacked view first when only the editor is visible.
- **Ctrl+drag** across a link (or Ctrl+click it) cuts the connection, like Blender's link knife. **Alt+click** an edge also removes it.
- **Delete** or **Backspace** removes the selected node (the Viewer is protected, and Backspace no longer navigates the browser back). **Shift+E** toggles Node/Edit mode. **Shift+D** duplicates the selected node. **Export PNG** saves the composite.
- **Templates** in the header save the whole graph — nodes, links, settings, every source image, AI masks, and face-restore results. Loading one restores that content instantly without loading a model. Source images, masks, restores, and thumbnails are stored in `output/shared/` by content hash, so a template and a project that use the same image share one file. Each row has rename and delete actions; **＋ Save current as template** always creates a new template.
- **Project** stores its graph metadata under `workspaces/projects/` and references images in the shared `output/shared/` pool, so projects can be overwritten or deleted without duplicating image data. **Ctrl+S** saves the open project (or asks for a name), **Ctrl+Shift+S** saves a new copy, and the menu lists saved projects with rename/delete actions.
- **Unsaved-session recovery** snapshots the current graph, images, masks, and restores into the browser's IndexedDB every ~1.5 seconds. If the page reloads or the server stops unexpectedly, the next load restores that draft without contacting the backend. Saving as a project or template clears the draft; editing afterward starts a new one.
- Scroll to zoom, drag the pane to pan, or use the canvas controls to fit the graph.

## Architecture

```
frontend/src/
├── core/
│   ├── nodes.ts            node registry: sockets, fields, evaluate()
│   ├── evaluate.ts         pull-based, memoized graph evaluator
│   ├── graph.svelte.ts     reactive graph store, masks, face-restore cache, snapshot/import
│   ├── workspace.ts        template/project upload, download, rename, delete
│   ├── session.ts          IndexedDB crash-recovery autosave
│   └── paint.ts            canvas thumbnail action
├── App.svelte              shell, header, shortcut handling, right-click add menu
├── NodeView.svelte         generic node shell (handles, fields, thumbnail)
├── ImageBody.svelte        image node preview, mask toggle, remove-background
├── FaceRestoreBody.svelte  face-restore action/status
├── CurvesBody.svelte       interactive RGB / per-channel tone curve editor
└── EditMode.svelte         layer list and direct canvas transforms
```

The graph is evaluated from the Viewer node upstream. Each node definition owns its sockets, defaults, and an `evaluate` function; results are memoized per node using content signatures, so changing a transform does not re-run BiRefNet or GFPGAN. Svelte Flow positions live on the node wrappers, while image placement is stored separately in the node params.

### Adding a node type

The editor itself does not know about node kinds. To add one:

1. Add a `NodeDef` to `frontend/src/core/nodes.ts` (sockets, `fields`, `defaults`, `evaluate`). Set `creatable: true` to list it in the right-click menu.
2. Add a body component under `frontend/src/` and register it in `NodeView.svelte` if the node needs custom UI.
3. If it needs async server work, cache the result in `graph.svelte.ts` and expose it through `Ctx` (see `facerestore`).

### Backend

- `POST /api/remove` — image form field (`file`) or `url`; returns RGBA PNG.
- `POST /api/mask` — same inputs plus `max_side` and optional `name`; returns a soft mask encoded as an RGBA PNG with white RGB and the mask in the alpha channel (so the browser can apply it with `destination-in`). Also writes a ready-to-use cutout to `output/`.
- `POST /api/restore` — `file` or `url`, plus `strength` (0–1), `only_center` (bool), optional `max_side`, and `name`; returns a PNG with faces restored by GFPGAN. Alpha is preserved and the input resolution is kept.
- `GET /api/files` — lists images in `input/` and `output/` (name, URL, size, mtime).
- `GET /api/workspaces/templates` / `GET /api/workspaces/projects` — list saved graphs (newest first) with name, node count, and thumbnail URL.
- `POST /api/workspaces/{templates|projects}` — multipart save: `manifest` JSON plus `asset_*`, `mask_*`, `restore_*`, and optional `thumb` files. Images are written to the shared `output/shared/` pool by content hash. Returns the new id.
- `GET /api/workspaces/{kind}/{id}` — full manifest, including the `output/shared/...` path of every saved image.
- `PUT /api/workspaces/{kind}/{id}` — overwrite a saved project in place.
- `PATCH /api/workspaces/{kind}/{id}` — rename with `{ "name": "..." }`.
- `DELETE /api/workspaces/{kind}/{id}` — remove the saved graph metadata. Shared images stay in `output/shared/` because other workspaces may reference them.
- `GET /workspaces/<kind>/<id>/<file>` — read-only access to legacy bundled assets, masks, restores, and thumbnails.
- `GET /input/<name>`, `GET /output/<name>` — read-only access to those folders, including `output/shared/` and `output/cache/`.
- `GET /api/fetch?url=` — server-side image download for URL previews.
- `POST /api/unload` — free both models from RAM/VRAM (skipped while a model is in use).
- `GET /health` — `{ ok, model, device, loaded, status, face_model, face_device, face_loaded, face_status, face_available }`.

Both models load on first use and unload at shutdown, on demand, or after `MODEL_IDLE_TIMEOUT` seconds idle. BiRefNet and GFPGAN share one GPU lock, so inference never overlaps.

### Disk cache and folders

```
input/                      drop source images here (also listed in the right-click menu)
output/                     <source>.rembg.<key>.png / <source>.restored.<key>.png
output/cache/mask/          soft masks, one per content + model
output/cache/restore/       restored images, one per content + strength + face mode
output/shared/assets/       source images used by templates/projects, named by SHA-256
output/shared/masks/        saved AI masks, shared across workspaces
output/shared/restores/     saved face-restore results, shared across workspaces
output/shared/thumbs/       template/project thumbnails
workspaces/
  templates/<id>/           workspace.json (legacy folders may still have bundled images)
  projects/<id>/            same layout for named projects
```

On startup, images from older workspaces are moved into `output/shared/` and the manifests are updated automatically, so existing templates and projects keep loading while their files become shareable.

The cache key is a SHA-256 of the processed pixels (mode, size, bytes), the operation, and its settings. A hit returns the stored PNG immediately — the model is not loaded, so this also works after `POST /api/unload` or after a restart. The shared images in `output/shared/` are content-addressed too: saving the same source image in a template and a project stores it once, and deleting a workspace never removes files another workspace may still use. Delete `output/cache/` to reclaim model-cache space; saved masks and face restores remain in `output/shared/`. Set `CACHE_DIR` to move only the model cache, or `INPUT_DIR` / `OUTPUT_DIR` to move the whole input/output pool. Bump `CACHE_VERSION` in `main.py` to invalidate model results after a model or pipeline change.
