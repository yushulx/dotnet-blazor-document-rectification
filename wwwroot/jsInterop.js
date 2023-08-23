let normalizer = null;
let normalizedImageResult = null;
let enhancer = null;
let overlay = null;
let context = null;
let dotnetHelper = null;
let videoSelect = null;
let cameraInfo = {};
let videoContainer = null;
let target = {};

function initOverlay(ol) {
    overlay = ol;
    context = overlay.getContext('2d');
}

function save() {
    (async () => {
        if (normalizedImageResult) {
            await normalizedImageResult.saveToFile("document-normalization.png", true);
        }
    })();
}

function normalize(file, quad, canvas) {
    (async () => {
        if (normalizer) {
            normalizedImageResult = await normalizer.normalize(file, quad);
            if (normalizedImageResult) {
                let image = normalizedImageResult.image;
                canvas.width = image.width;
                canvas.height = image.height;
                let data = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
                let ctx = canvas.getContext('2d');
                ctx.putImageData(data, 0, 0);
            }
        }

    })();
}

function updateOverlay(width, height) {
    if (overlay) {
        overlay.width = width;
        overlay.height = height;
        clearOverlay();
    }
}

function clearOverlay() {
    if (context) {
        context.clearRect(0, 0, overlay.width, overlay.height);
        context.strokeStyle = '#ff0000';
        context.lineWidth = 5;
    }
}

function drawOverlay(localization, text) {
    if (context) {
        context.beginPath();
        context.moveTo(localization.x1, localization.y1);
        context.lineTo(localization.x2, localization.y2);
        context.lineTo(localization.x3, localization.y3);
        context.lineTo(localization.x4, localization.y4);
        context.lineTo(localization.x1, localization.y1);
        context.stroke();

        context.font = '18px Verdana';
        context.fillStyle = '#ff0000';
        let x = [localization.x1, localization.x2, localization.x3, localization.x4];
        let y = [localization.y1, localization.y2, localization.y3, localization.y4];
        x.sort(function (a, b) {
            return a - b;
        });
        y.sort(function (a, b) {
            return b - a;
        });
        let left = x[0];
        let top = y[0];

        context.fillText(text, left, top + 50);
    }
}

function drawQuad(points) {
    if (context) {
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        context.lineTo(points[1].x, points[1].y);
        context.lineTo(points[2].x, points[2].y);
        context.lineTo(points[3].x, points[3].y);
        context.lineTo(points[0].x, points[0].y);
        context.stroke();
    }
}

function decodeImage(dotnetRef, url, data) {
    const img = new Image()
    img.onload = () => {
        updateOverlay(img.width, img.height);
        if (normalizer) {
            (async () => {
                let quads = await normalizer.detectQuad(target["file"]);
                if (quads.length == 0) {
                    return;
                }
                points = quads[0].location.points;
                target["points"] = points;
                drawQuad(points);
            })();

        }
    }
    img.src = url
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
    // settings.ImageParameterArray[0].ScaleDownThreshold = 2300;
    settings.NormalizerParameterArray[0].ColourMode = "ICM_COLOUR"; // ICM_BINARY, ICM_GRAYSCALE, ICM_COLOUR

    await normalizer.setRuntimeSettings(settings);
}

function changeColor(radio) {
    let colorMode = "ICM_GRAYSCALE";
    if (radio.value === 'grayscale') {
        colorMode = "ICM_GRAYSCALE";
    } else if (radio.value === 'color') {
        colorMode = "ICM_COLOUR";
    } else if (radio.value === 'binary') {
        colorMode = "ICM_BINARY";
    }

    if (normalizer && target['file']) {
        (async () => {
            let settings = await normalizer.getRuntimeSettings();
            settings.NormalizerParameterArray[0].ColourMode = colorMode;
            await normalizer.setRuntimeSettings(settings);
            normalize(target['file'], target['quads'][0].location);
        })();
    }
}

window.jsFunctions = {
    setImageUsingStreaming: async function setImageUsingStreaming(dotnetRef, overlayId, imageId, imageStream) {
        const arrayBuffer = await imageStream.arrayBuffer();
        const blob = new Blob([arrayBuffer]);
        const url = URL.createObjectURL(blob);
        document.getElementById(imageId).src = url;
        document.getElementById(imageId).style.display = 'block';
        initOverlay(document.getElementById(overlayId));
        if (normalizer) {
            decodeImage(dotnetRef, url, blob);
        }

    },
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
    initReader: async function (dotnetRef) {
        dotnetHelper = dotnetRef;
        if (normalizer != null) {
            normalizer.stopScanning();
        }
        else {
            await init();
        }

        return true;
    },
    initScanner: async function (dotnetRef, videoId, selectId, overlayId) {
        if (normalizer == null) {
            await init();
        }
        let canvas = document.getElementById(overlayId);
        target = {};
        initOverlay(canvas);
        videoContainer = document.getElementById(videoId);
        videoSelect = document.getElementById(selectId);
        videoSelect.onchange = openCamera;
        dotnetHelper = dotnetRef;

        try {
            enhancer = await Dynamsoft.DCE.CameraEnhancer.createInstance();
            await enhancer.setUIElement(document.getElementById(videoId));
            await normalizer.setImageSource(enhancer, { });
            await normalizer.startScanning(true);
            let cameras = await enhancer.getAllCameras();
            listCameras(cameras);
            await openCamera();

            normalizer.onQuadDetected = (quads, sourceImage) => {
                clearOverlay();
                if (quads.length == 0) {
                    return;
                }
                points = quads[0].location.points;
                target["file"] = sourceImage;
                target["points"] = points;
                drawQuad(points);
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
    selectFile: async function (dotnetRef, overlayId, imageId) {
        target = {};
        initOverlay(document.getElementById(overlayId));
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
                        target["file"] = fr.result;
                        decodeImage(dotnetRef, fr.result, file);
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
    rectify: async function (dotnetRef, canvasId) {
        let canvas = document.getElementById(canvasId);
        normalize(target["file"], target["points"], canvas);
    },
};

