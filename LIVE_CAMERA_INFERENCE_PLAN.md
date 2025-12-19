# Live Camera Inference - Implementation Plan

## 📋 Overview

This document outlines the implementation plan for live camera inference feature. The frontend will capture frames from the user's camera, send them to the backend for YOLO inference, and display annotated frames in real-time.

---

## 🏗️ Architecture

```
User's Browser (Frontend)
  ├─ Accesses local camera via MediaDevices API
  ├─ Captures frames (10-15 FPS)
  ├─ Sends frames to backend via HTTP POST
  └─ Displays annotated frames received from backend

Azure Backend (Your Code)
  ├─ Receives frames via API endpoint
  ├─ Runs YOLO inference on frames
  ├─ Returns annotated frames
  └─ Manages inference job state
```

---

## 🔄 Data Flow

```
1. Frontend: POST /api/inference/live/start { modelId }
   ↓
2. Backend: Creates InferenceJob, returns inferenceId
   ↓
3. Frontend: Starts camera capture loop
   ↓
4. Frontend: POST /api/inference/live/:inferenceId/frame { image: base64 }
   ↓
5. Backend: Saves frame, runs YOLO inference
   ↓
6. Backend: Returns annotated frame (base64 or URL)
   ↓
7. Frontend: Displays annotated frame
   ↓
8. Repeat steps 4-7 (real-time loop)
   ↓
9. Frontend: POST /api/inference/live/:inferenceId/stop
   ↓
10. Backend: Stops processing, updates job status
```

---

## 👨‍💻 BACKEND ENGINEER IMPLEMENTATION

### Step 1: Update Python Inference Script

**File:** `inference-scripts/run_inference.py`

**Changes Needed:**
- Add support for processing single image (not just folders)
- Accept image as base64 string or file path
- Return annotated image as base64 or save to file

**New Function to Add:**
```python
def run_inference_on_image(model_path, image_data, conf=0.25, output_dir=None):
    """
    Run inference on a single image.
    
    Args:
        model_path: Path to YOLO model checkpoint
        image_data: Base64 encoded image string OR file path
        conf: Confidence threshold
        output_dir: Directory to save annotated image (optional)
    
    Returns:
        {
            'annotated_image': base64_string or file_path,
            'detections': [...],
            'total_detections': int
        }
    """
```

**Implementation Notes:**
- Use `cv2.imdecode()` to decode base64 image
- Run `model.predict()` on single image
- Return annotated image as base64 or save to temp file
- Return detection metadata (classes, confidences, bboxes)

---

### Step 2: Create New Python Script for Single Frame Processing

**File:** `inference-scripts/process_frame.py` (NEW FILE)

**Purpose:** Process a single frame sent from frontend

**Usage:**
```bash
python process_frame.py --model /path/to/model.pt --image /path/to/image.jpg --output /path/to/output.jpg --conf 0.25
```

**Or accept base64:**
```bash
python process_frame.py --model /path/to/model.pt --image-base64 "data:image/jpeg;base64,..." --output /path/to/output.jpg
```

**Returns:**
- Saves annotated image to output path
- Prints JSON metadata to stdout (detections, counts, etc.)

---

### Step 3: Update Inference Controller

**File:** `controllers/inferenceController.js`

#### 3.1 Update `startLiveInference` function

**Current Location:** Line 302

**Changes:**
- Validate model exists (already done ✅)
- Create InferenceJob with `sourceType: 'live_camera'`
- Create temp directory for storing frames
- Return `inferenceId` and frame processing endpoint URL

**Updated Code Structure:**
```javascript
const startLiveInference = async (req, res) => {
  // ... existing validation ...
  
  // ✅ Create temp directory for frames
  const framesDir = path.join(process.cwd(), 'uploads', 'live-frames', inferenceId);
  await storageAdapter.ensureDir(framesDir);
  
  // ✅ Create InferenceJob
  const inferenceJob = new InferenceJob({
    inferenceId,
    modelId: model._id,
    company: model.company,
    project: model.project,
    sourceType: 'live_camera',
    status: 'running',
    startedAt: new Date(),
    // Store frames directory path
    results: {
      framesPath: framesDir
    }
  });
  
  await inferenceJob.save();
  
  return res.status(200).json({
    inferenceId,
    status: 'running',
    message: 'Live camera inference started',
    frameEndpoint: `/api/inference/live/${inferenceId}/frame`
  });
};
```

#### 3.2 Create New Function: `processLiveFrame`

**File:** `controllers/inferenceController.js`

