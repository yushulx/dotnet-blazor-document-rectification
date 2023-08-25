let normalizer = null;
let normalizedImageResult = null;
let enhancer = null;
let dotnetHelper = null;
let videoSelect = null;
let cameraInfo = {};
let videoContainer = null;
let data = {};
let canvasRectify = null;
let canvasOverlay = null;
let contextRectify = null;
let contextOverlay = null;

function initOverlay(ol) {
    canvasOverlay = ol;
    canvasOverlay.addEventListener("mousedown", updatePoint);
    canvasOverlay.addEventListener("touchstart", updatePoint);
    contextOverlay = canvasOverlay.getContext('2d');
}

async function normalize(file, location) {
    if (file == null || location == null) {
        return;
    }
    if (normalizer) {
        normalizedImageResult = await normalizer.normalize(file, {
            quad: location
        });
        if (normalizedImageResult) {
            let image = normalizedImageResult.image;
            canvasRectify.width = image.width;
            canvasRectify.height = image.height;
            let data = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
            contextRectify.clearRect(0, 0, canvasRectify.width, canvasRectify.height);
            contextRectify.putImageData(data, 0, 0);
        }
    }
}

function updateOverlay(width, height) {
    if (canvasOverlay) {
        canvasOverlay.width = width;
        canvasOverlay.height = height;
        clearOverlay();
    }
}

function clearOverlay() {
    if (contextOverlay) {
        contextOverlay.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
        contextOverlay.strokeStyle = '#ff0000';
        contextOverlay.lineWidth = 5;
    }
}

function drawQuad(points) {
    contextOverlay.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
    for (let i = 0; i < points.length; i++) {
        contextOverlay.beginPath();
        contextOverlay.arc(points[i].x, points[i].y, 5, 0, 2 * Math.PI);
        contextOverlay.stroke();
    }
    contextOverlay.beginPath();
    contextOverlay.moveTo(points[0].x, points[0].y);
    contextOverlay.lineTo(points[1].x, points[1].y);
    contextOverlay.lineTo(points[2].x, points[2].y);
    contextOverlay.lineTo(points[3].x, points[3].y);
    contextOverlay.lineTo(points[0].x, points[0].y);
    contextOverlay.stroke();
}

function decodeImage(sourceImage) {
    const img = new Image()
    img.onload = () => {
        updateOverlay(img.width, img.height);
        if (normalizer) {
            (async () => {
                let quads = await normalizer.detectQuad(sourceImage);
                if (quads.length == 0) {
                    return;
                }
                data["file"] = sourceImage;
                let location = quads[0].location;
                data["points"] = quads[0].location;
                drawQuad(location.points);

                await normalize(data["file"], location)
            })();

        }
    }
    img.src = sourceImage
}

function updateResolution() {
    if (enhancer) {
        let resolution = enhancer.getResolution();
        updateOverlay(resolution[0], resolution[1]);
    }
}

function listCameras(deviceInfos) {
    for (var i = deviceInfos.length - 1; i >= 0; --i) {
        var deviceInfo = deviceInfos[i];
        var option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        option.text = deviceInfo.label;
        cameraInfo[deviceInfo.deviceId] = deviceInfo;
        videoSelect.appendChild(option);
    }
}

async function openCamera() {
    clearOverlay();
    let deviceId = videoSelect.value;
    if (enhancer) {
        await enhancer.selectCamera(cameraInfo[deviceId]);
    }
}

async function init() {
    normalizer = await Dynamsoft.DDN.DocumentNormalizer.createInstance();
    let settings = await normalizer.getRuntimeSettings();
    settings.ImageParameterArray[0].BinarizationModes[0].ThresholdCompensation = 9;
    settings.NormalizerParameterArray[0].ColourMode = "ICM_COLOUR"; // ICM_BINARY, ICM_GRAYSCALE, ICM_COLOUR

    await normalizer.setRuntimeSettings(settings);
}

