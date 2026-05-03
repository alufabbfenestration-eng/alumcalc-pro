import { useState, useMemo } from "react";

// ─── RATE CONSTANTS (editable in settings) ───────────────────────────────────
const DEFAULT_RATES = {
  aluminium: 350,       // ₹ per kg
  wastage: 0.10,        // 10% wastage
  glass5mm: 55,         // ₹ per sq ft
  mosquitoNet: 35,      // ₹ per sq ft
  epdmRubber: 10,       // ₹ per running ft
  labour2T: 60,         // ₹ per sq ft
  labour3T: 65,         // ₹ per sq ft
  transport: 100,       // fixed
  powderCoating: 0,     // ₹ per sq ft (0 = not included)
  // Hardware unit rates
  bearing2T: 80, bearing3T: 110,
  concealedLock: 90, concealedLock3: 210,
  multiPointSystem: 300,
  nibHolder: 45, tNib: 25, polimaidRod: 23, centerRodDevice: 45,
  antiLift: 5, topUGuide: 4, buffer: 5,
  woolPile: 1,        // per running foot
  waterDrainageCap: 7,
  fastner: 4, wallScrew: 3, bumpStopper: 35,
  sticker: 33, antiDust: 45, silicon: 185,
  kpaCover: 25, siliconLabour: 3,
  interlockCap: 4.5,
  meshClipH: 5, meshClipW: 5, meshInterlock: 8,
  centerClip: 9,
};

// Profile weights (kg/meter)
const WEIGHTS = {
  track2: 1.317,
  track3: 1.943,
  shutterH: 0.942,
  shutterW: 0.942,
  trackCap: 1.17,
  interlockKPA: 1.063,
  interlockSlim: 0.547,
  centerClip: 0.532,
  meshShutterH: 0.982,
  meshShutterW: 0.982,
  meshInterlock: 0.505,
  meshClip: 0.144,
  centerMitingClip: 0.25,
};

// Window type configurations
const WINDOW_TYPES = [
  { id: "2T2S", label: "2 Track – 2 Shutter", tracks: 2, shutters: 2, hasNet: false, centerOpening: false },
  { id: "3T3S", label: "3 Track – 3 Shutter", tracks: 3, shutters: 3, hasNet: false, centerOpening: false },
  { id: "2T4S_CO", label: "2 Track – 4 Shutter (Centre Opening)", tracks: 2, shutters: 4, hasNet: false, centerOpening: true },
  { id: "3T6S_CO", label: "3 Track – 6 Shutter (Centre Opening)", tracks: 3, shutters: 6, hasNet: false, centerOpening: true },
  { id: "3T2S1N", label: "3 Track – 2 Shutter + 1 Mosquito Net", tracks: 3, shutters: 2, hasNet: true, netCount: 1, centerOpening: false },
  { id: "3T4S2N", label: "3 Track – 4 Shutter + 2 Mosquito Net", tracks: 3, shutters: 4, hasNet: true, netCount: 2, centerOpening: false },
];

// Convert mm to feet
const mmToFt = (mm) => mm / 304.8;

// Calculate sq feet
const sqFt = (w, h) => (w / 304.8) * (h / 304.8);