**New Function:**
```javascript
/**
 * POST /api/inference/live/:inferenceId/frame
 * 
 * Process a single frame from live camera
 * 
 * Body: {
 *   image: "data:image/jpeg;base64,..." // Base64 encoded image
 *   confidenceThreshold?: 0.25 // Optional
 * }
 */
const processLiveFrame = async (req, res) => {
  try {
    const { inferenceId } = req.params;
    const { image, confidenceThreshold = 0.25 } = req.body;
    
    // ✅ Validate inferenceId
    // ✅ Find InferenceJob
    // ✅ Validate job is running
    // ✅ Validate image data
    // ✅ Decode base64 image
    // ✅ Save frame to temp file
    // ✅ Run Python inference script
    // ✅ Read annotated frame
    // ✅ Return annotated frame as base64 or URL
  }
};
```

**Implementation Details:**
- Extract base64 image data (remove `data:image/jpeg;base64,` prefix)
- Save frame to temp file: `framesDir/frame_${timestamp}.jpg`
- Spawn Python script: `process_frame.py --model ... --image ... --output ...`
- Read annotated image from output
- Return as base64 or file URL
- Clean up old frames (keep only last N frames)

#### 3.3 Create New Function: `stopLiveInference`

**File:** `controllers/inferenceController.js`

**New Function:**
```javascript
/**
 * POST /api/inference/live/:inferenceId/stop
 * 
 * Stop live camera inference
 */
const stopLiveInference = async (req, res) => {
  try {
    const { inferenceId } = req.params;
    
    // ✅ Find InferenceJob
    // ✅ Update status to 'completed' or 'cancelled'
    // ✅ Clean up temp frames directory
    // ✅ Return success response
  }
};
```

#### 3.4 Create New Function: `getLiveFrame`

**File:** `controllers/inferenceController.js`

**New Function (Optional - for polling approach):**
```javascript
/**
 * GET /api/inference/live/:inferenceId/frame
 * 
 * Get latest annotated frame (for polling approach)
 */
const getLiveFrame = async (req, res) => {
  try {
    const { inferenceId } = req.params;
    
    // ✅ Find InferenceJob
    // ✅ Get latest annotated frame file
    // ✅ Return image file
  }
};
```

---

### Step 4: Update Routes

**File:** `routes/inference.js`

**Add New Routes:**
```javascript
// After line 91 (after /live/start route)

/**
 * POST /api/inference/live/:inferenceId/frame
 * Process a single frame from live camera
 */
router.post('/live/:inferenceId/frame', processLiveFrame);

/**
 * GET /api/inference/live/:inferenceId/frame
 * Get latest annotated frame (optional - for polling)
 */
router.get('/live/:inferenceId/frame', getLiveFrame);

/**
 * POST /api/inference/live/:inferenceId/stop
 * Stop live camera inference
 */
router.post('/live/:inferenceId/stop', stopLiveInference);
```

**Update Exports:**
```javascript
// In controllers/inferenceController.js module.exports
module.exports = {
  // ... existing exports ...
  processLiveFrame,
  getLiveFrame,
  stopLiveInference
};
```

---

### Step 5: Update Inference Worker (Optional)

**File:** `workers/inferenceWorker.js`

**Note:** For live camera, we might not need the worker since processing happens on-demand via API. But if you want background processing:

- Handle `live_camera` sourceType in worker
- Keep Python process running
- Process frames as they arrive

**Recommendation:** Skip worker for now, process frames directly in controller.

---

### Step 6: Update InferenceJob Model (if needed)

**File:** `models/InferenceJob.js`

**Check if `results.framesPath` field exists. If not, add:**
```javascript
results: {
  // ... existing fields ...
  framesPath: {
    type: String // Path to directory storing frames
  }
}
```

**Note:** This might already be flexible enough. Check if `results` schema accepts arbitrary fields.

---

## 🎨 FRONTEND ENGINEER IMPLEMENTATION

### Overview

The frontend engineer needs to:
1. Access user's camera using browser APIs
2. Capture frames at regular intervals (10-15 FPS)
3. Send frames to backend for processing
4. Display annotated frames in real-time
5. Handle start/stop functionality

---

### Step 1: Camera Access

**Technology:** Browser MediaDevices API

**Instructions:**
- Use `navigator.mediaDevices.getUserMedia()` to request camera access
- Request video stream with constraints (resolution, FPS)
- Display stream in `<video>` element
- Handle permission denied errors gracefully

**Example API Usage:**
```javascript
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'user' // or 'environment' for back camera
  }
});
```

**Requirements:**
- Request camera permission from user
- Show clear UI for permission request
- Handle cases where camera is denied or unavailable
- Support switching between front/back cameras (if available)

---

### Step 2: Frame Capture

**Technology:** HTML5 Canvas API

**Instructions:**
- Capture frames from `<video>` element using Canvas
- Convert captured frame to base64 image
- Target frame rate: 10-15 FPS (capture every 66-100ms)
- Use `requestAnimationFrame` or `setInterval` for timing

