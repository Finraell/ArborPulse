from pathlib import Path
import math
import pytest
from fastapi.testclient import TestClient
from arborpulse.main import app
from arborpulse.motion import analyze_video, summarize, validate_box

ROOT = Path(__file__).resolve().parents[2]
TREE = [.33, .23, .32, .32]
REF = [.78, .46, .16, .28]


def signal(quality=1, camera=0):
    rows = []
    for i in range(360):
        t = i/12; x = 5*math.sin(math.tau*.4*t); cx = camera*math.sin(math.tau*.2*t)
        rows.append(dict(t=t, treeX=x+cx, treeY=0, cameraX=cx, cameraY=0, x=x, y=0, quality=quality))
    return rows


def test_signal_frequency_and_gates():
    result = summarize(signal(), 512, 320, TREE, REF)
    assert abs(result["frequency"]-.4) < 1/result["duration"]
    assert not summarize(signal(quality=.4), 512, 320, TREE, REF)["usable"]
    assert not summarize(signal(camera=14), 512, 320, TREE, REF)["usable"]


@pytest.mark.parametrize("name,hz,tree", [("oak", .35, TREE), ("pine", .75, [.36, .2, .28, .3])])
def test_full_video_fixture(name, hz, tree):
    result = analyze_video(ROOT/"public"/"demo"/f"{name}.mp4", tree, REF)
    assert result["usable"]
    assert result["coverage"] >= .65
    assert abs(result["frequency"]-hz) < 1/result["duration"]
    assert result["amplitude"] > 2


def test_shake_fixture_requires_recapture():
    result = analyze_video(ROOT/"public"/"demo"/"shake.mp4", TREE, REF)
    assert result["cameraRms"] > 5
    assert not result["usable"]
    assert result["frequency"] is None


def test_bad_region_and_missing_video():
    with pytest.raises(ValueError):
        validate_box([.9, .2, .5, .2])
    with pytest.raises(ValueError):
        analyze_video(Path("missing.mp4"), TREE, REF)
    with pytest.raises(ValueError):
        analyze_video(ROOT/"public"/"demo"/"oak.mp4", TREE, TREE)


def test_upload_api_auth_and_invalid_data(monkeypatch):
    client = TestClient(app)
    assert client.get("/health").status_code == 200
    monkeypatch.setenv("ARBORPULSE_API_TOKEN", "test-only-token")
    data = dict(tree_box="[.33,.23,.32,.32]", reference_box="[.78,.46,.16,.28]")
    assert client.post("/v1/analyze", data=data, files={"file": ("bad.mp4", b"invalid", "video/mp4")}).status_code == 401
    data = dict(tree_box="[0.33,0.23,0.32,0.32]", reference_box="[0.78,0.46,0.16,0.28]")
    response = client.post("/v1/analyze", headers={"Authorization": "Bearer test-only-token"}, data=data, files={"file": ("bad.mp4", b"invalid", "video/mp4")})
    assert response.status_code == 400


def test_upload_api_complete(monkeypatch):
    monkeypatch.delenv("ARBORPULSE_API_TOKEN", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    client = TestClient(app)
    with (ROOT/"public"/"demo"/"oak.mp4").open("rb") as video:
        response = client.post("/v1/analyze", data={"tree_box": "[0.33,0.23,0.32,0.32]", "reference_box": "[0.78,0.46,0.16,0.28]"}, files={"file": ("oak.mp4", video, "video/mp4")})
    assert response.status_code == 200
    assert response.json()["retained"] is False
    assert response.json()["analysis"]["usable"]