function calcWindow(W, H, type, rates, lockType = "concealed") {
  const w = Number(W), h = Number(H);
  if (!w || !h || w < 100 || h < 100) return null;

  const isKPA = h > 1800;
  const tracks = type.tracks;
  const shutters = type.shutters;
  const co = type.centerOpening;
  const hasNet = type.hasNet;
  const netCount = type.netCount || 0;

  // ─── ALUMINIUM SECTIONS ───────────────────────────────────────────────────
  const sections = [];
  const addSection = (name, size, qty, weight) => {
    const mtr = (size / 1000) * qty;
    const kg = mtr * weight;
    const amount = kg * rates.aluminium;
    const colorFt = mmToFt(size) * qty;
    sections.push({ name, size, qty, mtr, weight, kg, amount, colorFt });
  };

  const trackWeight = tracks === 2 ? WEIGHTS.track2 : WEIGHTS.track3;

  // Track W & H
  addSection(`${tracks} Track W`, w, 2, trackWeight);
  addSection(`${tracks} Track H`, h, 2, trackWeight);

  // Shutters
  let shutterBottomW_size, shutterBottomW_qty, shutterBottomW_weight;
  let shutterH_qty;

  if (!co) {
    // Standard (non-centre opening)
    if (tracks === 2) {
      // 2T2S: (W-107/2)*4pcs bottom, (H-85)*2pcs H
      shutterBottomW_size = (w - 107) / 2;
      shutterBottomW_qty = 4;
      shutterH_qty = shutters;
    } else {
      // 3T3S: (W-106/3)*4pcs, (H-85)*2pcs H
      shutterBottomW_size = (w - 106) / 3;
      shutterBottomW_qty = 4;
      shutterH_qty = 2;
    }
    addSection("Shutter Bottom 45+90", shutterBottomW_size, shutterBottomW_qty, WEIGHTS.shutterW);
    addSection("Shutter H 45+45", h - 85, shutterH_qty, WEIGHTS.shutterH);
    if (tracks === 3 && shutters === 3) {
      // Centre sutter 90+90
      const centerSize = (w - 106) / 3 - 23;
      addSection("Centre Shutter Bottom 90+90", centerSize, 2, WEIGHTS.shutterW);
    }
  } else {
    // Centre opening: shutters split
    if (tracks === 2) {
      // 2T4S: (W-136/4)*8pcs bottom
      shutterBottomW_size = (w - 136) / 4;
      shutterBottomW_qty = 8;
      addSection("Shutter Bottom 45+90", shutterBottomW_size, shutterBottomW_qty, WEIGHTS.shutterW);
      addSection("Shutter H 45+45", h - 85, 4, WEIGHTS.shutterH);
    } else {
      // 3T6S: (W-136/4)*8pcs + centre (W-136/4)-22*4pcs
      shutterBottomW_size = (w - 136) / 4;
      addSection("Shutter Bottom 45+90", shutterBottomW_size, 8, WEIGHTS.shutterW);
      addSection("Centre Shutter Bottom 90+90", shutterBottomW_size - 22, 4, WEIGHTS.shutterW);
      addSection("Shutter H 45+45", h - 85, 4, WEIGHTS.shutterH);
    }
  }

  // Track cap bottom
  const capSize = w - 101;
  const capQty = tracks;
  addSection("Track Cap Bottom", capSize, capQty, WEIGHTS.trackCap);

  // Interlock KPA & Slim
  let ilKPAQty, ilSlimQty;
  if (!co) {
    if (tracks === 2) { ilKPAQty = isKPA ? 1 : 0; ilSlimQty = 1; }
    else { ilKPAQty = isKPA ? 2 : 0; ilSlimQty = 2; }
  } else {
    if (tracks === 2) { ilKPAQty = isKPA ? 2 : 0; ilSlimQty = 2; }
    else { ilKPAQty = isKPA ? 4 : 0; ilSlimQty = 4; }
  }
  if (ilKPAQty > 0) addSection("Interlock KPA", h - 85, ilKPAQty, WEIGHTS.interlockKPA);
  addSection("Interlock Slim", h - 85, ilSlimQty, WEIGHTS.interlockSlim);

  // Centre clip (CO only)
  if (co) addSection("Centre Clip", h - 85, 1, WEIGHTS.centerClip);

  // Mosquito net shutters
  if (hasNet) {
    const netH_qty = netCount;
    const netW_qty = netCount * 2;
    const netIntLockQty = netCount;
    addSection("Mesh Shutter H 45+45", h - 85, netH_qty, WEIGHTS.meshShutterH);
    addSection("Mesh Top/Bottom 45+90", shutterBottomW_size || (w - 107) / 2, netW_qty, WEIGHTS.meshShutterW);
    addSection("Mesh Interlock", h - 85, netIntLockQty, WEIGHTS.meshInterlock);
    addSection("Mesh Clip H", h - 103, netH_qty * 2, WEIGHTS.meshClip);
    addSection("Mesh Clip W", (w / (shutters / netCount)) - 35, netW_qty, WEIGHTS.meshClip);
  }

  const totalWeight = sections.reduce((s, x) => s + x.kg, 0);
  const wastageKg = totalWeight * rates.wastage;
  const totalAlumKg = totalWeight + wastageKg;
  const alumAmount = totalAlumKg * rates.aluminium;

  // ─── GLASS ────────────────────────────────────────────────────────────────
  const glasses = [];
  let glassSW, glassSH, glassQty;
  if (!co) {
    glassSW = (tracks === 2 ? (w - 107) / 2 : (w - 106) / 3) - 37;
    glassSH = h - 85 - 103;
    glassQty = tracks === 2 ? 2 : 2;
    if (tracks === 3 && shutters === 3) glassQty = 2;
    glasses.push({ name: "5mm Clear Glass", sw: glassSW, sh: glassSH, qty: glassQty });
    if (tracks === 3 && shutters === 3) {
      const csw = (w - 106) / 3 - 23 + 27;
      glasses.push({ name: "5mm Clear (Centre)", sw: csw, sh: glassSH, qty: 1 });
    }
  } else {
    glassSW = ((w - 136) / 4) - 37;
    glassSH = h - 85 - 103;
    glassQty = tracks === 2 ? 4 : 4;
    glasses.push({ name: "5mm Clear Glass", sw: glassSW, sh: glassSH, qty: glassQty });
    if (tracks === 3) {
      const csw = ((w - 136) / 4) - 22 + 27;
      glasses.push({ name: "5mm Clear (Centre)", sw: csw, sh: glassSH, qty: 2 });
    }
  }
  glasses.forEach(g => {
    g.sqftEach = sqFt(g.sw, g.sh);
    g.totalSqft = g.sqftEach * g.qty;
    g.amount = g.totalSqft * rates.glass5mm;
  });

  // Mosquito net glass
  if (hasNet) {
    const netSW = (w / shutters) * netCount;
    const netSH = h;
    const netSqft = sqFt(netSW, netSH) * netCount;
    glasses.push({ name: "Mosquito Net SS304", sw: netSW, sh: netSH, qty: netCount, sqftEach: sqFt(netSW, netSH), totalSqft: netSqft, amount: netSqft * rates.mosquitoNet });
  }

  const totalGlassAmount = glasses.reduce((s, g) => s + g.amount, 0);

  // ─── HARDWARE ─────────────────────────────────────────────────────────────
  const bearingQty = tracks === 2 ? shutters * 2 : shutters * 2;
  const hardware = [];
  hardware.push({ name: "Bearing", qty: bearingQty, rate: tracks === 2 ? rates.bearing2T : rates.bearing3T });
  hardware.push({ name: "Concealed Lock", qty: Math.ceil(shutters / 2), rate: tracks === 2 ? rates.concealedLock : rates.concealedLock3, note: "OPT." });

  const lockAmount = lockType === "multiPoint" ? (() => {
    const nibHolderQty = shutters <= 2 ? 3 : shutters * 1.5;
    return (rates.multiPointSystem * Math.ceil(shutters / 2)) + (nibHolderQty * rates.nibHolder) + (nibHolderQty * rates.tNib) + (Math.ceil(h / 1000) * rates.polimaidRod) + (Math.ceil(shutters / 2) * rates.centerRodDevice);
  })() : 0;

  const totalSqFt = sqFt(w, h);
  const woolPileW = mmToFt(w) * (tracks === 2 ? 3 : shutters);
  const woolPileH = mmToFt(h) * (tracks === 2 ? 3 : shutters);

  hardware.push({ name: "Wool Pile (W)", qty: woolPileW.toFixed(2), rate: rates.woolPile, unit: "rft" });
  hardware.push({ name: "Wool Pile (H)", qty: woolPileH.toFixed(2), rate: rates.woolPile, unit: "rft" });
  hardware.push({ name: "Water Drainage Cap", qty: tracks === 2 ? 3 : 4, rate: rates.waterDrainageCap });
  hardware.push({ name: "Fastener", qty: shutters * 3, rate: rates.fastner });
  hardware.push({ name: "Wall Screw", qty: shutters * 3, rate: rates.wallScrew });
  hardware.push({ name: "Bump Stopper", qty: Math.ceil(shutters / 2), rate: rates.bumpStopper });
  hardware.push({ name: "Sticker", qty: shutters * 2, rate: rates.sticker });
  hardware.push({ name: "Anti Dust", qty: Math.ceil(shutters / 2), rate: rates.antiDust });
  hardware.push({ name: "Silicon", qty: 1, rate: rates.silicon });
  if (isKPA) hardware.push({ name: "KPA Cover", qty: ilKPAQty * 2, rate: rates.kpaCover });
  hardware.push({ name: "Silicon Labour", qty: totalSqFt.toFixed(2), rate: rates.siliconLabour, unit: "sqft" });
  hardware.push({ name: "Interlock Cap", qty: (ilKPAQty + ilSlimQty) * 2, rate: rates.interlockCap });
  if (hasNet) hardware.push({ name: "Anti Lift Patti", qty: 4, rate: rates.antiLift });

  const hwAmount = hardware.reduce((s, h) => s + (Number(h.qty) * h.rate), 0) + lockAmount;

  // ─── EPDM RUBBER ─────────────────────────────────────────────────────────
  const epdmW = mmToFt(w) * shutters;
  const epdmH = mmToFt(h) * shutters;
  const trackEpdm = (mmToFt(w) + mmToFt(h)) * tracks;
  let totalEpdmFt = epdmW + epdmH + trackEpdm;
  if (hasNet) totalEpdmFt += mmToFt(w / shutters * netCount + h) * netCount;
  const epdmAmount = totalEpdmFt * rates.epdmRubber;

  // ─── LABOUR ──────────────────────────────────────────────────────────────
  const labourRate = tracks === 2 ? rates.labour2T : rates.labour3T;
  const labourSqFt = sqFt(w, h);
  const labourAmount = labourSqFt * labourRate;

  // ─── POWDER COATING ──────────────────────────────────────────────────────
  const powderAmount = rates.powderCoating > 0 ? (totalSqFt * rates.powderCoating) : 0;

  // ─── TOTALS ───────────────────────────────────────────────────────────────
  const subAlum = alumAmount;
  const total = subAlum + totalGlassAmount + hwAmount + epdmAmount + labourAmount + rates.transport + powderAmount;
  const sqftRate = total / totalSqFt;

  return {
    w, h, type, totalSqFt, sections, totalWeight, wastageKg, totalAlumKg, alumAmount,
    glasses, totalGlassAmount,
    hardware, hwAmount, lockAmount, lockType,
    epdmW, epdmH, trackEpdm, totalEpdmFt, epdmAmount,
    labourSqFt, labourRate, labourAmount,
    powderAmount,
    transport: rates.transport,
    total, sqftRate, isKPA,
    ilKPAQty, ilSlimQty,
  };
}