**Frame Capture Process:**
1. Draw video frame to canvas
2. Convert canvas to base64 (`.toDataURL('image/jpeg')`)
3. Send base64 string to backend

**Requirements:**
- Capture frames at consistent intervals
- Handle frame capture errors
- Optimize image size (compress if needed)
- Show loading indicator during processing

---

### Step 3: API Integration

**Endpoints to Use:**

#### 3.1 Start Live Inference
```
POST /api/inference/live/start
Body: { modelId: "..." }
Response: {
  inferenceId: "...",
  status: "running",
  frameEndpoint: "/api/inference/live/{inferenceId}/frame"
}
```

#### 3.2 Process Frame
```
POST /api/inference/live/:inferenceId/frame
Body: {
  image: "data:image/jpeg;base64,...",
  confidenceThreshold?: 0.25
}
Response: {
  annotatedImage: "data:image/jpeg;base64,...", // or URL
  detections: [...],
  totalDetections: 5
}
```

#### 3.3 Stop Live Inference
```
POST /api/inference/live/:inferenceId/stop
Response: {
  inferenceId: "...",
  status: "completed",
  message: "Live inference stopped"
}
```

**Requirements:**
- Handle API errors (network, timeout, etc.)
- Show error messages to user
- Retry failed requests (with backoff)
- Handle slow responses gracefully

---

### Step 4: Real-Time Display

**Instructions:**
- Display annotated frames in real-time
- Show original camera feed and annotated feed side-by-side (optional)
- Update display at 10-15 FPS
- Handle frame drops gracefully

**Display Options:**
- Option A: Replace camera feed with annotated frames
- Option B: Show both feeds side-by-side
- Option C: Overlay annotations on camera feed

**Requirements:**
- Smooth frame updates (no stuttering)
- Show FPS counter (optional)
- Handle slow backend responses
- Show "Processing..." indicator when waiting

---

### Step 5: UI Components

**Components Needed:**

1. **Camera Permission Request**
   - Button to request camera access
   - Clear instructions for user
   - Error messages if denied

2. **Camera Preview**
   - `<video>` element for camera feed
   - Controls for start/stop
   - Frame rate indicator (optional)

3. **Annotated Frame Display**
   - `<img>` or `<canvas>` for annotated frames
   - Loading spinner during processing
   - Detection count display

4. **Controls**
   - Start/Stop button
   - Model selection dropdown
   - Confidence threshold slider (optional)
   - Camera switch button (if multiple cameras)

**Requirements:**
- Responsive design
- Clear visual feedback
- Error handling UI
- Loading states

---

### Step 6: Performance Optimization

