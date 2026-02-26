/**
 * REAL AI Face Verification with eye detection
 * Uses face-api.js for accurate facial landmark detection
 */

class FaceVerification {
    constructor() {
        this.video = null;
        this.modelsLoaded = false;
        this.detectionInterval = null;
        this.eyeOpenThreshold = 0.25; // Eye Aspect Ratio threshold for open eyes
        this.lastDetection = null;
        this.onUpdateCallback = null;
    }

    /**
     * Load all required AI models from CDN
     */
    async loadModels() {
        try {
            console.log('🤖 Loading face detection models from CDN...');

            // Use the correct CDN path that actually works
            const modelPath = 'https://justadudewhohacks.github.io/face-api.js/models';

            // Load the models
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
                faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
                faceapi.nets.faceRecognitionNet.loadFromUri(modelPath)
            ]);

            this.modelsLoaded = true;
            console.log('✅ AI Models loaded successfully from CDN');
            return true;

        } catch (error) {
            console.error('❌ Failed to load models from CDN:', error);

            // Try alternative CDN
            try {
                console.log('🔄 Trying alternative CDN...');
                const altPath = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(altPath),
                    faceapi.nets.faceLandmark68Net.loadFromUri(altPath),
                    faceapi.nets.faceRecognitionNet.loadFromUri(altPath)
                ]);

                this.modelsLoaded = true;
                console.log('✅ AI Models loaded successfully from alternative CDN');
                return true;

            } catch (altError) {
                console.error('❌ Failed to load models even from alternative CDN:', altError);
                throw new Error('Could not load face detection models. Please check your internet connection.');
            }
        }
    }

    /**
     * Start camera stream
     */
    async startCamera(videoElement, options = {}) {
        try {
            const constraints = {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                    ...options
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = stream;
            this.video = videoElement;

            // Wait for video to be ready
            await new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    videoElement.play();
                    resolve();
                };
            });

            return stream;
        } catch (error) {
            throw new Error('Camera access denied: ' + error.message);
        }
    }

    /**
     * Calculate Eye Aspect Ratio (EAR)
     */
    calculateEAR(eye) {
        const height1 = this.distance(eye[1], eye[5]);
        const height2 = this.distance(eye[2], eye[4]);
        const width = this.distance(eye[0], eye[3]);

        return (height1 + height2) / (2 * width);
    }

    /**
     * Euclidean distance between two points
     */
    distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    /**
     * Get center point of eye
     */
    getEyeCenter(eye) {
        let sumX = 0, sumY = 0;
        eye.forEach(point => {
            sumX += point.x;
            sumY += point.y;
        });
        return {
            x: sumX / eye.length,
            y: sumY / eye.length
        };
    }

    /**
     * Verify face with eye detection
     */
    async verifyFace(requireEyesOpen = true, minConfidence = 0.5) {
        if (!this.modelsLoaded) {
            await this.loadModels();
        }

        if (!this.video) {
            throw new Error('Camera not started. Call startCamera() first.');
        }

        try {
            // Detect face with landmarks
            const detection = await faceapi
                .detectSingleFace(this.video, new faceapi.TinyFaceDetectorOptions({
                    inputSize: 416,
                    scoreThreshold: 0.5
                }))
                .withFaceLandmarks();

            if (!detection) {
                return {
                    success: false,
                    message: 'No face detected. Please look at the camera.'
                };
            }

            // Check confidence
            if (detection.detection.score < minConfidence) {
                return {
                    success: false,
                    message: `Low confidence detection (${Math.round(detection.detection.score * 100)}%). Please ensure good lighting.`
                };
            }

            // Get face landmarks
            const landmarks = detection.landmarks;
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();

            // Calculate Eye Aspect Ratio
            const leftEAR = this.calculateEAR(leftEye);
            const rightEAR = this.calculateEAR(rightEye);
            const avgEAR = (leftEAR + rightEAR) / 2;

            // Check if eyes are open
            const eyesOpen = avgEAR > this.eyeOpenThreshold;

            if (requireEyesOpen && !eyesOpen) {
                return {
                    success: false,
                    message: 'Please keep your eyes open and look at the camera.',
                    details: {
                        ear: avgEAR,
                        eyesOpen: false,
                        threshold: this.eyeOpenThreshold,
                        confidence: detection.detection.score
                    }
                };
            }

            // Get face box for positioning
            const box = detection.detection.box;
            const faceTooClose = box.width > 350;
            const faceTooFar = box.width < 100;

            if (faceTooClose) {
                return {
                    success: false,
                    message: 'Please move back - face too close',
                    details: { boxWidth: box.width }
                };
            }

            if (faceTooFar) {
                return {
                    success: false,
                    message: 'Please move closer to the camera',
                    details: { boxWidth: box.width }
                };
            }

            // Check if face is centered
            const videoWidth = this.video.videoWidth;
            const faceCenterX = box.x + box.width / 2;
            const isCentered = Math.abs(faceCenterX - videoWidth / 2) < videoWidth * 0.2;

            if (!isCentered) {
                return {
                    success: false,
                    message: 'Please center your face in the frame'
                };
            }

            // Success!
            return {
                success: true,
                message: 'Face verified successfully',
                details: {
                    ear: avgEAR,
                    eyesOpen: true,
                    confidence: detection.detection.score,
                    faceBox: box,
                    leftEyeCenter: this.getEyeCenter(leftEye),
                    rightEyeCenter: this.getEyeCenter(rightEye),
                    eyeDistance: this.distance(this.getEyeCenter(leftEye), this.getEyeCenter(rightEye)),
                    isCentered
                }
            };

        } catch (error) {
            console.error('Face verification error:', error);
            return {
                success: false,
                message: 'Error during face verification: ' + error.message
            };
        }
    }

    /**
     * Start continuous monitoring (for real-time feedback)
     */
    startMonitoring(onUpdate, interval = 100) {
        this.onUpdateCallback = onUpdate;

        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
        }

        this.detectionInterval = setInterval(async () => {
            if (!this.modelsLoaded || !this.video || !this.onUpdateCallback) return;

            try {
                const detection = await faceapi
                    .detectSingleFace(this.video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks();

                if (detection) {
                    const landmarks = detection.landmarks;
                    const leftEye = landmarks.getLeftEye();
                    const rightEye = landmarks.getRightEye();

                    const leftEAR = this.calculateEAR(leftEye);
                    const rightEAR = this.calculateEAR(rightEye);
                    const avgEAR = (leftEAR + rightEAR) / 2;

                    const box = detection.detection.box;

                    this.lastDetection = {
                        detected: true,
                        eyesOpen: avgEAR > this.eyeOpenThreshold,
                        ear: avgEAR,
                        confidence: detection.detection.score,
                        faceBox: box,
                        leftEyeCenter: this.getEyeCenter(leftEye),
                        rightEyeCenter: this.getEyeCenter(rightEye)
                    };

                    this.onUpdateCallback(this.lastDetection);
                } else {
                    this.lastDetection = {
                        detected: false,
                        eyesOpen: false,
                        ear: 0,
                        confidence: 0
                    };
                    this.onUpdateCallback(this.lastDetection);
                }
            } catch (error) {
                console.error('Monitoring error:', error);
            }
        }, interval);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
    }

    /**
     * Stop camera and clean up
     */
    stopCamera(stream) {
        this.stopMonitoring();
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        this.video = null;
    }

    /**
     * Check if browser supports required features
     */
    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
}

// Create global instance
const faceVerification = new FaceVerification();

// Auto-initialize on load
if (typeof window !== 'undefined') {
    window.faceVerification = faceVerification;

    document.addEventListener('DOMContentLoaded', () => {
        if (FaceVerification.isSupported()) {
            console.log('✅ Face verification is supported');
        } else {
            console.warn('❌ Face verification is not supported in this browser');
        }
    });
}