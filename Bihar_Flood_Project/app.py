from flask import Flask, render_template, jsonify, request
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import os, warnings
warnings.filterwarnings("ignore")

app = Flask(__name__)

WARDS = [
    {"name":"Rohini",       "lat":28.7041,"lon":77.1025,"elevation":10,"drainage":55,"population":420000,"resources":12},
    {"name":"Karol Bagh",   "lat":28.6514,"lon":77.1908,"elevation": 8,"drainage":40,"population":310000,"resources": 8},
    {"name":"Lajpat Nagar", "lat":28.5700,"lon":77.2430,"elevation": 7,"drainage":38,"population":280000,"resources": 7},
    {"name":"Dwarka",       "lat":28.5921,"lon":77.0460,"elevation":12,"drainage":65,"population":510000,"resources":15},
    {"name":"Janakpuri",    "lat":28.6219,"lon":77.0878,"elevation":11,"drainage":60,"population":350000,"resources":11},
    {"name":"Saket",        "lat":28.5244,"lon":77.2066,"elevation": 9,"drainage":50,"population":290000,"resources": 9},
    {"name":"Okhla",        "lat":28.5355,"lon":77.2720,"elevation": 6,"drainage":30,"population":390000,"resources": 6},
    {"name":"Pitampura",    "lat":28.7015,"lon":77.1310,"elevation":13,"drainage":70,"population":320000,"resources":14},
    {"name":"Mayur Vihar",  "lat":28.6080,"lon":77.2960,"elevation": 8,"drainage":42,"population":380000,"resources": 8},
    {"name":"Shahdara",     "lat":28.6700,"lon":77.2900,"elevation": 7,"drainage":35,"population":450000,"resources": 7},
]

def train_model():
    np.random.seed(42)
    n = 700
    rf = np.random.uniform(50, 300, n)
    el = np.random.uniform(5, 30, n)
    dr = np.random.uniform(20, 100, n)
    score = (rf/300)*50 + ((30-el)/30)*30 + ((100-dr)/100)*20
    labels = ["HIGH" if s >= 55 else "MEDIUM" if s >= 30 else "LOW" for s in score]
    df = pd.DataFrame({"rainfall": rf, "elevation": el, "drainage": dr})
    le = LabelEncoder()
    le.fit(labels)
    model = RandomForestClassifier(n_estimators=150, random_state=42)
    model.fit(df, le.transform(labels))
    return model, le

MODEL, LE = train_model()
CLASSES = list(LE.classes_)
print("✅ ML Model trained | Classes:", CLASSES)

def get_predictions(rainfall):
    results = []
    for w in WARDS:
        X = pd.DataFrame([[rainfall, w["elevation"], w["drainage"]]],
                         columns=["rainfall", "elevation", "drainage"])
        pred_enc = int(MODEL.predict(X)[0])
        proba    = MODEL.predict_proba(X)[0]
        risk     = str(LE.inverse_transform([pred_enc])[0])

        readiness    = (w["drainage"]/100)*40 + (min(w["elevation"],30)/30)*30 + (min(w["resources"],20)/20)*30
        drain_idx    = round(rainfall / max(w["drainage"], 1), 2)
        drain_failed = bool(drain_idx > 4)

        prob = {str(cls): round(float(proba[i])*100, 1) for i, cls in enumerate(CLASSES)}

        alloc = {"pumps":3,"teams":2,"boats":1} if risk=="HIGH" else \
                {"pumps":2,"teams":1,"boats":0} if risk=="MEDIUM" else \
                {"pumps":0,"teams":0,"boats":0}

        np.random.seed(abs(hash(w["name"])) % (2**31) + int(rainfall))
        flood_area = round(float(np.random.uniform(3,8)),2) if risk=="HIGH" else \
                     round(float(np.random.uniform(1,3)),2) if risk=="MEDIUM" else \
                     round(float(np.random.uniform(0,1)),2)

        results.append({
            "name":            w["name"],
            "lat":             float(w["lat"]),
            "lon":             float(w["lon"]),
            "rainfall":        int(rainfall),
            "elevation":       int(w["elevation"]),
            "drainage":        int(w["drainage"]),
            "population":      int(w["population"]),
            "risk":            risk,
            "prob_high":       prob.get("HIGH", 0.0),
            "prob_med":        prob.get("MEDIUM", 0.0),
            "prob_low":        prob.get("LOW", 0.0),
            "readiness":       round(float(readiness), 1),
            "readiness_label": "Good" if readiness>=70 else "Moderate" if readiness>=40 else "Poor",
            "drain_index":     drain_idx,
            "drain_failed":    drain_failed,
            "alloc":           alloc,
            "flood_area":      flood_area,
        })
    return results

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/predict", methods=["POST"])
def api_predict():
    body     = request.get_json(force=True)
    rainfall = float(body.get("rainfall", 120))
    wards    = get_predictions(rainfall)
    high     = [w for w in wards if w["risk"]=="HIGH"]
    med      = [w for w in wards if w["risk"]=="MEDIUM"]
    low      = [w for w in wards if w["risk"]=="LOW"]
    return jsonify({
        "wards": wards,
        "summary": {
            "high":           len(high),
            "medium":         len(med),
            "low":            len(low),
            "pop_affected":   int(sum(w["population"] for w in high) + sum(w["population"]*0.4 for w in med)),
            "flood_area":     round(sum(w["flood_area"] for w in wards), 2),
            "pumps":          int(sum(w["alloc"]["pumps"] for w in wards)),
            "teams":          int(sum(w["alloc"]["teams"] for w in wards)),
            "boats":          int(sum(w["alloc"]["boats"] for w in wards)),
            "drain_failures": int(sum(1 for w in wards if w["drain_failed"])),
            "avg_readiness":  round(sum(w["readiness"] for w in wards)/len(wards), 1),
        }
    })

@app.route("/api/timeline")
def api_timeline():
    return jsonify([
        {"time":"T − 3 Hours","color":"#6366f1","tasks":[
            "Inspect drain networks in HIGH-risk wards",
            "Deploy pumps to Okhla, Shahdara, Lajpat Nagar",
            "Alert District Disaster Management Officers"]},
        {"time":"T − 2 Hours","color":"#f59e0b","tasks":[
            "Activate Emergency Operations Center (EOC)",
            "Coordinate with Delhi Police & Fire Services",
            "Pre-position rescue boats near Yamuna"]},
        {"time":"T − 1 Hour","color":"#ef4444","tasks":[
            "Send SMS alerts to HIGH-risk ward citizens",
            "Issue public advisory via Delhi Govt channels",
            "Begin evacuation of vulnerable populations"]},
        {"time":"T − 0  NOW","color":"#dc2626","tasks":[
            "Deploy rescue teams to all flooded wards",
            "Activate Helpline: 1077 (Flood Control Room)",
            "Real-time resource reallocation active"]},
    ])

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    pd.DataFrame(WARDS).to_csv("data/delhi_wards.csv", index=False)
    print("🌐 Open: http://127.0.0.1:5000")
    app.run(debug=True)