function updatePoint(e) {
    let points = data["points"].points;
    let rect = canvasOverlay.getBoundingClientRect();

    let scaleX = canvasOverlay.clientWidth / canvasOverlay.width;
    let scaleY = canvasOverlay.clientHeight / canvasOverlay.height;
    let mouseX = (e.clientX - rect.left) / scaleX;
    let mouseY = (e.clientY - rect.top) / scaleY;

    let delta = 10;
    for (let i = 0; i < points.length; i++) {
        if (Math.abs(points[i].x - mouseX) < delta && Math.abs(points[i].y - mouseY) < delta) {
            canvasOverlay.addEventListener("mousemove", dragPoint);
            canvasOverlay.addEventListener("mouseup", releasePoint);
            canvasOverlay.addEventListener("touchmove", dragPoint);
            canvasOverlay.addEventListener("touchend", releasePoint);
            function dragPoint(e) {
                let rect = canvasOverlay.getBoundingClientRect();
                let mouseX = e.clientX || e.touches[0].clientX;
                let mouseY = e.clientY || e.touches[0].clientY;
                points[i].x = Math.round((mouseX - rect.left) / scaleX);
                points[i].y = Math.round((mouseY - rect.top) / scaleY);
                drawQuad(points);
            }
            function releasePoint() {
                canvasOverlay.removeEventListener("mousemove", dragPoint);
                canvasOverlay.removeEventListener("mouseup", releasePoint);
                canvasOverlay.removeEventListener("touchmove", dragPoint);
                canvasOverlay.removeEventListener("touchend", releasePoint);
            }
            break;
        }
    }
}

window.jsFunctions = {
    initSDK: async function (licenseKey) {
        let result = true;

        if (normalizer != null) {
            return result;
        }

        try {
            Dynamsoft.DDN.DocumentNormalizer.license = licenseKey;
        } catch (e) {
            console.log(e);
            result = false;
        }

        await init();

        return result;
    },
    initImageFile: async function (dotnetRef, canvasOverlayId, canvasRectifyId) {
        dotnetHelper = dotnetRef;
        initOverlay(document.getElementById(canvasOverlayId));
        canvasRectify = document.getElementById(canvasRectifyId);
        contextRectify = canvasRectify.getContext('2d');
        if (normalizer != null) {
            normalizer.stopScanning();
        }
        await init();

        return true;
    },
    initCameraStream: async function (dotnetRef, videoId, selectId, canvasOverlayId, canvasRectifyId) {
        await init();
        initOverlay(document.getElementById(canvasOverlayId));
        canvasRectify = document.getElementById(canvasRectifyId);
        contextRectify = canvasRectify.getContext('2d');
        data = {};
        videoContainer = document.getElementById(videoId);
        videoSelect = document.getElementById(selectId);
        videoSelect.onchange = openCamera;
        dotnetHelper = dotnetRef;

        try {
            enhancer = await Dynamsoft.DCE.CameraEnhancer.createInstance();
            await enhancer.setUIElement(document.getElementById(videoId));
            await normalizer.setImageSource(enhancer, {});
            await normalizer.startScanning(true);
            let cameras = await enhancer.getAllCameras();
            listCameras(cameras);
            await openCamera();

            normalizer.onQuadDetected = (quads, sourceImage) => {
                clearOverlay();
                if (quads.length == 0) {
                    return;
                }
                data["file"] = sourceImage;
                let location = quads[0].location;
                data["points"] = quads[0].location;
                drawQuad(location.points);
            };
            enhancer.on("played", playCallBackInfo => {
                updateResolution();
            });

        } catch (e) {
            console.log(e);
            result = false;
        }
        return true;
    },
    selectFile: async function (dotnetRef, imageId) {
        data = {};

        if (normalizer) {
            let input = document.createElement("input");
            input.type = "file";
            input.onchange = async function () {
                try {
                    let file = input.files[0];
                    var fr = new FileReader();
                    fr.onload = function () {
                        let image = document.getElementById(imageId);
                        image.src = fr.result;
                        image.style.display = 'block';

                        decodeImage(fr.result);
                    }
                    fr.readAsDataURL(file);

                } catch (ex) {
                    alert(ex.message);
                    throw ex;
                }
            };
            input.click();
        } else {
            alert("The SDK is still initializing.");
        }
    },
    rectify: async function () {
        await normalize(data["file"], data["points"]);
    },
    updateSetting: async function (color) {
        let colorMode = "ICM_GRAYSCALE";
        if (color === 'grayscale') {
            colorMode = "ICM_GRAYSCALE";
        } else if (color === 'color') {
            colorMode = "ICM_COLOUR";
        } else if (color === 'binary') {
            colorMode = "ICM_BINARY";
        }

        if (normalizer && data['file']) {
            let settings = await normalizer.getRuntimeSettings();
            settings.NormalizerParameterArray[0].ColourMode = colorMode;
            await normalizer.setRuntimeSettings(settings);
            normalize(data["file"], data["points"]);
        }
    },
    save: async function () {
        if (normalizedImageResult) {
            await normalizedImageResult.saveToFile("document-normalization.png", true);
        }
    },
};

