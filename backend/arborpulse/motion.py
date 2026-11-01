"""Sparse Lucas–Kanade tracking with stationary-reference subtraction.

This optional service is an alternative to the browser patch tracker. Both
return projected pixel evidence; neither estimates structural tree risk.
"""
import math
from pathlib import Path
import cv2
import numpy as np


def validate_box(box):
    if not isinstance(box, (list, tuple)) or len(box) != 4:
        raise ValueError("Region must contain four finite normalized values")
    try:
        x, y, w, h = map(float, box)
    except (TypeError, ValueError) as error:
        raise ValueError("Region must contain four finite normalized values") from error
    if not all(math.isfinite(v) for v in (x, y, w, h)):
        raise ValueError("Region must contain four finite normalized values")
    if min(x, y) < 0 or min(w, h) < .03 or x+w > 1 or y+h > 1:
        raise ValueError("Region must fit inside the image")
    return x, y, w, h


def overlap(a, b):
    return a[0] < b[0]+b[2] and a[0]+a[2] > b[0] and a[1] < b[1]+b[3] and a[1]+a[3] > b[1]


def detrend(values):
    values = np.asarray(values, dtype=float)
    if len(values) < 2:
        return values - np.mean(values) if len(values) else values
    index = np.arange(len(values), dtype=float)
    return values - np.polyval(np.polyfit(index, values, 1), index)


def summarize(samples, width, height, tree_box, reference_box):
    if len(samples) < 2:
        raise ValueError("Not enough decoded frames")
    duration = samples[-1]["t"]-samples[0]["t"]
    rate = (len(samples)-1)/duration
    x = detrend([s["x"] for s in samples]); y = detrend([s["y"] for s in samples])
    axis = x if np.mean(x*x) >= np.mean(y*y) else y
    power = np.abs(np.fft.rfft(axis*np.hanning(len(axis))))**2 / len(axis)**2
    frequencies = np.fft.rfftfreq(len(axis), 1/rate)
    indices = np.flatnonzero((frequencies >= .1) & (frequencies <= 2))
    peak = int(indices[np.argmax(power[indices])]) if len(indices) else 0
    total = float(np.sum(power[1:]))
    concentration = float(np.sum(power[max(1, peak-1):peak+2])/total) if total > 0 else 0
    coverage = float(np.mean([s["quality"] for s in samples]))
    rms = float(np.sqrt(np.mean(axis*axis)))
    cx = detrend([s["cameraX"] for s in samples]); cy = detrend([s["cameraY"] for s in samples])
    camera_rms = float(np.sqrt(np.mean(cx*cx+cy*cy)))
    usable = duration >= 6 and coverage >= .65 and camera_rms <= 5
    hz = float(frequencies[peak]) if usable and rms >= .35 and concentration >= .3 and frequencies[peak]*duration >= 3 else None
    warnings = []
    if coverage < .65:
        warnings.append("Insufficient stable tracks. Recapture with a textured reference.")
    if camera_rms > 5:
        warnings.append("Substantial camera motion. Translation correction does not remove rotation or parallax.")
    if rms < .35:
        warnings.append("Motion is near the pixel noise floor.")
    if duration < 10:
        warnings.append("Short capture: record 20–30 seconds.")
    if hz is None:
        warnings.append("A repeatable oscillation frequency was not resolved.")
    return {"schemaVersion": "1.0", "engine": "PhysicsLens / OpenCV Lucas-Kanade v1", "duration": duration, "sampleRate": rate, "width": width, "height": height, "samples": samples, "spectrum": [{"hz": float(f), "power": float(p)} for f, p in zip(frequencies[1:], power[1:]) if f <= 3], "frequency": hz, "spectralConcentration": concentration, "amplitude": float(np.ptp(axis)), "rms": rms, "cameraRms": camera_rms, "coverage": coverage, "usable": usable, "warnings": warnings, "treeBox": dict(zip(("x", "y", "width", "height"), tree_box)), "referenceBox": dict(zip(("x", "y", "width", "height"), reference_box))}


def corners(gray, box):
    h, w = gray.shape
    x, y, bw, bh = box
    mask = np.zeros_like(gray)
    mask[round(y*h):round((y+bh)*h), round(x*w):round((x+bw)*w)] = 255
    points = cv2.goodFeaturesToTrack(gray, maxCorners=35, qualityLevel=.03, minDistance=8, mask=mask)
    if points is None or len(points) < 4:
        raise ValueError("Not enough textured features in the selected regions")
    return points.astype(np.float32)


def track(previous, current, points, origins):
    if len(points) == 0:
        return points, origins
    next_points, status, _ = cv2.calcOpticalFlowPyrLK(previous, current, points, None, winSize=(15, 15), maxLevel=2)
    back, back_status, _ = cv2.calcOpticalFlowPyrLK(current, previous, next_points, None, winSize=(15, 15), maxLevel=2)
    errors = np.linalg.norm(points.reshape(-1, 2)-back.reshape(-1, 2), axis=1)
    good = (status.ravel() == 1) & (back_status.ravel() == 1) & (errors < 1.5)
    return next_points[good], origins[good]


def analyze_video(path: Path, tree_box, reference_box, seconds=30):
    tree_box, reference_box = validate_box(tree_box), validate_box(reference_box)
    if overlap(tree_box, reference_box):
        raise ValueError("Tree and reference regions must not overlap")
    cap = cv2.VideoCapture(str(path))
    try:
        if not cap.isOpened():
            raise ValueError("The uploaded video could not be decoded")
        fps, frame_count = cap.get(cv2.CAP_PROP_FPS), cap.get(cv2.CAP_PROP_FRAME_COUNT)
        if not math.isfinite(fps) or fps < 2 or fps > 240 or frame_count/fps < 6:
            raise ValueError("Use a video at least 6 seconds long with a valid frame rate")
        step = max(1, round(fps/12)); limit = min(frame_count, math.floor(seconds*fps))
        previous = None; samples = []; last_tree = np.zeros(2); last_camera = np.zeros(2)
        for frame_index in range(int(limit)):
            ok, frame = cap.read()
            if not ok:
                break
            if frame_index % step:
                continue
            source_h, source_w = frame.shape[:2]
            width = min(512, source_w); height = round(source_h*width/source_w)
            if min(width, height) < 120 or source_w*source_h > 3840*2160:
                raise ValueError("Use a video between 320 × 240 and 4K resolution")
            gray = cv2.cvtColor(cv2.resize(frame, (width, height)), cv2.COLOR_BGR2GRAY)
            if previous is None:
                tree = corners(gray, tree_box); background = corners(gray, reference_box)
                tree_origins = tree.copy(); background_origins = background.copy()
                tree_count, background_count = len(tree), len(background)
            else:
                tree, tree_origins = track(previous, gray, tree, tree_origins)
                background, background_origins = track(previous, gray, background, background_origins)
            if len(tree) >= 3:
                last_tree = np.median((tree-tree_origins).reshape(-1, 2), axis=0)
            if len(background) >= 3:
                last_camera = np.median((background-background_origins).reshape(-1, 2), axis=0)
            corrected = last_tree-last_camera
            quality = min(len(tree)/tree_count, len(background)/background_count) if min(len(tree), len(background)) >= 3 else 0
            samples.append({"t": frame_index/fps, "treeX": float(last_tree[0]), "treeY": float(last_tree[1]), "cameraX": float(last_camera[0]), "cameraY": float(last_camera[1]), "x": float(corrected[0]), "y": float(corrected[1]), "quality": float(quality)})
            previous = gray
        return summarize(samples, width, height, tree_box, reference_box)
    finally:
        cap.release()
