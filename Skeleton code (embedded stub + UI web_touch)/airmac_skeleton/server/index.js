import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

// ====== Setup path khi dùng ES Module ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ====== Serve static web UI ======
app.use(express.static(path.join(__dirname, '../web')));

// Route mặc định → trả về index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/index.html'));
});

// ====== In-memory data store (có thể thay bằng DB sau này) ======
const cases = new Map();

// ====== Helper để tính risk ======
function computeRisk({ checklistScore = 0, usPositionScore = 1 }) {
  const total = checklistScore + usPositionScore;
  let tier = 'low', lpm = 0.5, cap = 80;
  if (total >= 3 && total <= 5) { tier = 'medium'; lpm = 0.4; cap = 60; }
  else if (total >= 6 && total <= 8) { tier = 'high'; lpm = 0.3; cap = 45; }
  else if (total >= 9) { tier = 'very_high'; lpm = 0.25; cap = 35; }
  return { total, tier, lpm, cap };
}

// ====== API endpoints ======

// Tạo case mới
app.post('/api/cases', (req, res) => {
  const { demographics } = req.body || {};
  const required = ['fullName', 'dob', 'gender', 'address', 'phone', 'chiefComplaint'];
  for (const k of required) {
    if (!demographics || !demographics[k]) {
      return res.status(400).json({ error: `Missing field: ${k}` });
    }
  }
  const id = uuidv4();
  cases.set(id, {
    id, demographics, createdAt: new Date().toISOString(),
    clinical: null, risk: null, status: 'intake', logs: [],
    device: { lpm: 0, cap: 80, pressure: 0, pumping: false }
  });
  res.status(201).json({ caseId: id });
});

// Cập nhật điểm clinical và tính risk
app.post('/api/cases/:id/score', (req, res) => {
  const c = cases.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const { checklistScore, usPositionScore } = req.body || {};
  if (typeof checklistScore !== 'number' || typeof usPositionScore !== 'number') {
    return res.status(400).json({ error: 'Invalid scores' });
  }
  c.clinical = { checklistScore, usPositionScore };
  c.risk = computeRisk({ checklistScore, usPositionScore });
  c.status = 'ready';
  res.json(c.risk);
});

// Start pumping
app.post('/api/cases/:id/start', (req, res) => {
  const c = cases.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (!c.risk) return res.status(400).json({ error: 'No risk computed' });
  c.status = 'pumping';
  c.device.lpm = c.risk.lpm;
  c.device.cap = c.risk.cap;
  c.device.pumping = true;
  c.logs.push({ t: Date.now(), event: 'START', lpm: c.device.lpm, cap: c.device.cap });
  res.json({ ok: true });
});

// Emergency stop
app.post('/api/cases/:id/estop', (req, res) => {
  const c = cases.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  c.status = 'alert_pause';
  c.device.pumping = false;
  c.device.lpm = 0;
  c.logs.push({ t: Date.now(), event: 'ESTOP' });
  res.json({ ok: true });
});

// Complete case
app.post('/api/cases/:id/complete', (req, res) => {
  const c = cases.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  c.status = 'end';
  c.device.pumping = false;
  c.logs.push({ t: Date.now(), event: 'COMPLETE' });
  res.json({ ok: true });
});

// Polling status
app.get('/api/cases/:id/status', (req, res) => {
  const c = cases.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.device.pumping) {
    let p = c.device.pressure || 0;
    const target = Math.min(c.device.cap - 5, 50 + Math.random() * 20);
    p = p + (target - p) * 0.2 + (Math.random() * 2 - 1);
    if (p > c.device.cap) {
      c.device.lpm = Math.max(0.2, c.device.lpm - 0.05);
      c.logs.push({ t: Date.now(), event: 'AUTO_REDUCE', pressure: p, lpm: c.device.lpm });
    }
    c.device.pressure = Math.max(0, Math.min(c.device.cap, p));
  } else {
    c.device.pressure = Math.max(0, c.device.pressure - 2);
  }
  res.json({ status: c.status, device: c.device });
});

// ====== Start server ======
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`AIR MAC server running at http://localhost:${PORT}`);
});