**Instructions:**
- Optimize frame capture rate (don't send too fast)
- Compress images before sending (reduce base64 size)
- Use Web Workers for frame processing (optional)
- Implement frame skipping if backend is slow

**Optimization Tips:**
- Reduce image resolution before sending (e.g., 640x480)
- Use JPEG compression (quality 0.7-0.8)
- Skip frames if previous request is still pending
- Use request queuing to prevent overload

---

### Step 7: Error Handling

**Scenarios to Handle:**
- Camera permission denied
- Camera not available
- Network errors
- Backend errors
- Slow backend responses
- User closes browser/tab

**Requirements:**
- Show user-friendly error messages
- Provide retry options
- Clean up resources on errors
- Stop camera stream on errors

---

### Step 8: State Management

**States to Track:**
- Camera access status (requested, granted, denied)
- Inference job status (idle, starting, running, stopped)
- Current inferenceId
- Frame processing status
- Error states

**Requirements:**
- Use React state or state management library
- Handle state transitions properly
- Clean up on component unmount
- Persist state if needed (optional)

---

## 📡 API Specifications

### POST /api/inference/live/start

**Request:**
```json
{
  "modelId": "model_1234567890_abc123",
  "confidenceThreshold": 0.25  // Optional
}
```

**Response:**
```json
{
  "inferenceId": "inf_1234567890_xyz789",
  "status": "running",
  "message": "Live camera inference started",
  "frameEndpoint": "/api/inference/live/inf_1234567890_xyz789/frame"
}
```

---

### POST /api/inference/live/:inferenceId/frame

**Request:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "confidenceThreshold": 0.25  // Optional, overrides default
}
```

**Response (Success):**
```json
{
  "annotatedImage": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "detections": [
    {
      "class": "class_0",
      "confidence": 0.95,
      "bbox": [100, 150, 200, 250]  // [x1, y1, x2, y2]
    }
  ],
  "totalDetections": 3,
  "processingTime": 45  // milliseconds
}
```

**Response (Error):**
```json
{
  "error": "Invalid image data",
  "message": "Image must be base64 encoded JPEG"
}
```

---

### POST /api/inference/live/:inferenceId/stop

**Request:** No body required

**Response:**
```json
{
  "inferenceId": "inf_1234567890_xyz789",
  "status": "completed",
  "message": "Live camera inference stopped",
  "totalFramesProcessed": 450,
  "stoppedAt": "2025-12-19T14:30:00.000Z"
}
```

---

### GET /api/inference/live/:inferenceId/status

**Response:**
```json
{
  "inferenceId": "inf_1234567890_xyz789",
  "status": "running",
  "startedAt": "2025-12-19T14:25:00.000Z",
  "totalFramesProcessed": 450,
  "averageProcessingTime": 45
}
```

---

## 🔧 Backend Implementation Checklist

### Phase 1: Core Functionality
- [ ] Create `process_frame.py` script for single frame processing
- [ ] Update `startLiveInference` to create frames directory
- [ ] Implement `processLiveFrame` controller function
- [ ] Add route for `POST /api/inference/live/:inferenceId/frame`
- [ ] Test with sample base64 image

### Phase 2: Frame Management
- [ ] Implement frame cleanup (delete old frames)
- [ ] Add frame rate limiting (prevent overload)
- [ ] Add error handling for Python script failures
- [ ] Add timeout handling for slow inference

### Phase 3: Stop Functionality
- [ ] Implement `stopLiveInference` controller function
- [ ] Add route for `POST /api/inference/live/:inferenceId/stop`
- [ ] Clean up temp files on stop
- [ ] Update InferenceJob status

### Phase 4: Optional Enhancements
- [ ] Add `GET /api/inference/live/:inferenceId/frame` for polling
- [ ] Add frame statistics (FPS, processing time)
- [ ] Add WebSocket support (future enhancement)
- [ ] Add frame history (save last N frames)

---

## 🎯 Frontend Implementation Checklist

### Phase 1: Camera Access
- [ ] Request camera permission
- [ ] Display camera feed in `<video>` element
- [ ] Handle permission denied errors
- [ ] Add camera switch functionality (if multiple cameras)

### Phase 2: Frame Capture
- [ ] Implement frame capture from video element
- [ ] Convert frames to base64
- [ ] Set up capture loop (10-15 FPS)
- [ ] Optimize image size/quality

### Phase 3: API Integration
- [ ] Implement `POST /api/inference/live/start`
- [ ] Implement `POST /api/inference/live/:inferenceId/frame`
- [ ] Implement `POST /api/inference/live/:inferenceId/stop`
- [ ] Handle API errors and retries

### Phase 4: Display
- [ ] Display annotated frames in real-time
- [ ] Show detection count/statistics
- [ ] Add loading indicators
- [ ] Handle slow responses gracefully

### Phase 5: UI/UX
- [ ] Create start/stop controls
- [ ] Add model selection
- [ ] Add confidence threshold slider
- [ ] Show error messages
- [ ] Add FPS counter (optional)

---

## 🧪 Testing Plan

### Backend Testing
1. Test with sample base64 image
2. Test with invalid image data
3. Test with missing inferenceId
4. Test stop functionality
5. Test error handling
6. Test frame cleanup

### Frontend Testing
1. Test camera access on different browsers
2. Test frame capture and sending
3. Test real-time display
4. Test error scenarios
5. Test stop functionality
6. Test on different devices

### Integration Testing
1. End-to-end flow: Start → Capture → Process → Display → Stop
2. Test with slow network
3. Test with multiple users simultaneously
4. Test error recovery

---

## 📝 Notes

### Performance Considerations
- Frame rate: 10-15 FPS is optimal (balance between smoothness and load)
- Image size: Reduce to 640x480 or 1280x720 before sending
- Compression: Use JPEG quality 0.7-0.8
- Backend: Process frames asynchronously, don't block

### Security Considerations
- Validate image data (prevent malicious uploads)
- Limit frame size (prevent DoS)
- Rate limit frame requests (prevent abuse)
- Clean up temp files regularly

### Future Enhancements
- WebSocket for real-time streaming (lower latency)
- Frame buffering for smooth playback
- Detection history/statistics
- Save annotated frames to storage
- Multiple camera support
- Recording functionality

---

## ✅ Summary

**Backend Engineer (You):**
- Create Python script for single frame processing
- Update inference controller with frame processing endpoints
- Add routes for live camera inference
- Implement start/stop functionality
- Handle frame cleanup and error cases

**Frontend Engineer:**
- Access camera using MediaDevices API
- Capture frames at 10-15 FPS
- Send frames to backend API
- Display annotated frames in real-time
- Implement start/stop UI controls

**Both work together:**
- Backend provides API endpoints
- Frontend consumes APIs and handles camera
- Communication via HTTP POST requests
- Works seamlessly on Azure deployment

---

**Ready to implement?** Start with Phase 1 for both backend and frontend, then iterate.
