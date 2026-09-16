/* Live regression QA for the Worker PWA gateway. Run one stage at a time so
 * each check stays quick; every stage removes its own temporary Sheet rows. */
const pin = process.env.WORKER_QA_PIN;
const stage = process.argv[2] || "all";
const gateway = "https://suphanbenjarong-api.phum-recovery.workers.dev/api";
if (!/^\d{6}$/.test(pin || "")) throw new Error("WORKER_QA_PIN must be a six-digit test PIN");

async function api(action, session, data) {
  const payload = { action };
  if (session) payload.session = session;
  if (data) action === "login" ? payload.pin = data.pin : payload.data = data;
  const response = await fetch(gateway, { method: "POST", headers: { "content-type": "application/json", origin: "https://phumrecovery.github.io" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(45000) });
  const reply = await response.json();
  if (!reply.ok) throw new Error(`${action}: ${reply.error || "FAILED"} ${reply.message || ""}`);
  return reply;
}
function check(condition, message) { if (!condition) throw new Error(`ASSERT: ${message}`); }
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5VQAAAABJRU5ErkJggg==";
const login = await api("login", null, { pin });
check(login.level === "worker" && login.session, "worker PIN must create a session");
const session = login.session;
const created = [];
async function cleanup(id) {
  if (!id) return;
  for (const action of ["workerPortalDeletePendingJob", "workerPortalDeleteJob"]) {
    try { await api(action, session, { jobId: id }); } catch (_) { /* best-effort cleanup */ }
  }
}
async function create(data) {
  const reply = await api("workerPortalCreateJob", session, data);
  const id = reply.result?.id;
  check(id, "create must return an ID");
  created.push(id);
  return id;
}
async function bootstrap() { return (await api("workerPortalBootstrap", session)).result; }

try {
  const boot = await bootstrap();
  check(boot.worker, "bootstrap must return the signed worker");
  if (stage === "login") console.log("PASS login/bootstrap");
  if (stage === "cleanup") {
    for (const job of boot.jobs.filter(x => x.product?.startsWith("QA-"))) await cleanup(job.id);
    const after = await bootstrap();
    check(!after.jobs.some(x => x.product?.startsWith("QA-")), "temporary QA jobs must be removable");
    console.log("PASS temporary QA cleanup");
  }
  if (stage === "writer" || stage === "all") {
    const id = await create({ role: "เขียนลาย", workType: "เบญจรงค์", workStyle: "เต็มใบ", product: "QA-เขียนลาย", pattern: "QA-ลาย", qty: 2, unit: "ชิ้น", priceEach: 25, stickerQty: 1, receivedDate: today, note: "QA temporary" });
    await api("workerPortalUpdateJob", session, { jobId: id, product: "QA-เขียนลายแก้ไข", pattern: "QA-ลายแก้", qty: 3, unit: "ชุด", priceEach: 30, stickerQty: 1, receivedDate: today, note: "QA edited" });
    const job = (await bootstrap()).jobs.find(x => x.id === id);
    check(job?.qty === 3 && job?.priceEach === 30 && job?.unit === "ชุด", "writer edit must persist");
    await api("workerPortalDeleteJob", session, { jobId: id }); created.splice(created.indexOf(id), 1);
    console.log("PASS writer create/edit/delete");
  }
  if (stage === "roles" || stage === "all") {
    const paint = await create({ role: "ลงสี", workType: "เบญจรงค์", workStyle: "เต็มใบ", product: "QA-ลงสี", pattern: "QA-ลาย", qty: 2, unit: "ชิ้น", priceEach: 28, stickerQty: 0, receivedDate: today, note: "QA temporary" });
    await api("workerPortalDeleteJob", session, { jobId: paint }); created.splice(created.indexOf(paint), 1);
    const gold = await create({ role: "วนทอง", workType: "วนทอง", workStyle: "", product: "", pattern: "", qty: 1, unit: "เตา", priceEach: 999, stickerQty: 0, receivedDate: today, note: "QA temporary" });
    await api("workerPortalUpdateJob", session, { jobId: gold, qty: 2, unit: "เตา", priceEach: 999, stickerQty: 0, receivedDate: today, note: "QA edited" });
    const job = (await bootstrap()).jobs.find(x => x.id === gold);
    check(job?.qty === 2 && job?.priceEach === 180, "gold work must retain fixed 180 rate");
    await api("workerPortalDeleteJob", session, { jobId: gold }); created.splice(created.indexOf(gold), 1);
    console.log("PASS paint and gold role variations");
  }
  if (stage === "pending" || stage === "all") {
    const id = await create({ role: "เขียนลาย", workType: "เบญจรงค์", workStyle: "เต็มใบ", product: "QA-ส่งงาน", pattern: "QA-ลาย", qty: 3, unit: "ชิ้น", priceEach: 25, stickerQty: 1, receivedDate: today, note: "QA temporary" });
    const sent = await api("workerPortalSubmit", session, { jobId: id, qty: 1, photoData: tinyPng, photoName: "qa.png", submittedDate: today });
    const submissionId = sent.result?.id; check(submissionId, "submit must return an ID");
    let data = await bootstrap(); let job = data.jobs.find(x => x.id === id); let submission = data.submissions.find(x => x.id === submissionId);
    check(job?.pendingQty === 1 && submission?.status === "รอตรวจ" && submission?.photoUrl, "submit must persist pending quantity and photo");
    await api("workerPortalUpdatePendingSubmission", session, { submissionId, qty: 2, priceEach: 35, jobQty: 3, photoData: "", photoName: "" });
    data = await bootstrap(); job = data.jobs.find(x => x.id === id); submission = data.submissions.find(x => x.id === submissionId);
    check(job?.pendingQty === 2 && job?.priceEach === 35 && submission?.qty === 2, "pending edit must persist");
    await api("workerPortalDeletePendingJob", session, { jobId: id }); created.splice(created.indexOf(id), 1);
    data = await bootstrap(); check(!data.jobs.some(x => x.product?.startsWith("QA-")) && !data.submissions.some(x => x.id === submissionId), "QA rows must be cleaned up");
    console.log("PASS submit/photo/pending-edit/withdraw/cleanup");
  }
} finally { for (const id of created.reverse()) await cleanup(id); }