// ─── UI COMPONENTS ───────────────────────────────────────────────────────────
const fmt = (n) => typeof n === "number" ? "₹" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : n;
const fmtN = (n, d = 2) => typeof n === "number" ? n.toFixed(d) : n;

export default function App() {
  const [activeTab, setActiveTab] = useState("calc");
  const [typeId, setTypeId] = useState("2T2S");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [lockType, setLockType] = useState("concealed");
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [rateEditing, setRateEditing] = useState(false);
  const [tempRates, setTempRates] = useState(DEFAULT_RATES);
  const [results, setResults] = useState(null);
  const [qty, setQty] = useState(1);

  const type = WINDOW_TYPES.find(t => t.id === typeId);
  const calc = useMemo(() => {
    if (!width || !height) return null;
    return calcWindow(width, height, type, rates, lockType);
  }, [width, height, typeId, rates, lockType]);

  const handleCalculate = () => setResults(calc);

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: "#0f1117", minHeight: "100vh", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0d2137 100%)", borderBottom: "2px solid #2d6a9f", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 40, height: 40, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🪟</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#93c5fd", letterSpacing: 0.5 }}>AlumCalc Pro</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>29mm Slim Series • Aluminium Window Estimator</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {["calc", "rates"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: activeTab === tab ? "#2563eb" : "transparent",
                borderColor: activeTab === tab ? "#3b82f6" : "#374151",
                color: activeTab === tab ? "#fff" : "#9ca3af" }}>
              {tab === "calc" ? "📐 Calculator" : "⚙️ Rates"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px" }}>
        {activeTab === "rates" && (
          <RatesPanel rates={rates} setRates={setRates} />
        )}
        {activeTab === "calc" && (
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20 }}>
            {/* Input Panel */}
            <div>
              <Card title="Window Configuration">
                <Label>Window Type</Label>
                <select value={typeId} onChange={e => { setTypeId(e.target.value); setResults(null); }}
                  style={selectStyle}>
                  {WINDOW_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <div>
                    <Label>Width (mm)</Label>
                    <input type="number" value={width} onChange={e => { setWidth(e.target.value); setResults(null); }}
                      placeholder="e.g. 2000" style={inputStyle} />
                  </div>
                  <div>
                    <Label>Height (mm)</Label>
                    <input type="number" value={height} onChange={e => { setHeight(e.target.value); setResults(null); }}
                      placeholder="e.g. 1500" style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div>
                    <Label>Quantity</Label>
                    <input type="number" value={qty} min={1} onChange={e => setQty(Number(e.target.value))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <Label>Lock Type</Label>
                    <select value={lockType} onChange={e => setLockType(e.target.value)} style={selectStyle}>
                      <option value="concealed">Concealed Lock</option>
                      <option value="multiPoint">Multi-Point Lock</option>
                    </select>
                  </div>
                </div>

                {calc && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "#1e3a5f22", borderRadius: 8, border: "1px solid #2563eb44", fontSize: 12, color: "#93c5fd" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Area:</span><strong>{fmtN(calc.totalSqFt)} sq.ft</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span>KPA Interlock:</span><strong>{calc.isKPA ? `Yes (H > 1800mm)` : "No"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span>Tracks / Shutters:</span><strong>{type.tracks}T / {type.shutters}S {type.hasNet ? `+ ${type.netCount} Net` : ""}</strong>
                    </div>
                  </div>
                )}

                <button onClick={handleCalculate} disabled={!calc}
                  style={{ width: "100%", marginTop: 14, padding: "12px", background: calc ? "linear-gradient(135deg, #2563eb, #1d4ed8)" : "#374151",
                    color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: calc ? "pointer" : "not-allowed", letterSpacing: 0.5 }}>
                  {calc ? "📊 Generate Estimate" : "Enter dimensions above"}
                </button>
              </Card>

              {/* Quick summary */}
              {results && (
                <Card title="Cost Summary" style={{ marginTop: 16 }}>
                  <SummaryRow label="Aluminium" value={fmt(results.alumAmount)} />
                  <SummaryRow label="Glass" value={fmt(results.totalGlassAmount)} />
                  <SummaryRow label="Hardware" value={fmt(results.hwAmount)} />
                  <SummaryRow label="EPDM Rubber" value={fmt(results.epdmAmount)} />
                  <SummaryRow label="Labour" value={fmt(results.labourAmount)} />
                  <SummaryRow label="Transport" value={fmt(results.transport)} />
                  {results.powderAmount > 0 && <SummaryRow label="Powder Coating" value={fmt(results.powderAmount)} />}
                  <div style={{ borderTop: "1px solid #2d6a9f", marginTop: 10, paddingTop: 10 }}>
                    <SummaryRow label="Total (1 window)" value={fmt(results.total)} highlight />
                    <SummaryRow label={`Total (${qty} windows)`} value={fmt(results.total * qty)} highlight />
                    <SummaryRow label="Rate per sq.ft" value={fmt(results.sqftRate)} />
                  </div>
                </Card>
              )}
            </div>

            {/* Detail Panel */}
            <div>
              {!results && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, color: "#4b5563", textAlign: "center" }}>
                  <div style={{ fontSize: 60, marginBottom: 16 }}>🪟</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#6b7280" }}>Configure & Calculate</div>
                  <div style={{ fontSize: 13, marginTop: 8, maxWidth: 300 }}>Select window type, enter dimensions, and click Generate Estimate to see full breakdown</div>
                </div>
              )}
              {results && <DetailPanel r={results} qty={qty} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailPanel({ r, qty }) {
  const [section, setSection] = useState("alum");
  const tabs = [
    { id: "alum", label: "Aluminium" },
    { id: "glass", label: "Glass" },
    { id: "hardware", label: "Hardware" },
    { id: "rubber", label: "EPDM Rubber" },
    { id: "labour", label: "Labour" },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSection(t.id)}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: section === t.id ? "#1d4ed8" : "#1e293b",
              borderColor: section === t.id ? "#3b82f6" : "#374151",
              color: section === t.id ? "#fff" : "#9ca3af" }}>
            {t.label}
          </button>
        ))}
      </div>

      {section === "alum" && (
        <Card title="Aluminium Sections">
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#64748b", borderBottom: "1px solid #1e3a5f" }}>
                {["Section", "Size(mm)", "Qty", "Mtrs", "Wt/m", "Total kg", "Rate", "Amount"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: h === "Section" ? "left" : "right", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.sections.map((s, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "6px 8px", color: "#93c5fd" }}>{s.name}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtN(s.size, 0)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{s.qty}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtN(s.mtr)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{s.weight}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtN(s.kg)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>350</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#4ade80" }}>{fmt(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#0d2137", borderRadius: 6, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total Weight:</span><strong>{fmtN(r.totalWeight)} kg</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>Wastage (10%):</span><strong>{fmtN(r.wastageKg)} kg</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, color: "#4ade80" }}><span>Total Aluminium Amount:</span><strong>{fmt(r.alumAmount)}</strong></div>
          </div>
        </Card>
      )}

      {section === "glass" && (
        <Card title="Glass Calculation">
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#64748b", borderBottom: "1px solid #1e3a5f" }}>
                {["Type", "Size W(mm)", "Size H(mm)", "Sq.ft each", "Qty", "Total Sq.ft", "Rate", "Amount"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: h === "Type" ? "left" : "right", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.glasses.map((g, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "6px 8px", color: "#93c5fd" }}>{g.name}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtN(g.sw, 0)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtN(g.sh, 0)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtN(g.sqftEach)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{g.qty}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtN(g.totalSqft)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>₹55</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#4ade80" }}>{fmt(g.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#0d2137", borderRadius: 6, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#4ade80" }}><span>Total Glass Amount:</span><strong>{fmt(r.totalGlassAmount)}</strong></div>
          </div>
        </Card>
      )}

      {section === "hardware" && (
        <Card title="Hardware Items">
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#64748b", borderBottom: "1px solid #1e3a5f" }}>
                {["Item", "Qty", "Rate", "Amount"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: h === "Item" ? "left" : "right", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.hardware.map((h, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "6px 8px", color: "#93c5fd" }}>{h.name}{h.note ? <span style={{ color: "#fbbf24", fontSize: 10 }}> {h.note}</span> : ""}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtN(Number(h.qty), 2)} {h.unit || ""}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>₹{h.rate}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#4ade80" }}>{fmt(Number(h.qty) * h.rate)}</td>
                </tr>
              ))}
              {r.lockType === "multiPoint" && (
                <tr style={{ borderBottom: "1px solid #1e293b", background: "#1e3a5f22" }}>
                  <td style={{ padding: "6px 8px", color: "#fbbf24" }}>Multi-Point Lock System</td>
                  <td colSpan={2} style={{ padding: "6px 8px", textAlign: "right", color: "#9ca3af", fontSize: 11 }}>Calculated</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#4ade80" }}>{fmt(r.lockAmount)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#0d2137", borderRadius: 6, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#4ade80" }}><span>Total Hardware Amount:</span><strong>{fmt(r.hwAmount)}</strong></div>
          </div>
        </Card>
      )}

      {section === "rubber" && (
        <Card title="EPDM Rubber Gaskets">
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#64748b", borderBottom: "1px solid #1e3a5f" }}>
                {["Item", "Running Feet", "Rate/ft", "Amount"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: h === "Item" ? "left" : "right", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Shutter EPDM (Width)", ft: r.epdmW },
                { name: "Track EPDM (H+W)", ft: r.trackEpdm },
                { name: "Shutter EPDM (Height)", ft: r.epdmH },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "6px 8px", color: "#93c5fd" }}>{row.name}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtN(row.ft)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>₹10</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#4ade80" }}>{fmt(row.ft * 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#0d2137", borderRadius: 6, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total Running Feet:</span><strong>{fmtN(r.totalEpdmFt)} rft</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, color: "#4ade80" }}><span>Total EPDM Amount:</span><strong>{fmt(r.epdmAmount)}</strong></div>
          </div>
        </Card>
      )}

      {section === "labour" && (
        <Card title="Labour & Transport">
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #1e293b" }}>
                <td style={{ padding: "8px", color: "#93c5fd" }}>Window Labour ({r.type.tracks} Track)</td>
                <td style={{ padding: "8px", textAlign: "right" }}>{fmtN(r.labourSqFt)} sq.ft × ₹{r.labourRate}</td>
                <td style={{ padding: "8px", textAlign: "right", color: "#4ade80" }}>{fmt(r.labourAmount)}</td>
              </tr>
              <tr>
                <td style={{ padding: "8px", color: "#93c5fd" }}>Transport</td>
                <td style={{ padding: "8px", textAlign: "right" }}>Fixed</td>
                <td style={{ padding: "8px", textAlign: "right", color: "#4ade80" }}>{fmt(r.transport)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 16, padding: "14px", background: "linear-gradient(135deg, #1e3a5f, #0d2137)", borderRadius: 8, border: "1px solid #2d6a9f" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", marginBottom: 10 }}>Final Summary (per window)</div>
            {[
              { label: "Aluminium", val: r.alumAmount },
              { label: "Glass", val: r.totalGlassAmount },
              { label: "Hardware", val: r.hwAmount },
              { label: "EPDM Rubber", val: r.epdmAmount },
              { label: "Labour + Transport", val: r.labourAmount + r.transport },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#94a3b8" }}>{row.label}</span>
                <span>{fmt(row.val)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #2d6a9f", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700 }}>
              <span style={{ color: "#93c5fd" }}>TOTAL</span>
              <span style={{ color: "#4ade80" }}>{fmt(r.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 6, color: "#64748b" }}>
              <span>Rate per sq.ft</span>
              <span>{fmt(r.sqftRate)}</span>
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#0d2137", borderRadius: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700 }}>Total for {qty > 1 ? qty + " windows" : "this window"}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#4ade80" }}>{fmt(r.total * qty)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function RatesPanel({ rates, setRates }) {
  const [local, setLocal] = useState({ ...rates });
  const groups = [
    { title: "Material Rates", fields: [
      { key: "aluminium", label: "Aluminium (₹/kg)" },
      { key: "glass5mm", label: "5mm Glass (₹/sq.ft)" },
      { key: "mosquitoNet", label: "Mosquito Net (₹/sq.ft)" },
      { key: "epdmRubber", label: "EPDM Rubber (₹/rft)" },
      { key: "wastage", label: "Aluminium Wastage (%)", pct: true },
    ]},
    { title: "Labour & Others", fields: [
      { key: "labour2T", label: "Labour – 2 Track (₹/sqft)" },
      { key: "labour3T", label: "Labour – 3 Track (₹/sqft)" },
      { key: "transport", label: "Transport (₹ fixed)" },
      { key: "powderCoating", label: "Powder Coating (₹/sqft, 0=exclude)" },
    ]},
    { title: "Hardware Rates", fields: [
      { key: "bearing2T", label: "Bearing 2T (₹)" },
      { key: "bearing3T", label: "Bearing 3T (₹)" },
      { key: "concealedLock", label: "Concealed Lock 2T (₹)" },
      { key: "concealedLock3", label: "Concealed Lock 3T (₹)" },
      { key: "silicon", label: "Silicon (₹)" },
      { key: "antiDust", label: "Anti Dust (₹)" },
      { key: "bumpStopper", label: "Bump Stopper (₹)" },
      { key: "sticker", label: "Sticker (₹)" },
      { key: "kpaCover", label: "KPA Cover (₹)" },
      { key: "interlockCap", label: "Interlock Cap (₹)" },
      { key: "siliconLabour", label: "Silicon Labour (₹/sqft)" },
    ]},
  ];
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#93c5fd", marginBottom: 16 }}>⚙️ Rate Configuration</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {groups.map(g => (
          <Card key={g.title} title={g.title}>
            {g.fields.map(f => (
              <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: "#94a3b8" }}>{f.label}</label>
                <input type="number" value={f.pct ? local[f.key] * 100 : local[f.key]}
                  onChange={e => setLocal(prev => ({ ...prev, [f.key]: f.pct ? Number(e.target.value) / 100 : Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 90, textAlign: "right", padding: "4px 8px" }} />
              </div>
            ))}
          </Card>
        ))}
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <button onClick={() => setRates({ ...local })}
          style={{ padding: "10px 24px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
          ✓ Save Rates
        </button>
        <button onClick={() => { setLocal({ ...DEFAULT_RATES }); setRates({ ...DEFAULT_RATES }); }}
          style={{ padding: "10px 24px", background: "#374151", color: "#9ca3af", border: "1px solid #4b5563", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          Reset to Default
        </button>
      </div>
    </div>
  );
}

function Card({ title, children, style = {} }) {
  return (
    <div style={{ background: "#1e293b", border: "1px solid #2d3748", borderRadius: 12, padding: 16, ...style }}>
      {title && <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, borderBottom: "1px solid #2d3748", paddingBottom: 8 }}>{title}</div>}
      {children}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4, marginTop: 4 }}>{children}</div>;
}

function SummaryRow({ label, value, highlight }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: highlight ? 13 : 12, fontWeight: highlight ? 700 : 400, marginBottom: 5, color: highlight ? "#4ade80" : "#e2e8f0" }}>
      <span style={{ color: highlight ? "#93c5fd" : "#94a3b8" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 10px", background: "#0f1117", border: "1px solid #374151",
  borderRadius: 6, color: "#e2e8f0", fontSize: 13, boxSizing: "border-box",
};
const selectStyle = {
  width: "100%", padding: "8px 10px", background: "#0f1117", border: "1px solid #374151",
  borderRadius: 6, color: "#e2e8f0", fontSize: 13, marginTop: 4,
};
